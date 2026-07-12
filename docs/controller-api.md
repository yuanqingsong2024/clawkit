# Controller HTTP API

## 1. 文档目标

本文档描述当前 MVP 已经对外提供的 controller HTTP API。

## 2. 当前已实现范围

- 任务文本接入
- OpenClaw webhook 接入
- 草稿生成、修改、取消、确认
- 任务状态查询
- worker 注册、心跳、pull、result
- 派发记录查询

## 3. 统一响应结构

成功响应：

```json
{
  "success": true,
  "code": "controller.xxx",
  "message": "中文说明",
  "data": {}
}
```

失败响应：

```json
{
  "success": false,
  "code": "controller.xxx",
  "message": "中文错误说明",
  "details": {}
}
```

## 4. 路由分组

| 分组 | 前缀 | 说明 |
|---|---|---|
| openclaw | `/api/openclaw` | OpenClaw webhook |
| tasks | `/api/tasks` | 任务创建、兼容入口、状态查询 |
| drafts | `/api/drafts` | 草稿修改与历史 |
| approval | `/api/approval` | 审批确认与取消 |
| workers | `/api/workers` | worker 注册、心跳、pull、result |
| dispatches | `/api/dispatches` | 派发记录 |
| health | `/api/health` | 健康检查 |

## 5. 核心接口

### 5.1 创建任务

- `POST /api/tasks`

请求体：

```json
{
  "text": "#研发任务\n项目: clawkit\n目标: 补齐发布前文档\n约束: 全部中文\n验收: 文档与实现一致"
}
```

说明：创建 `TaskDraft`、初始化 `TaskMemory`、生成首版 `PromptDraft`，最终状态进入 `waiting_approval`。

### 5.2 OpenClaw webhook

- `POST /api/openclaw/webhook`

请求体：

```json
{
  "source": "openclaw",
  "message": "#研发任务\n项目: clawkit\n目标: 验收 MVP\n约束: 全部中文\n验收: 单机链路可运行",
  "operator": { "id": "demo-user", "name": "演示用户" },
  "sessionKey": "demo-session"
}
```

请求头：

```http
Authorization: Bearer <OPENCLAW_WEBHOOK_TOKEN>
```

说明：这是当前推荐主入口。controller 会自动识别创建、确认、修改、取消、查询状态五类协议。

### 5.3 兼容旧入口

- `POST /api/tasks/from-openclaw`

说明：保留兼容，但新接入建议统一使用 `/api/openclaw/webhook`。

### 5.4 查询任务状态

- `GET /api/tasks/:taskId/status`

返回内容包含：

- 当前状态
- 最新草稿摘要
- 最近审批动作
- 若已进入执行态，则返回 `executionSummary`

### 5.5 修改草稿

- `POST /api/drafts/:taskId/revise`

### 5.6 查询草稿历史

- `GET /api/drafts/:taskId/history`

### 5.7 审批确认

- `POST /api/approval/:taskId/approve`

说明：

1. 先把任务从 `waiting_approval` 推进到 `approved`
2. 然后尝试继续派发到可用 worker
3. 若没有可用 worker，会停留在 `approved` 并返回可读错误摘要

### 5.8 取消任务

- `POST /api/approval/:taskId/cancel`

### 5.9 worker 接口

- `POST /api/workers/register`
- `POST /api/workers/:workerId/heartbeat`
- `GET /api/workers/:workerId/pull`
- `POST /api/workers/:workerId/result`
- `GET /api/workers`
- `GET /api/workers/:workerId`

### 5.10 派发接口

- `POST /api/dispatches`
- `GET /api/dispatches/:taskId`
- `GET /api/dispatches/task/:taskId`
- `GET /api/dispatches`

## 6. 状态语义

当前状态集合：

- `draft`
- `prompt_generated`
- `waiting_approval`
- `approved`
- `dispatched`
- `running`
- `done`
- `failed`
- `cancelled`

## 7. 关键错误

- `controller.invalid_task_protocol`
- `controller.task_protocol_field_missing`
- `controller.invalid_approval_action`
- `controller.invalid_task_status_transition`
- `controller.no_available_worker`
- `controller.task_not_found`
- `controller.workers.not_found`
- `controller.dispatches.not_found`
