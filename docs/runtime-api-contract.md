# clawkit Runtime API 契约

## 0. 统一响应封装

所有 Runtime 接口统一使用以下响应封装：

成功响应：

```json
{
  "success": true,
  "code": "controller.runtime.xxx",
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
  "details": null
}
```

说明：

1. 成功响应里 `code` 用于区分具体接口或具体动作。
2. 失败响应里 `details` 只放可公开的调试信息，不要放真实 token、Cookie、密钥。
3. 所有接口的错误都应保持中文可读。

## 0.1 幂等约定

所有写操作接口统一遵守以下幂等约定：

1. 如果请求携带相同的 `idempotencyKey`，重复调用时应返回同一个业务 ID。
2. 重复请求的响应会包含 `warnings: ["DUPLICATE_REQUEST"]`。
3. 重复请求不会重新创建新的业务记录，也不会重复触发派发或自动执行。
4. 重复请求返回的关键语义字段不得漂移，例如 `dispatchId`、`remoteDraftId`、`workerName`、`acceptedAt`。

## 1. GET /health

说明：用于判断 Controller 是否在线。

请求方法：`GET`

endpoint：`/health`

请求字段：无

响应字段：`success`、`status`、`service`、`version`、`mode`、`timestamp`

错误码：`controller.internal_error`

安全限制：可公开访问；若配置了 token，也可要求鉴权。

示例：

```json
{ "success": true, "status": "ok", "service": "clawkit-controller", "version": "0.1.0", "mode": "controller", "timestamp": "2026-05-28T10:00:00Z" }
```

## 2. GET /status

说明：返回 Runtime 能力状态。

请求方法：`GET`

endpoint：`/status`

请求字段：无

响应字段：`controllerStatus`、`runtimeMode`、`taskDraftCreateEnabled`、`dispatchDryRunEnabled`、`sandboxDispatchEnabled`、`productionDispatchEnabled`、`openclawWebhookEnabled`

错误码：`controller.auth_unauthorized`、`controller.internal_error`

安全限制：配置 token 后需要 Bearer / X-API-Key / X-Auth-Token。

## 3. GET /version

说明：返回版本信息。

请求方法：`GET`

endpoint：`/version`

请求字段：无

响应字段：`name`、`version`、`commit`、`buildTime`

安全限制：同 `/status`。

## 4. GET /capabilities

说明：返回能力矩阵。

请求方法：`GET`

endpoint：`/capabilities`

请求字段：无

响应字段：`capabilities`、`allowedActions`、`forbiddenActions`

安全限制：同 `/status`。

## 5. GET /workers

说明：只读 Worker 列表。

请求方法：`GET`

endpoint：`/workers`

请求字段：无

响应字段：`workers[]`，包含 `labels`、`capabilities`、`supportedExecutors`、`maxConcurrency`、`runningCount`、`lastHeartbeatAt`、`riskPolicy`、`maintenance`

安全限制：只读，不触发任务。

## 6. POST /task-drafts

说明：只创建草稿，不派发。

请求方法：`POST`

endpoint：`/task-drafts`

请求字段：`requestId`、`idempotencyKey`、`title`、`description`、`projectName` 等

响应字段：`remoteDraftId`、`status`、`createdAt`、`warnings`、`rawResponseSummary`

错误码：`controller.duplicate_request`、`controller.invalid_request`

安全限制：不能自动派发。

## 7. POST /dispatch/dry-run

说明：派发预演。

请求方法：`POST`

endpoint：`/dispatch/dry-run`

请求字段：`requestId`、`remoteDraftId`、`targetWorkerId`、`riskLevel`

响应字段：`dryRunId`、`eligible`、`workerCandidates`、`blockedReasons`

安全限制：不执行任务。

## 8. POST /dispatch

说明：sandbox/test Worker 的真实派发。

请求方法：`POST`

endpoint：`/dispatch`

请求字段：`requestId`、`remoteDraftId`、`targetWorkerId`、`riskLevel`

响应字段：`dispatchId`、`remoteDispatchId`、`status`、`workerId`、`workerName`

安全限制：仅 sandbox/test Worker 可用；高风险任务禁止。

## 9. GET /dispatch/{id}/status

说明：查询派发状态。

请求方法：`GET`

endpoint：`/dispatch/{id}/status`

请求字段：路径参数 `id`

响应字段：`status`、`progress`、`resultSummary`、`errorMessage` 等

## 10. GET /dispatch/{id}/result

说明：只读查询结果。

请求方法：`GET`

endpoint：`/dispatch/{id}/result`

请求字段：路径参数 `id`

响应字段：`outputSummary`、`changedFiles`、`logs`、`artifacts`、`exitCode`、`duration`

错误码：`controller.result_pending`

安全限制：只读，不触发执行。

推荐返回字段：

- `dispatchId`
- `taskId`
- `remoteDraftId`
- `workerId`
- `workerName`
- `projectKey`
- `status`
- `outputSummary`
- `changedFiles`
- `logs`
- `artifacts`
- `exitCode`
- `duration`
- `resultSource`
- `updatedAt`
- `errorMessage`

示例：

```json
{
  "success": true,
  "data": {
    "dispatchId": "dispatch_001",
    "taskId": "task_001",
    "remoteDraftId": "draft_task_001",
    "workerId": "worker-sandbox-001",
    "workerName": "sandbox-opencode-worker",
    "projectKey": "clawkit",
    "status": "completed",
    "outputSummary": "任务已完成，生成测试文档。",
    "changedFiles": ["docs/test-output.md"],
    "logs": [
      {
        "level": "info",
        "message": "worker completed sandbox task",
        "timestamp": "2026-05-28T10:03:00Z"
      }
    ],
    "artifacts": [
      {
        "type": "markdown",
        "path": "docs/test-output.md"
      }
    ],
    "exitCode": 0,
    "duration": 120,
    "resultSource": "runtime-memory",
    "updatedAt": "2026-05-28T10:03:00Z",
    "errorMessage": null
  }
}
```

## 11. POST /dispatch/{id}/cancel

说明：当前版本仅保留接口契约。

请求方法：`POST`

endpoint：`/dispatch/{id}/cancel`

请求字段：`requestId`、`reason`

响应字段：`success=false`、`code=controller.cancel_unsupported`

安全限制：当前不支持真实取消。

错误响应与其他 Runtime 接口保持一致，统一使用 `{ success: false, code, message, details }`。

## 12. 错误码总表

| 错误码 | 场景 | 说明 |
|---|---|---|
| `controller.auth_unauthorized` | 认证失败 | 缺少 token 或 token 不正确 |
| `controller.invalid_request` | 请求参数错误 | 必填字段缺失或参数不合法 |
| `controller.invalid_task_status_transition` | 状态流转错误 | 未审批任务直接真实派发，或其他非法状态流转 |
| `controller.worker_not_found` | Worker 不存在 | 目标 Worker 未注册或不匹配 |
| `controller.result_pending` | 结果未就绪 | dispatch 已创建，但结果尚未生成 |
| `controller.cancel_unsupported` | 取消接口未实现 | 当前版本仅保留取消接口契约 |
| `controller.duplicate_request` | 幂等冲突 | 相同 `idempotencyKey` 重复请求 |
