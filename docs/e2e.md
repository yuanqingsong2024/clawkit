# 端到端联调说明

---

> ## ⚠️ 验收边界说明（必读）
> 
> **当前仓库提供两种验收模式，请务必区分：**
> 
> | 验收模式 | 脚本 | 验证内容 | 是否验证真实 OpenCode |
> |---------|------|---------|---------------------|
> | **链路验证** | `node ./scripts/e2e-local-demo.js` | 验证 controller/worker/webhook 链路打通 | ❌ 否（允许 placeholder fallback） |
> | **真实执行验证** | 手工操作（见 3.2 节） | 验证真实 OpenCode 执行能力 | ✅ 是（必须 `placeholderExecution=false`） |
> 
> **关键结论**：
> - ✅ `e2e-local-demo.js` 通过 = 链路打通
> - ❌ `e2e-local-demo.js` 通过 ≠ 真实 OpenCode 执行已验收
> - ✅ 真实执行验收必须手工启动 `opencode serve` 并关闭 fallback

---

## 1. 文档目的

本文只描述当前阶段已经具备的**最小可验证联调路径**，不引入新架构，也不扩展复杂部署能力。

当前阶段分两类联调：

1. **链路联调**：验证 `OpenClaw webhook -> controller -> worker -> result -> 状态查询` 整条链路打通。
2. **真实执行联调**：在链路联调基础上，要求 worker 真实连接本机 OpenCode server，不允许 placeholder fallback 掩盖问题。

---

## 2. 单机模式联调

### 2.1 目标

验证以下能力是否同时成立：

- controller 可以接收 OpenClaw webhook
- worker 可以完成注册、心跳、pull、result 回传
- controller 可以完成草稿创建、确认派发、状态回查
- 任务最终会进入 `done` 或 `failed`，且状态摘要可读

### 2.2 当前仓库内置演示脚本

仓库自带：

```bash
node ./scripts/e2e-local-demo.js
```

该脚本的定位是：

- **验证最小链路打通**
- 自动启动本地 controller 与 worker
- 自动发送 webhook 创建任务并确认派发
- 自动轮询状态直到任务结束

> 注意：该脚本当前默认开启 `fallbackToPlaceholder: true`。
> 因此它能证明“单机链路可用”，但不能单独证明“真实 OpenCode 执行已经被本机环境成功验证”。

### 2.3 实际执行结果判定

- 返回 `done`，且日志中可看到 worker 完成回传：说明**最小链路联调通过**。
- 如果最终摘要包含“占位执行完成”：说明当前是 **placeholder fallback 成功**，不是严格真实执行。

---

## 3. 单机模式严格真实执行联调

### 3.1 前置条件

必须先满足以下条件：

1. 本机已安装并可执行 `opencode`
2. 本机已启动 OpenCode server
3. worker 配置中关闭 placeholder fallback
4. manifest 中 `repoPath` 指向真实存在的仓库目录

### 3.2 启动 OpenCode server

```bash
export OPENCODE_SERVER_USERNAME="opencode"
export OPENCODE_SERVER_PASSWORD="your-password"
opencode serve --hostname 127.0.0.1 --port 4096
```

### 3.3 启动 controller

```bash
export CLAWKIT_MANIFEST_PATH="$(pwd)/examples/all-in-one.yaml"
export OPENCLAW_WEBHOOK_TOKEN="replace-me"
pnpm --filter @clawkit/controller start
```

### 3.4 启动 worker

```bash
export CLAWKIT_MANIFEST_PATH="$(pwd)/examples/all-in-one.yaml"
export CONTROLLER_URL="http://127.0.0.1:8787"
export WORKER_ID="local-worker"
export WORKER_SUPPORTED_PROJECTS="site-web"
export OPENCODE_EXECUTION_MODE="sdk"
export OPENCODE_SERVER_BASE_URL="http://127.0.0.1:4096"
export OPENCODE_SERVER_PASSWORD_ENV="OPENCODE_SERVER_PASSWORD"
export WORKER_PLACEHOLDER_FALLBACK="false"
pnpm --filter @clawkit/worker start
```

### 3.5 触发最小任务

向 `/api/openclaw/webhook` 发送创建任务请求，再发送 `#确认派发 <taskId>`。

### 3.6 通过标准

必须同时满足：

- `GET /api/tasks/:taskId/status` 最终返回 `done`
- `executionSummary.placeholderExecution` 为 `false`
- `executionSummary.sessionId` 有真实值，或日志中可见真实 OpenCode 调用痕迹
- 失败时返回结构化失败信息，而不是静默成功

若 `placeholderExecution=true`，则说明当前仍是回退路径，不应算作“真实执行联调通过”。

---

## 4. 混合模式联调

### 4.1 当前阶段支持范围

混合模式当前阶段的目标是：

- controller 与 OpenClaw 部署在云端节点
- worker 与 OpenCode 部署在本地节点
- `apply` 负责最小文件写入
- 远程节点的代码同步、systemd 安装与服务启动仍需人工完成

### 4.2 推荐验证顺序

1. 使用 `examples/hybrid.yaml` 执行 `clawkit apply`
2. 在云端节点确认已写入 `controller.env`、`openclaw.json` 与 controller service 文件
3. 在本地节点确认已写入 worker env、OpenCode launch 文件
4. 手工完成云端代码同步与 service 安装
5. 在本地启动 `opencode serve`
6. 在本地启动 worker
7. 从 OpenClaw 或 curl 向云端 controller webhook 发起任务

### 4.3 当前阶段通过标准

满足以下条件即可认定“混合模式联调说明已具备 MVP 可用度”：

- examples 提供完整示例配置
- `apply` 文档明确说明本地与 SSH 节点的边界
- 文档明确说明哪些步骤自动完成、哪些步骤需要人工完成

> 当前阶段并未提供“一键混合模式联调脚本”，这是有意保留的边界，而不是遗漏实现。

---

## 5. 常见失败与判断方法

### 5.1 OpenClaw token 未配置

现象：webhook 返回 401 或 503。

处理：检查 `OPENCLAW_WEBHOOK_TOKEN` 与请求头 `Authorization: Bearer <token>`。

### 5.2 worker 已启动但拉不到任务

现象：worker 持续心跳，但 `pull` 一直返回 `hasTask=false`。

处理：检查任务是否已经进入 `approved/dispatched`，以及 worker 是否支持对应 `projectKey`。

### 5.3 OpenCode 不可达

现象：任务失败，错误摘要提示 `opencode serve`。

处理：检查 `OPENCODE_SERVER_BASE_URL`、端口、用户名/密码环境变量与 fallback 配置。

### 5.4 为什么 E2E 通过但不算真实执行通过

因为当前内置 demo 脚本允许 placeholder fallback。它只能证明“链路打通”，不能替代“真实 OpenCode 环境可用”的严格验收。
