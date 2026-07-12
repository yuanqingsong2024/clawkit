# 最小使用手册

## 1. 环境准备

### 1.1 基础环境

- Node.js >= 20
- pnpm >= 8
- 已安装项目依赖：`pnpm install`
- 已完成构建：`pnpm build`

### 1.2 可选环境

若要验证真实 OpenCode 执行，还需要：

- 本机可执行 `opencode`
- 已设置 OpenCode 认证环境变量
- 本机可启动 `opencode serve`

## 2. 启动步骤

### 2.1 选择配置文件

可直接使用仓库示例，推荐优先从简化配置开始：

- 简化单机模式：`examples/simple.yaml`
- 最小配置：`examples/minimal.yaml`
- 混合模式：`examples/hybrid.yaml`
- 双机模式：`examples/split.yaml`

### 2.2 构建项目

```bash
pnpm install
pnpm build
```

### 2.3 启动 Controller

```bash
export CLAWKIT_MANIFEST_PATH="$(pwd)/examples/simple.yaml"
export OPENCLAW_WEBHOOK_TOKEN="replace-me"
pnpm --filter @clawkit/controller start
```

默认地址：`http://127.0.0.1:8787`

### 2.4 启动 Worker

#### 方式 A：先验证链路打通（允许占位回退）

```bash
./scripts/start-local.sh worker-placeholder
```

#### 方式 B：严格验证真实 OpenCode 执行

```bash
export OPENCODE_SERVER_PASSWORD="your-password"
./scripts/start-local.sh worker-opencode
```

### 2.5 最小单机联调

若只验证最小链路，可以直接运行：

```bash
node ./scripts/e2e-local-demo.js
```

## 3. OpenClaw 配置方式

最小示例：

```json
{
  "name": "clawkit-local",
  "controller": {
    "endpoint": "http://127.0.0.1:8787/api/openclaw/webhook",
    "token": "replace-me"
  },
  "webhook": {
    "enabled": true,
    "source": "openclaw"
  }
}
```

关键点：

- endpoint 指向 controller 的 `/api/openclaw/webhook`
- token 需要与 `OPENCLAW_WEBHOOK_TOKEN` 保持一致
- 请求头使用 `Authorization: Bearer <token>`

## 4. OpenCode 启动方式

### 4.1 设置环境变量

```bash
export OPENCODE_SERVER_USERNAME="opencode"
export OPENCODE_SERVER_PASSWORD="your-password"
```

### 4.2 启动服务

```bash
opencode serve --hostname 127.0.0.1 --port 4096
```

### 4.3 Worker 关键环境变量

```bash
export CONTROLLER_URL="http://127.0.0.1:8787"
export WORKER_ID="local-worker"
export WORKER_SUPPORTED_PROJECTS="clawkit"
export OPENCODE_EXECUTION_MODE="sdk"
export OPENCODE_SERVER_BASE_URL="http://127.0.0.1:4096"
export OPENCODE_SERVER_PASSWORD_ENV="OPENCODE_SERVER_PASSWORD"
export WORKER_PLACEHOLDER_FALLBACK="false"
```

## 5. Web Console 使用方式

### 5.1 开发模式

```bash
pnpm --filter @clawkit/web dev
```

访问地址：`http://localhost:5173`

### 5.2 生产构建

```bash
pnpm --filter @clawkit/web build
```

### 5.3 内部试运行推荐方式

推荐直接让 controller 托管 Web Console 静态文件：

```bash
export WEB_CONSOLE_DIST_DIR="$(pwd)/packages/web/dist"
pnpm --filter @clawkit/controller start
```

说明：

- `/api/*` 请求继续走 controller API
- 其他前端路由由 controller 返回静态资源或 `index.html`

## 6. 任务创建与确认流程

### 6.1 创建任务

可通过 OpenClaw webhook 或直接调用 API 创建任务。

最小请求示例：

```json
{
  "source": "openclaw",
  "message": "#研发任务\n项目: clawkit\n目标: 补齐发布文档\n约束: 全部中文\n验收: 文档与实现一致",
  "operator": {
    "id": "demo-user",
    "name": "演示用户"
  },
  "sessionKey": "demo-1"
}
```

### 6.2 查看草稿与状态

- `GET /api/tasks/:taskId/status`
- Web Console 的任务中心页也可查看任务详情、草稿与执行摘要

### 6.3 确认派发

确认方式：

- API：`POST /api/approval/:taskId/approve`
- OpenClaw 文本协议：`#确认派发 <taskId>`
- Web Console：任务详情页点击确认派发

### 6.4 执行与结果回查

确认派发后，任务会按以下路径推进：

`waiting_approval -> approved -> dispatched -> running -> done/failed`

回查入口：

- API：`GET /api/tasks/:taskId/status`
- Web Console：任务中心 / 状态页

## 7. 常见问题

### 7.1 为什么 E2E 脚本通过了，但不能说明真实 OpenCode 已验证？

因为当前 `e2e-local-demo.js` 默认允许 `placeholder fallback`。它可以证明链路打通，但不能替代真实 OpenCode 环境验收。

### 7.2 Worker 已启动，但一直拉不到任务怎么办？

重点检查：

- 任务是否已经确认派发
- `WORKER_SUPPORTED_PROJECTS` 是否包含目标 `projectKey`
- 当前 worker 是否已注册且状态为 `idle`

### 7.3 OpenClaw webhook 返回 401 或 503 怎么办？

检查：

- `OPENCLAW_WEBHOOK_TOKEN` 是否已设置
- 请求头 `Authorization: Bearer <token>` 是否正确

### 7.4 Web Console 打开后页面路由 404 怎么办？

说明生产静态文件服务没有正确启用 SPA fallback。当前推荐直接使用 controller 托管 `packages/web/dist`，或在反向代理中配置 `try_files $uri $uri/ /index.html`。

### 7.5 Manifest 保存后为什么运行态没有立刻变化？

因为保存 manifest 只是写入文件。要让新配置生效，需要重启 controller、worker，必要时也要重启 OpenCode 服务。
