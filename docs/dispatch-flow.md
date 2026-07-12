# 任务派发流程

## 1. 文档目标

本文档描述当前 MVP 中从 `approved` 到 worker 执行并回传结果的完整最小链路。

## 2. 已实现能力

- `approved` 任务派发
- worker 选择
- `DispatchRecord` 记录与查询
- worker `pull` 拉取任务
- `OpenCodeExecutor` 主执行路径
- `PlaceholderExecutor` 回退路径
- 结果回传与状态更新

## 3. 主流程

### 3.1 审批通过后派发

```text
waiting_approval
  -> approve
  -> approved
  -> DispatchService.dispatchTask()
  -> dispatched
```

### 3.2 worker 拉取任务

```text
worker pull
  -> controller 返回任务卡片
  -> DispatchRecord = accepted
  -> TaskStatus = running
```

### 3.3 执行

默认优先走：

1. `OpenCodeExecutor`
2. 若 OpenCode 不可达且开启 `WORKER_PLACEHOLDER_FALLBACK=true`，回退到 `PlaceholderExecutor`

### 3.4 结果回传

```text
worker result
  -> controller.submitResult()
  -> TaskStatus = done | failed
  -> TaskMemory.executionSummary 更新
  -> worker 状态回到 idle
```

## 4. worker 选择策略

当前策略保持最小化：

1. 只在 `idle` 且心跳未超时的 worker 中选择
2. 优先匹配 `supportedProjects` 中包含目标 `projectKey` 的 worker
3. 若没有精确匹配，再尝试 `*`

## 5. 关键接口

- `POST /api/dispatches`
- `GET /api/dispatches/:taskId`
- `GET /api/workers/:workerId/pull`
- `POST /api/workers/:workerId/result`
- `GET /api/tasks/:taskId/status`

## 6. 当前边界

当前阶段仍然明确不做：

- push 模式派发
- 多 worker 复杂并发调度
- 任务队列系统
- 分布式持久化调度

## 7. 结果判读

- `placeholderExecution=false`：表示真实走过 OpenCode 主路径
- `placeholderExecution=true`：表示当前是回退链路成功，用于验证链路打通
- `parseStatus=parse_failed`：表示执行失败或结果解析失败，应查看 `structuredError` 与日志
