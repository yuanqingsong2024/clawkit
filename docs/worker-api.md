# Worker API 文档

## 1. 基础信息

推荐示例 Base URL：

```text
http://127.0.0.1:8787/api
```

统一响应结构：

```json
{
  "success": true,
  "code": "controller.xxx",
  "message": "中文说明",
  "data": {}
}
```

## 2. Worker 接口

### 2.1 注册

- `POST /api/workers/register`

### 2.2 心跳

- `POST /api/workers/:workerId/heartbeat`

### 2.3 拉取任务

- `GET /api/workers/:workerId/pull`

有任务时返回的 `task` 至少包含：

- `taskId`
- `projectKey`
- `repoPath`
- `branchBase`
- `openCode`
- `intent`
- `constraints`
- `acceptanceCriteria`
- `sourceText`
- `status`
- `executionPrompt`
- `outputContract`
- `executionBoundary`

### 2.4 提交结果

- `POST /api/workers/:workerId/result`

当前结果结构支持：

- `status`: `done | failed`
- `summary`
- `placeholderExecution`
- `logs`
- `changedFiles`
- `commands`
- `testResult`
- `rawOutputSummary`
- `parseStatus`
- `structuredError`
- `sessionId`
- `risks`
- `nextStageHint`
- `updatedAt`

其中：

- `placeholderExecution=false`：真实走过 OpenCode 主路径
- `placeholderExecution=true`：当前为回退链路

### 2.5 查询 worker

- `GET /api/workers`
- `GET /api/workers/:workerId`

## 3. 派发接口

### 3.1 发起派发

- `POST /api/dispatches`

### 3.2 查询派发

- `GET /api/dispatches/:taskId`
- `GET /api/dispatches/task/:taskId`
- `GET /api/dispatches`

## 4. 状态语义

### WorkerStatus

- `idle`
- `busy`
- `offline`

### DispatchStatus

- `dispatched`
- `accepted`

### ConnectMode

当前首版支持：

- `pull`

`push` 仍保留为后续扩展方向，但当前仓库不作为已支持能力对外承诺。

## 5. 最小调用顺序

```text
register
  -> heartbeat
  -> pull
  -> execute
  -> result
```

## 6. 常见错误

- `controller.workers.not_found`
- `controller.task_not_found`
- `controller.no_available_worker`
- `controller.dispatches.not_found`
