# OpenClaw 健康检查超时问题修复总结

## 问题描述

用户在 Web Console Setup 页面部署 OpenClaw 时，遇到"OpenClaw 健康检查超时"错误。容器显示已启动，但健康检查持续失败。

## 根本原因

### 主要原因：配置文件格式不兼容

**OpenClaw 2026.5.7 版本移除了配置文件中的 `webhooks` 字段支持**，但 clawkit 代码仍在生成包含 `webhooks` 的配置文件，导致：

```
Gateway failed to start: Error: Invalid config at /home/node/.openclaw/openclaw.json.
<root>: Unrecognized key: "webhooks"
```

容器不断重启，健康检查永远无法通过。

### 次要原因：健康检查时间窗口配置不合理

- Docker healthcheck `start_period: 15s` 太短
- 应用层总等待时间 120 秒可能不足
- OpenClaw 实际启动需要 20-40 秒

---

## 修复内容

### 1. 修复配置文件生成逻辑

**文件**：`packages/cli/src/services/apply.service.ts`

**修改前**：
```typescript
private renderOpenClawJson(manifest: Manifest): string {
  const token = manifest.services.openClaw.apiKey?.trim() || this.generateWebhookToken();
  
  const config = {
    webhooks: {  // ❌ OpenClaw 2026.5.7+ 不支持
      clawkit: {
        url: `${manifest.services.openClaw.publicUrl}${manifest.services.controller.apiPrefix}/openclaw/webhook`,
        token,
        enabled: true,
      },
    },
  };

  return `${JSON.stringify(config, null, 2)}\n`;
}
```

**修改后**：
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

### 2. 增加健康检查时间窗口

**文件**：`packages/controller/src/http/services/openclaw-deploy.service.ts`

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

### 3. 优化 UI 交互体验

**文件**：`packages/web/src/pages/SetupWizardPage.tsx`

**改进点**：
- 部署成功后自动隐藏"一键部署"按钮
- 显示绿色成功状态提示
- 防止用户重复点击部署

**修改前**：
```tsx
<button onClick={startOpenClawDeploy}>
  一键部署 OpenClaw
</button>
```

**修改后**：
```tsx
{!openClawDeployState.result ? (
  <button onClick={startOpenClawDeploy}>
    一键部署 OpenClaw
  </button>
) : null}

{openClawDeployState.result ? (
  <div className="success-message">
    ✓ {openClawDeployState.result.message}
  </div>
) : null}
```

---

## 修复效果对比

| 配置项 | 修复前 | 修复后 | 改进 |
|--------|--------|--------|------|
| 配置文件格式 | 包含不支持的 webhooks | 只包含基础配置 | ✅ 容器正常启动 |
| Docker start_period | 15s | 60s | +300% |
| 应用层总等待 | 120s | 300s | +150% |
| 单次请求超时 | 5s | 8s | +60% |
| UI 交互 | 可重复点击 | 成功后隐藏按钮 | ✅ 防止误操作 |

---

## 验证步骤

### 1. 清理旧环境

```bash
# 停止并删除容器
docker stop openclaw-gateway
docker rm openclaw-gateway

# 备份旧配置
mv ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.backup
```

### 2. 重新构建项目

```bash
pnpm build
```

### 3. 重新部署

通过 Web Console Setup 页面重新部署 OpenClaw。

### 4. 验证成功

- 容器状态为 `Up`（不是 `Restarting`）
- 健康检查通过：`curl http://localhost:18000/healthz` 返回 `{"ok":true,"status":"live"}`
- UI 显示绿色成功提示，按钮自动隐藏

---

## OpenClaw Webhook 配置方式变更

**重要**：OpenClaw 2026.5.7+ 不再支持通过配置文件配置 webhooks，必须在 OpenClaw UI 中手动配置：

1. 访问 `http://localhost:18000`
2. 创建账号并登录
3. 在设置中配置 webhook：
   - URL: `http://127.0.0.1:8787/api/openclaw/webhook`
   - Token: 从 manifest 的 `services.openClaw.apiKey` 获取
4. 保存配置

---

## 相关文档

- [OpenClaw 健康检查超时排查指南](./troubleshooting-openclaw-healthcheck.md)
- [OpenClaw 集成文档](./openclaw-integration.md)
- [Setup 向导文档](./setup-wizard.md)

---

## 修复版本

- **修复日期**：2026-05-10
- **修复版本**：clawkit 0.1.0+
- **OpenClaw 版本**：2026.5.7
- **影响范围**：CLI、Controller、Web Console
