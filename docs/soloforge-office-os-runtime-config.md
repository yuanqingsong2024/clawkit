# SoloForge Office OS Runtime 配置说明

本文档列出 SoloForge Office OS 接入 clawkit Runtime 时需要填写的配置项、推荐值和安全边界。

## 1. 基础配置

```json
{
  "runtime": "clawkit",
  "controllerBaseUrl": "http://192.168.1.50:8787",
  "authType": "bearer",
  "tokenEnv": "CLAWKIT_CONTROLLER_TOKEN",
  "mode": "sandbox-only"
}
```

### 字段说明

- `runtime`：固定填写 `clawkit`
- `controllerBaseUrl`：clawkit Controller 的局域网地址，必须是 SoloForge Office OS 可直连的地址
- `authType`：推荐填写 `bearer`
- `tokenEnv`：只填写环境变量名，不填写真实 token
- `mode`：推荐填写 `sandbox-only`

## 2. 接口路径配置

```json
{
  "healthEndpoint": "/health",
  "statusEndpoint": "/status",
  "versionEndpoint": "/version",
  "workersEndpoint": "/workers",
  "capabilitiesEndpoint": "/capabilities",
  "taskDraftCreateEndpoint": "/task-drafts",
  "dispatchDryRunEndpoint": "/dispatch/dry-run",
  "sandboxDispatchEndpoint": "/dispatch",
  "dispatchStatusEndpoint": "/dispatch/{id}/status",
  "workerResultEndpoint": "/dispatch/{id}/result"
}
```

### 字段说明

- `healthEndpoint`：健康检查接口
- `statusEndpoint`：运行态接口
- `versionEndpoint`：版本接口
- `workersEndpoint`：Worker 列表接口
- `capabilitiesEndpoint`：能力接口
- `taskDraftCreateEndpoint`：TaskDraft 创建接口
- `dispatchDryRunEndpoint`：Dispatch Dry-run 接口
- `sandboxDispatchEndpoint`：Sandbox Dispatch 接口
- `dispatchStatusEndpoint`：派发状态查询接口
- `workerResultEndpoint`：结果查询接口

## 3. 安全边界配置

```json
{
  "allowTaskDraftCreate": true,
  "allowDispatchDryRun": true,
  "allowSandboxDispatch": true,
  "allowProductionDispatch": false,
  "allowOpenClawWebhook": false
}
```

### 说明

- `allowProductionDispatch` 必须保持 `false`
- `allowOpenClawWebhook` 必须保持 `false`
- `allowSandboxDispatch` 仅允许 sandbox/test Worker

## 4. Worker 标签限制

```json
{
  "allowedWorkerLabels": {
    "env": ["sandbox", "test"],
    "role": ["test-worker"],
    "sandbox": true
  }
}
```

### 说明

- 只有满足上述标签条件的 Worker 才允许真实派发
- 如果 Worker 不带显式标签，clawkit 会根据 name 和 tags 做 sandbox/test 派生判断

## 5. 风险等级限制

```json
{
  "allowedRiskLevels": ["low", "medium"],
  "blockedRiskLevels": ["high", "urgent", "critical"]
}
```

### 说明

- `low`、`medium` 允许进入 sandbox 流程
- `high`、`urgent`、`critical` 必须被拒绝真实派发

## 6. 幂等键约定

```json
{
  "idempotencyKeyStrategy": "stable_hash_of_source_task_id_and_action"
}
```

### 说明

- `idempotencyKey` 应该保持稳定，适合同一条业务请求的重试场景
- 推荐按 `sourceTaskId + action + targetWorkerId + riskLevel` 等稳定字段生成哈希
- 不要每次请求都生成新的随机值，否则无法命中幂等
- `task-drafts` 和 `dispatch` 都应复用同一类幂等键生成策略，但不要跨不同业务动作直接共用同一个随机值

## 7. 完整示例

```json
{
  "runtime": "clawkit",
  "controllerBaseUrl": "http://192.168.1.50:8787",
  "authType": "bearer",
  "tokenEnv": "CLAWKIT_CONTROLLER_TOKEN",
  "mode": "sandbox-only",
  "healthEndpoint": "/health",
  "statusEndpoint": "/status",
  "versionEndpoint": "/version",
  "workersEndpoint": "/workers",
  "capabilitiesEndpoint": "/capabilities",
  "taskDraftCreateEndpoint": "/task-drafts",
  "dispatchDryRunEndpoint": "/dispatch/dry-run",
  "sandboxDispatchEndpoint": "/dispatch",
  "dispatchStatusEndpoint": "/dispatch/{id}/status",
  "workerResultEndpoint": "/dispatch/{id}/result",
  "allowTaskDraftCreate": true,
  "allowDispatchDryRun": true,
  "allowSandboxDispatch": true,
  "allowProductionDispatch": false,
  "allowOpenClawWebhook": false,
  "allowedWorkerLabels": {
    "env": ["sandbox", "test"],
    "role": ["test-worker"],
    "sandbox": true
  },
  "allowedRiskLevels": ["low", "medium"],
  "blockedRiskLevels": ["high", "urgent", "critical"],
  "notes": "真实 token 不写入配置文件，只保存 tokenEnv。"
}
```

## 8. 安全说明

1. 不要把真实 token 写入配置文件。
2. 只保存 `tokenEnv`，真实值由环境变量注入。
3. 不要把生产 Worker 配进真实派发范围。
4. 不要开启 `allowOpenClawWebhook`。
5. 所有路径和字段都应保持可审计、可回滚。
