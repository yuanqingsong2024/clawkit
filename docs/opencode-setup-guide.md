# OpenCode 服务启动与配置指南

## 推荐架构：共享单一 OpenCode 服务

**重要**：默认情况下，应该启动一个 OpenCode 服务供所有项目共享。

### 为什么共享？

- **资源效率**：OpenCode 是重量级服务，每个实例消耗大量内存
- **运维简单**：只需要启动和监控一个服务进程
- **天然支持**：OpenCode 通过 directory 参数天然支持多项目隔离

### 快速启动（推荐方式）

```bash
# 启动单一 OpenCode 服务，供所有项目共享
opencode serve --port 4096 --hostname 127.0.0.1
```

所有项目都会连接到这个服务实例，OpenCode 会自动根据工作目录隔离不同项目的会话。

## 问题解决

### 1. OpenCode 显示 offline 的解决方案

OpenCode 服务需要单独启动。有以下几种启动方式：

#### 方式一：使用项目脚本（推荐）

```bash
# 在项目根目录执行
pnpm opencode
```

> 说明：如果要在桌面端或 worker 的真实执行模式中自动启动 OpenCode，请先设置 `OPENCODE_SERVER_PASSWORD`，否则启动会直接失败。

#### 方式二：手动启动

```bash
# 启动 OpenCode 服务在 4096 端口
opencode serve --port 4096 --hostname 127.0.0.1
```

#### 方式三：后台启动

```bash
# 后台启动并记录日志
nohup opencode serve --port 4096 --hostname 127.0.0.1 --print-logs > opencode.log 2>&1 &

# 查看日志
tail -f opencode.log
```

### 2. 验证 OpenCode 服务状态

```bash
# 检查进程
ps aux | grep "opencode serve"

# 检查端口
lsof -i :4096

# 查看日志
tail -f opencode.log
```

### 3. 停止 OpenCode 服务

```bash
# 查找进程 ID
ps aux | grep "opencode serve" | grep -v grep

# 停止进程（替换 PID 为实际进程 ID）
kill <PID>
```

## 快速配置功能

### 新增功能

我们添加了一个**快速配置向导**页面，帮助你一步步完成 clawkit 的初始化配置。

### 访问方式

1. 打开 Web Console：http://localhost:5173
2. 点击左侧导航栏的「快速配置」
3. 或者在控制台页面点击「快速配置」按钮

### 配置步骤

#### 步骤 1：配置 Manifest 路径

指定 manifest YAML 文件的路径，例如：
```
/media/yuanqingsong/新加卷1/code/clawkit/examples/simple.yaml
```

#### 步骤 2：配置 OpenClaw Webhook

配置 OpenClaw 的连接信息：
- **OpenClaw 服务地址**：`http://127.0.0.1:18000`
- **Webhook Token**：与 OpenClaw 配置中的 token 保持一致

#### 步骤 3：启动服务

确保以下服务正在运行：
- ✓ Controller（自动运行）
- ✓ Worker：`pnpm --filter @clawkit/worker start`
- ✓ OpenCode：`pnpm opencode` 或 `opencode serve --port 4096`

#### 步骤 4：配置 OpenClaw 侧 Webhook

在 OpenClaw 中配置 webhook：
- **Webhook URL**：`http://localhost:8787/webhook/openclaw`
- **Token**：与步骤 2 中配置的 token 一致

### 配置完成

当所有步骤完成后，页面会显示绿色的「配置完成」提示，此时可以开始使用 clawkit。

## 常见问题

### Q: OpenCode 一直显示 offline？

**A:** 请确保：
1. OpenCode 服务已启动：`pnpm opencode`
2. 端口 4096 没有被其他程序占用
3. Worker 配置中的 `OPENCODE_SERVER_BASE_URL` 正确（默认 `http://127.0.0.1:4096`）

### Q: 保存配置后没有生效？

**A:** 需要重启 controller 和 worker 进程：
```bash
# 停止现有进程（Ctrl+C）
# 重新启动
pnpm --filter @clawkit/controller start
pnpm --filter @clawkit/worker start
```

### Q: 如何查看 OpenCode 日志？

**A:** 
```bash
# 如果使用 pnpm opencode 启动
tail -f opencode.log

# 如果使用脚本启动
tail -f /media/yuanqingsong/新加卷1/code/clawkit/opencode.log
```

### Q: 如何配置多个项目？

**A:** 默认情况下，多个项目共享一个 OpenCode 服务：

```yaml
# 推荐配置：所有项目共享一个 OpenCode 服务
projects:
  - key: project1
    path: /path/to/project1
    # 不配置 openCodePort，使用全局配置
  
  - key: project2
    path: /path/to/project2
    # 不配置 openCodePort，使用全局配置

# 全局 OpenCode 配置
openCodeBaseUrl: http://127.0.0.1:4096
```

只启动一个 OpenCode 实例即可：
```bash
opencode serve --port 4096
```

**特殊场景**（不推荐）：如果确实需要为不同项目使用不同 OpenCode 实例（如不同版本），可以配置项目独立端口：

```yaml
projects:
  - key: project1
    path: /path/to/project1
    openCodePort: 4096
  
  - key: project2
    path: /path/to/project2
    openCodePort: 4097
```

此时需要启动多个实例：
```bash
opencode serve --port 4096 &
opencode serve --port 4097 &
```

## 完整启动流程

```bash
# 1. 启动 OpenCode 服务
pnpm opencode

# 2. 启动 Controller（新终端）
pnpm --filter @clawkit/controller start

# 3. 启动 Worker（新终端）
pnpm --filter @clawkit/worker start

# 4. 启动 Web Console（新终端）
pnpm --filter @clawkit/web dev

# 5. 访问 Web Console
# 浏览器打开：http://localhost:5173
```

## 环境变量配置

### Worker 环境变量

```bash
# OpenCode 服务地址
export OPENCODE_SERVER_BASE_URL=http://127.0.0.1:4096

# OpenCode 服务密码（如果设置了）
export OPENCODE_SERVER_PASSWORD=your-password

# 是否允许 placeholder 回退（开发时可设为 true）
export WORKER_PLACEHOLDER_FALLBACK=false

# Manifest 路径
export CLAWKIT_MANIFEST_PATH=/path/to/manifest.yaml
```

### Controller 环境变量

```bash
# OpenClaw webhook token
export OPENCLAW_WEBHOOK_TOKEN=your-webhook-token

# Controller 端口
export CONTROLLER_PORT=8787

# Manifest 路径
export CLAWKIT_MANIFEST_PATH=/path/to/manifest.yaml
```

## 下一步

配置完成后，你可以：
1. 在 OpenClaw 中发送任务到 clawkit
2. 在 Web Console 的「任务」页面查看任务状态
3. 在「项目」页面管理项目配置
4. 在「日志」页面查看系统日志

## 技术支持

如有问题，请查看：
- 项目文档：`docs/` 目录
- 示例配置：`examples/` 目录
- 项目规则：`AGENTS.md`
