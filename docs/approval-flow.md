# controller 审批流

## 1. 文档目标

本文档说明当前 MVP 的最小审批流程，以及审批与后续派发之间的关系。

## 2. 最小审批链路

```text
创建任务
  -> 生成 PromptDraft
  -> waiting_approval
  -> approve / revise / cancel / view_status
```

### approve

- 前置状态：`waiting_approval`
- 结果：任务进入 `approved`
- 后续：controller 会继续尝试派发到可用 worker

### revise

- 前置状态：`prompt_generated` 或 `waiting_approval`
- 结果：任务回到 `draft`
- 同时重新生成新版 PromptDraft，并再次回到 `waiting_approval`

### cancel

- 结果：任务进入 `cancelled`

### view_status

- 只读动作，不改变状态

## 3. HTTP 入口

当前审批相关 HTTP 接口：

- `POST /api/approval/:taskId/approve`
- `POST /api/drafts/:taskId/revise`
- `POST /api/approval/:taskId/cancel`
- `GET /api/drafts/:taskId/history`
- `GET /api/tasks/:taskId/status`

OpenClaw 侧也可通过 `POST /api/openclaw/webhook` 以文本协议触发同样的审批动作。

## 4. 记录与回查

每次审批动作都会产生 `ApprovalRecord`，并在状态查询时返回：

- 当前状态
- 最近草稿摘要
- 最近审批动作
- 若已进入执行态，则返回执行摘要

## 5. 当前边界

首版审批流只解决“确认是否进入执行”这个问题，不做：

- 多级审批
- 审批权限系统
- 审批通知系统
- Web 审批界面
