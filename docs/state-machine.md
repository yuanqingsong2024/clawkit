# controller 状态机

## 1. 文档目标

本文档描述 clawkit 当前实际使用的任务状态与审批动作，以及合法流转规则。

## 2. TaskStatus

当前使用的状态：

- `draft`
- `prompt_generated`
- `waiting_approval`
- `approved`
- `dispatched`
- `running`
- `done`
- `failed`
- `cancelled`

## 3. ApprovalAction

当前支持的审批动作：

- `approve`
- `revise`
- `cancel`
- `view_status`

## 4. 主链路流转

### 4.1 草稿链路

- `draft -> prompt_generated`
- `prompt_generated -> waiting_approval`

### 4.2 审批链路

- `waiting_approval + approve -> approved`
- `prompt_generated|waiting_approval + revise -> draft`
- `draft|prompt_generated|waiting_approval|approved|dispatched|running|failed + cancel -> cancelled`

### 4.3 执行链路

- `approved -> dispatched`
- `dispatched -> running`
- `running -> done`
- `running -> failed`
- `failed -> draft`

## 5. 关键约束

- 只有 `waiting_approval` 允许执行 `approve`
- 已 `approved` 的任务不能直接 `revise`
- 已 `cancelled` 的任务不能再次 `approve`
- 所有非法状态流转都必须返回明确错误

## 6. 设计说明

当前状态机已经支撑真实的派发和执行回查，但仍保持简单：

- 不引入工作流引擎
- 不引入多级审批
- 不引入复杂权限控制

这样可以满足首个 MVP 的可读性与可验证性要求。
