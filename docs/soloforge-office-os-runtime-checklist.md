# SoloForge Office OS Runtime 接入清单

本文档用于 SoloForge Office OS 从零接入 clawkit Runtime 时逐项勾选。

## 1. 连接前准备

- [ ] 已确认 clawkit Controller 的局域网 IP 和端口
- [ ] 已确认 SoloForge Office OS 能访问该地址
- [ ] 已确认防火墙放行对应端口
- [ ] 已确认 `CLAWKIT_CONTROLLER_TOKEN` 已在运行环境中配置
- [ ] 已确认真实 token 没有写入任何配置文件

## 2. 配置填写

- [ ] `runtime` 设置为 `clawkit`
- [ ] `controllerBaseUrl` 填写为局域网地址
- [ ] `authType` 设置为 `bearer`
- [ ] `tokenEnv` 设置为 `CLAWKIT_CONTROLLER_TOKEN`
- [ ] `mode` 设置为 `sandbox-only`
- [ ] `allowProductionDispatch` 设置为 `false`
- [ ] `allowOpenClawWebhook` 设置为 `false`
- [ ] `idempotencyKeyStrategy` 已配置为稳定哈希策略

## 3. 接口连通性检查

- [ ] `GET /health` 返回 200
- [ ] `GET /status` 返回 Runtime 状态
- [ ] `GET /version` 返回版本信息
- [ ] `GET /capabilities` 返回能力矩阵
- [ ] `GET /workers` 能返回 Worker 列表

## 4. Worker 检查

- [ ] 已至少注册一个 sandbox/test Worker
- [ ] Worker labels 包含 `env=sandbox` 或 `sandbox=true`
- [ ] Worker labels 包含 `role=test-worker`
- [ ] Worker 没有被配置成生产派发目标

## 5. TaskDraft 流程检查

- [ ] `POST /task-drafts` 能成功创建草稿
- [ ] `idempotencyKey` 在重试时保持稳定
- [ ] 返回 `remoteDraftId`
- [ ] 创建草稿后不会自动派发
- [ ] `GET /api/tasks/:taskId/status` 能看到 `waiting_approval`

## 6. Dry-run 检查

- [ ] `POST /dispatch/dry-run` 能返回 `eligible` / `blocked`
- [ ] `blockedReasons` 能清晰说明阻断原因
- [ ] 高风险任务会被拒绝
- [ ] 目标 Worker 不符合 sandbox/test 条件时会被拒绝

## 7. Sandbox Dispatch 检查

- [ ] 任务已进入 `approved` 状态
- [ ] `POST /dispatch` 只允许 sandbox/test Worker
- [ ] `idempotencyKey` 在重试时保持稳定
- [ ] 未审批任务会被拒绝
- [ ] 高风险任务会被拒绝
- [ ] 返回 `dispatchId`

## 8. 结果查询检查

- [ ] `GET /dispatch/{id}/status` 可查询派发状态
- [ ] `GET /dispatch/{id}/result` 可查询结果
- [ ] `GET /workers/{workerId}/result?dispatchId=` 可兼容查询
- [ ] 结果里包含 `workerName`、`projectKey`、`resultSource`、`updatedAt`

## 9. 取消接口检查

- [ ] 已确认 `POST /dispatch/{id}/cancel` 返回 `controller.cancel_unsupported`
- [ ] 已确认当前版本不做真实取消

## 10. 安全检查

- [ ] 所有 token 只通过环境变量注入
- [ ] 日志没有输出真实 token
- [ ] 生产 Worker 没有参与真实派发
- [ ] OpenClaw webhook 没有开启自动触发 dispatch
- [ ] 所有错误返回都保持中文可读
