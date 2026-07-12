# SoloForge Office OS 接入 clawkit Runtime 指南

## 1. 总体说明

本文档描述 SoloForge Office OS 通过局域网接入 clawkit Controller 的最小安全方式。

当前适配目标是只读健康检查、Worker 列表、TaskDraft 创建、Dispatch Dry-run、Sandbox Dispatch、Dispatch 状态查询与 Worker Result 查询。

## 2. 接入方式

1. 在 SoloForge Office OS 中配置 `controllerBaseUrl`，指向局域网中的 clawkit Controller。
2. 仅通过环境变量名引用 token，例如 `CLAWKIT_CONTROLLER_TOKEN`。
3. 先调用 `/health` 验证连通性，再调用 `/status` 和 `/capabilities` 判断能力范围。
4. 仅允许 sandbox/test Worker 做真实派发。

## 3. 安全边界

1. 不允许生产 Worker 进入真实派发。
2. 不允许高风险任务直接真实派发。
3. TaskDraft 创建只创建草稿，不自动派发。
4. Dispatch Dry-run 只做评估，不执行任务。
5. 所有日志必须脱敏，不能输出真实 token。

## 4. TaskDraft 创建流程

1. SoloForge Office OS 先生成草稿请求。
2. 调用 `POST /task-drafts`。
3. 接收 `remoteDraftId`。
4. 保存草稿映射，不要直接触发 dispatch。

## 5. Dispatch Dry-run 流程

1. 使用 `POST /dispatch/dry-run`。
2. 传入 `remoteDraftId`、`targetWorkerId`、`riskLevel` 等字段。
3. 解析 `eligible`、`blockedReasons`、`workerCandidates`。
4. 若返回 blocked，则不进入真实派发。

## 6. Sandbox Dispatch 流程

1. 先确认目标 Worker 的 `labels.env === "sandbox"` 或 `labels.sandbox === true`。
2. 先把草稿推进到 `approved` 状态。
3. 调用 `POST /dispatch`。
4. 仅允许 sandbox/test Worker。
5. 返回 `dispatchId` 后再查询状态。

## 7. Worker Result 流程

1. 调用 `GET /dispatch/{id}/result`。
2. 若结果尚未生成，返回 `RESULT_PENDING`。
3. 只读取结果，不触发执行。
4. 推荐读取字段包括 `workerName`、`projectKey`、`resultSource`、`updatedAt` 和 `changedFiles`。

## 8. 不允许的生产操作

1. 不允许生产 Worker 的真实派发。
2. 不允许自动 approve。
3. 不允许自动 execute。
4. 不允许 OpenClaw webhook 自动触发 dispatch。
