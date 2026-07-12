# OpenClaw 健康检查超时问题排查指南

## 问题现象

在 Web Console Setup 页面部署 OpenClaw 时，出现"OpenClaw 健康检查超时"错误：

```
✗ 部署失败
OpenClaw 健康检查超时

查看详细日志
Image ghcr.io/openclaw/openclaw:latest Pulling
Image ghcr.io/openclaw/openclaw:latest Pulled
Container openclaw-gateway Starting
Container openclaw-gateway Started
```

容器显示已启动，但健康检查持续失败。

---

## 根本原因

### 问题 1：配置文件格式不兼容（主要原因）

**OpenClaw 2026.5.7 版本移除了配置文件中的 `webhooks` 字段支持**。

旧版本代码生成的配置文件：
```json
{
  "webhooks": {
    "clawkit": {
      "url": "http://127.0.0.1:8787/api/openclaw/webhook",
      "token": "clawkit-local-openclaw-token",
      "enabled": true
    }
  }
}
```

这会导致 OpenClaw 启动失败并不断重启：
```
Gateway failed to start: Error: Invalid config at /home/node/.openclaw/openclaw.json.
<root>: Unrecognized key: "webhooks"
```

### 问题 2：健康检查时间窗口配置不合理（次要原因）

即使配置文件正确，原有的健康检查配置也可能导致超时：

- Docker healthcheck `start_period: 15s` 太短
- 应用层总等待时间 120 秒可能不足
- OpenClaw 实际启动需要 20-40 秒

---

## 解决方案

### 方案 1：修复配置文件生成逻辑（已修复）

**修改文件**：`packages/cli/src/services/apply.service.ts`

```typescript
private renderOpenClawJson(manifest: Manifest): string {
  // OpenClaw 2026.5.7+ 不再支持通过配置文件配置 webhooks
  // webhook 配置需要在 OpenClaw UI 中手动完成
  // 这里只生成基础配置，让 OpenClaw 自动初始化
  const config = {
    gateway: {
      controlUi: {
        allowedOrigins: [
          'http://localhost:18000',
          'http://127.0.0.1:18000',
        ],
      },
    },
  };

  return `${JSON.stringify(config, null, 2)}\n`;
}
```

### 方案 2：增加健康检查时间窗口（已修复）

**修改文件**：`packages/controller/src/http/services/openclaw-deploy.service.ts`

**Docker healthcheck 配置**（第 169-174 行）：
```yaml
healthcheck:
  interval: 30s
  timeout: 10s
  start_period: 60s  # 从 15s 增加到 60s
  retries: 3
```

**应用层健康检查**（第 243-246 行）：
```typescript
async waitForHealthy(): Promise<OpenClawDeployResult> {
  const maxAttempts = 60;        // 从 40 增加到 60
  const intervalMs = 5000;       // 从 3000 增加到 5000
  const requestTimeoutMs = 8000; // 从 5000 增加到 8000
  // 总等待时间 = 60 × 5 = 300 秒（5 分钟）
}
```

---

## 手动修复步骤

如果你遇到了这个问题，按以下步骤修复：

### 1. 停止并删除容器

```bash
docker stop openclaw-gateway
docker rm openclaw-gateway
```

### 2. 备份并删除错误的配置文件

```bash
mv ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.backup
```

### 3. 重新启动容器

```bash
cd ~/.openclaw
docker compose up -d openclaw-gateway
```

### 4. 验证健康状态

```bash
# 查看容器状态
docker ps | grep openclaw

# 查看容器日志
docker logs openclaw-gateway --tail 20

# 测试健康检查端点
curl http://localhost:18000/healthz
```

预期输出：
```json
{"ok":true,"status":"live"}
```

---

## OpenClaw 正确的配置方式

### 自动生成的配置（推荐）

让 OpenClaw 自动生成配置文件，不要手动编辑：

```json
{
  "gateway": {
    "auth": {
      "mode": "token",
      "token": "自动生成的token"
    },
    "controlUi": {
      "allowedOrigins": [
        "http://localhost:18000",
        "http://127.0.0.1:18000"
      ]
    }
  },
  "meta": {
    "lastTouchedVersion": "2026.5.7",
    "lastTouchedAt": "2026-05-10T16:15:57.381Z"
  }
}
```

### Webhook 配置方式

**重要**：OpenClaw 2026.5.7+ 的 webhook 配置必须在 OpenClaw UI 中手动完成，不能通过配置文件。

步骤：
1. 访问 OpenClaw UI：`http://localhost:18000`
2. 创建账号并登录
3. 在设置中配置 webhook：
   - URL: `http://127.0.0.1:8787/api/openclaw/webhook`
   - Token: 从 manifest 的 `services.openClaw.apiKey` 获取
4. 保存配置

---

## 验证修复

### 1. 重新构建项目

```bash
pnpm build
```

### 2. 重启 controller

```bash
cd packages/controller
pnpm start
```

### 3. 通过 Web Console 重新部署

访问 Setup 页面 → 选择 "一键部署 OpenClaw" → 观察日志输出

### 4. 预期结果

- 容器启动后不会报配置错误
- 健康检查在 60 秒内通过
- 日志显示 "OpenClaw 部署成功"

---

## 相关文档

- [OpenClaw 集成文档](./openclaw-integration.md)
- [Setup 向导文档](./setup-wizard.md)
- [故障排查清单](./heal.md)

---

## 版本信息

- **修复版本**：clawkit 0.1.0+
- **OpenClaw 版本**：2026.5.7
- **修复日期**：2026-05-10
