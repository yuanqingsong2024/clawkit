# ClawKit Web API 文档

## API 概览

ClawKit Controller 提供统一的 HTTP API，供 Web Console 和其他客户端调用。

**Base URL**: `http://localhost:8787/api`（默认）

**统一响应格式**：
```typescript
// 成功响应
{
  "success": true,
  "code": "controller.xxx.xxx",
  "message": "操作成功",
  "data": { ... }
}

// 失败响应
{
  "success": false,
  "code": "controller.xxx.xxx",
  "message": "错误信息",
  "details": { ... }
}
```

## 系统管理 API

### 1. 获取系统总览
```
GET /api/overview
```

**响应数据**：
```typescript
{
  profile: {
    name: string;
    topology: string;
    description?: string;
  };
  manifestPath: string | null;
  controller: {
    status: 'online';
    apiPrefix: string;
    publicUrl: string;
    runtimeNotice: string;
  };
  workers: {
    total: number;
    online: number;
    idle: number;
    busy: number;
    offline: number;
    items: WorkerRecord[];
  };
  openClaw: {
    configured: boolean;
    publicUrl: string;
    tokenConfigured: boolean;
    detail: string;
  };
  openCode: OpenCodeStatusSummary[];
  latestDoctor: SystemActionResult<DoctorReport> | null;
  latestPlan: SystemActionResult<DryRunPlan> | null;
  latestApply: SystemActionResult<ApplyResult> | null;
  latestHeal: SystemActionResult<HealResult> | null;
  recentTasks: TaskListItem[];
  recentDispatches: DispatchRecord[];
  alerts: OverviewAlert[];
}
```

### 2. 获取 Manifest
```
GET /api/manifest
```

**响应数据**：
```typescript
{
  manifestPath: string;
  yamlText: string;
  manifest: Manifest;
  savedAt: Date;
  runtimeNotice: string;
}
```

### 3. 保存 Manifest
```
PUT /api/manifest
Content-Type: application/json

{
  "yamlText": "profile:\n  name: ..."
}
```

**响应数据**：同 GET /api/manifest

**注意**：
- 保存后不会自动刷新运行态
- 需要重启 controller/worker 才能生效

### 4. 执行 Doctor
```
POST /api/system/doctor
```

**响应数据**：
```typescript
{
  action: 'doctor';
  dryRun: true;
  status: 'success' | 'warning' | 'failed';
  summary: string;
  steps: SystemActionStep[];
  logs: string[];
  nextStep: string;
  startedAt: Date;
  finishedAt: Date;
  data: DoctorReport | null;
}
```

### 5. 执行 Plan
```
POST /api/system/plan
```

**响应数据**：同 Doctor 格式，data 为 DryRunPlan

### 6. 执行 Apply
```
POST /api/system/apply
Content-Type: application/json

{
  "dryRun": true,           // 默认 true，预览模式
  "onlyLocal": false,       // 默认 false，是否只处理本地节点
  "confirmExecution": false // 真实执行时必须为 true
}
```

**响应数据**：同 Doctor 格式，data 为 ApplyResult

**注意**：
- 默认 `dryRun=true`，只预览不执行
- 真实执行需 `dryRun=false` 且 `confirmExecution=true`

### 7. 执行 Heal
```
POST /api/system/heal
Content-Type: application/json

{
  "dryRun": true,           // 默认 true，诊断模式
  "confirmExecution": false // 真实执行时必须为 true
}
```

**响应数据**：同 Doctor 格式，data 为 HealResult

## 任务管理 API

### 8. 获取任务列表
```
GET /api/tasks
```

**响应数据**：
```typescript
{
  tasks: TaskListItem[];
  total: number;
}
```

### 9. 创建任务
```
POST /api/tasks
Content-Type: application/json

{
  "text": "#研发任务\n项目: clawkit\n目标: ..."
}
```

**响应数据**：
```typescript
{
  taskDraft: TaskDraft;
  taskMemory: TaskMemory;
  promptDraft: PromptDraft;
}
```

### 10. 获取任务详情
```
GET /api/tasks/:taskId
```

**响应数据**：
```typescript
{
  taskDraft: TaskDraft;
  taskMemory: TaskMemory;
  promptDrafts: PromptDraft[];
  approvalRecords: ApprovalRecord[];
  statusSnapshot: TaskStatusSnapshot;
}
```

### 11. 获取任务状态
```
GET /api/tasks/:taskId/status
```

**响应数据**：TaskStatusSnapshot

### 12. 修改草案
```
POST /api/drafts/:taskId/revise
Content-Type: application/json

{
  "operator": "操作人",
  "revisionText": "修改意见"
}
```

**响应数据**：
```typescript
{
  taskId: string;
  status: TaskStatus;
  draftVersion: PromptDraftVersion;
  draftSummary: PromptDraftSummaryView;
  revisionRecorded: true;
  nextStageHint: string;
}
```

### 13. 确认派发
```
POST /api/approval/:taskId/approve
Content-Type: application/json

{
  "operator": "操作人",
  "comment": "确认理由"
}
```

**响应数据**：
```typescript
{
  taskId: string;
  status: TaskStatus;
  latestApprovalAction: ApprovalRecord;
  nextStageHint: string;
}
```

### 14. 取消任务
```
POST /api/approval/:taskId/cancel
Content-Type: application/json

{
  "operator": "操作人",
  "comment": "取消理由"
}
```

**响应数据**：同确认派发格式

### 15. 获取草稿历史
```
GET /api/drafts/:taskId/history
```

**响应数据**：
```typescript
{
  taskId: string;
  versions: DraftHistoryVersionView[];
  latestVersion: PromptDraftVersion;
  latestSummary: PromptDraftSummaryView;
}
```

## Worker 管理 API

### 16. 注册 Worker
```
POST /api/workers/register
Content-Type: application/json

{
  "workerId": "worker-1",
  "name": "Worker 1",
  "nodeName": "local",
  "connectMode": "pull",
  "tags": ["clawkit"],
  "supportedProjects": ["clawkit"]
}
```

**响应数据**：WorkerRecord

### 17. Worker 心跳
```
POST /api/workers/:workerId/heartbeat
Content-Type: application/json

{
  "status": "idle",
  "currentTaskId": null
}
```

**响应数据**：WorkerRecord

### 18. 获取 Worker 列表
```
GET /api/workers
```

**响应数据**：
```typescript
{
  workers: WorkerRecord[];
  total: number;
}
```

### 19. 获取 Worker 详情
```
GET /api/workers/:workerId
```

**响应数据**：WorkerRecord

### 20. Worker 拉取任务
```
POST /api/workers/:workerId/pull
```

**响应数据**：WorkerPullTaskResponse

### 21. Worker 提交结果
```
POST /api/workers/:workerId/submit
Content-Type: application/json

{
  "taskId": "task-xxx",
  "status": "done",
  "summary": "执行摘要",
  ...
}
```

**响应数据**：
```typescript
{
  success: true;
  message: string;
}
```

## Dispatch 管理 API

### 22. 创建派发
```
POST /api/dispatches
Content-Type: application/json

{
  "taskId": "task-xxx"
}
```

**响应数据**：DispatchRecord

### 23. 获取派发记录
```
GET /api/dispatches/:taskId
```

**响应数据**：DispatchRecord

### 24. 获取派发列表
```
GET /api/dispatches
```

**响应数据**：
```typescript
{
  dispatches: DispatchRecord[];
  total: number;
}
```

## 健康检查 API

### 25. 健康检查
```
GET /api/health
```

**响应数据**：
```typescript
{
  status: 'ok';
  timestamp: Date;
}
```

## 错误码

常见错误码：
- `controller.task_not_found`: 任务不存在
- `controller.invalid_task_status_transition`: 非法状态流转
- `controller.no_available_worker`: 无可用 worker
- `controller.project_config_not_found`: 项目配置未找到
- `controller.worker_not_found`: Worker 未注册
- `controller.invalid_approval_action`: 非法审批动作
- `controller.task_protocol_field_missing`: 协议字段缺失
- `controller.task_protocol_field_invalid`: 协议字段无效

## 注意事项

1. **Manifest 变更不会自动生效**：需要重启相关进程
2. **Apply/Heal 默认为预览模式**：真实执行需显式确认
3. **API 前缀固定为 /api**：与 manifest 中的 apiPrefix 配置无关
4. **所有时间字段为 ISO 8601 格式**
5. **Worker 心跳超时时间为 30 秒**
