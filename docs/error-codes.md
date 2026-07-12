# ClawKit 错误码文档

> 版本：v0.2.0 | 更新日期：2026-07-09

---

## 概述

本文档定义了 ClawKit Controller 的所有错误码，每个错误码包含：
- **错误码**：唯一标识符（格式：`controller.<category>_<name>`）
- **标题**：简短的用户友好描述
- **说明**：详细的问题描述
- **建议**：用户可以采取的解决措施

---

## 错误码索引

### 任务相关 (Task)

| 错误码 | 标题 | HTTP 状态 | 严重程度 |
|--------|------|-----------|----------|
| `controller.task_draft_not_found` | 任务草稿不存在 | 404 | 中 |
| `controller.task_memory_not_found` | 任务记忆不存在 | 404 | 低 |
| `controller.task_not_found` | 任务不存在 | 404 | 中 |
| `controller.invalid_task_status_transition` | 任务状态转换非法 | 400 | 中 |
| `controller.cancel_unsupported` | 不支持取消 | 400 | 低 |

### 协议相关 (Protocol)

| 错误码 | 标题 | HTTP 状态 | 严重程度 |
|--------|------|-----------|----------|
| `controller.invalid_task_protocol` | 任务协议格式错误 | 400 | 高 |
| `controller.task_protocol_field_missing` | 任务协议缺少必填字段 | 400 | 高 |
| `controller.task_protocol_field_invalid` | 任务协议字段值无效 | 400 | 中 |

### 草稿相关 (Draft)

| 错误码 | 标题 | HTTP 状态 | 严重程度 |
|--------|------|-----------|----------|
| `controller.prompt_draft_not_found` | 提示词草稿不存在 | 404 | 中 |
| `controller.prompt_draft_version_conflict` | 提示词版本冲突 | 409 | 中 |

### Worker 相关

| 错误码 | 标题 | HTTP 状态 | 严重程度 |
|--------|------|-----------|----------|
| `controller.worker_not_found` | Worker 不存在 | 404 | 中 |
| `controller.no_available_worker` | 无可用 Worker | 503 | 高 |

### 项目相关

| 错误码 | 标题 | HTTP 状态 | 严重程度 |
|--------|------|-----------|----------|
| `controller.project_config_not_found` | 项目配置不存在 | 404 | 高 |

### 认证相关 (Auth)

| 错误码 | 标题 | HTTP 状态 | 严重程度 |
|--------|------|-----------|----------|
| `controller.auth_unauthorized` | 未授权 | 401 | 高 |
| `controller.auth_forbidden` | 禁止访问 | 403 | 高 |

### 请求相关

| 错误码 | 标题 | HTTP 状态 | 严重程度 |
|--------|------|-----------|----------|
| `controller.invalid_request` | 请求无效 | 400 | 中 |
| `controller.duplicate_request` | 重复请求 | 409 | 低 |
| `controller.dry_run_unsupported` | 不支持试运行 | 400 | 低 |
| `controller.result_pending` | 结果待定 | 202 | 低 |

### 系统相关

| 错误码 | 标题 | HTTP 状态 | 严重程度 |
|--------|------|-----------|----------|
| `controller.prompt_engine_not_configured` | 提示词引擎未配置 | 500 | 高 |
| `controller.persistence_init_failed` | 数据库初始化失败 | 500 | 严重 |
| `controller.invalid_approval_action` | 审批操作无效 | 400 | 中 |

---

## 错误码详情

### TASK_DRAFT_NOT_FOUND

```typescript
错误码: controller.task_draft_not_found
标题: 任务草稿不存在
HTTP 状态: 404 Not Found
严重程度: 中

说明:
  找不到指定的任务草稿，可能已被删除或 ID 错误。

建议:
  - 请检查任务 ID 是否正确
  - 刷新任务列表查看最新状态
```

### TASK_PROTOCOL_FIELD_MISSING

```typescript
错误码: controller.task_protocol_field_missing
标题: 任务协议缺少必填字段
HTTP 状态: 400 Bad Request
严重程度: 高

说明:
  任务协议中缺少必需的字段，常见原因：
  - webhook 请求体缺少 projectKey
  - 缺少 taskType
  - 缺少 sessionId

建议:
  请检查 webhook 请求体是否包含所有必填字段：
  - projectKey: 项目标识
  - taskType: 任务类型
  - sessionId: 会话 ID
  - content: 任务内容
```

### NO_AVAILABLE_WORKER

```typescript
错误码: controller.no_available_worker
标题: 无可用 Worker
HTTP 状态: 503 Service Unavailable
严重程度: 高

说明:
  当前没有在线的 Worker 可以执行此任务。
  可能原因：
  - 所有 Worker 都离线
  - 没有 Worker 支持该项目
  - Worker 负载已满

建议:
  - 检查 Worker 节点是否在线
  - 确认 manifest.yaml 中配置了支持该项目的 Worker
  - 检查 Worker 日志排查启动问题
```

### PERSISTENCE_INIT_FAILED

```typescript
错误码: controller.persistence_init_failed
标题: 数据库初始化失败
HTTP 状态: 500 Internal Server Error
严重程度: 严重

说明:
  无法初始化持久化存储（SQLite 数据库）。

可能原因:
  - 数据库文件路径不存在
  - 磁盘空间不足
  - 文件权限问题
  - 数据库文件损坏

建议:
  - 检查数据库目录是否存在
  - 确认磁盘空间充足
  - 检查数据目录写权限
  - 如果数据库损坏，删除旧文件重新初始化
```

### AUTH_UNAUTHORIZED

```typescript
错误码: controller.auth_unauthorized
标题: 未授权
HTTP 状态: 401 Unauthorized
严重程度: 高

说明:
  请求未提供有效的身份验证凭据。

建议:
  - 检查 API Token 是否正确设置
  - 确认 Webhook Token 与 Claude Code 配置一致
  - 检查请求头是否包含正确的 Authorization
```

---

## 常见错误处理指南

### 1. Webhook 接入问题

**症状**: 任务无法创建，返回 `INVALID_TASK_PROTOCOL` 或 `TASK_PROTOCOL_FIELD_MISSING`

**排查步骤**:
1. 检查 Claude Code 侧的 webhook 配置
2. 确认 webhook URL 正确指向 Controller
3. 检查 webhook 请求体格式
4. 确认 `OPENCLAW_WEBHOOK_TOKEN` 一致

### 2. Worker 不在线

**症状**: 任务卡在 `pending` 状态，无法派发

**排查步骤**:
1. 检查 Worker 服务是否启动
2. 检查 Worker 日志
3. 验证 Controller URL 配置正确
4. 确认 Worker 心跳正常

### 3. 数据库问题

**症状**: Controller 无法启动，或任务无法持久化

**排查步骤**:
1. 检查 `data/clawkit.db` 文件状态
2. 确认 `data` 目录存在且可写
3. 检查磁盘空间
4. 查看 Controller 启动日志

---

## 技术实现

错误码定义位置：`packages/shared/src/types/errors.ts`

错误信息映射位置：`packages/shared/src/i18n/error-messages.ts`

使用示例：
```typescript
import { ControllerErrorCode, getErrorMessage } from '@clawkit/shared';

// 获取用户友好的错误信息
const error = getErrorMessage(ControllerErrorCode.WORKER_NOT_FOUND, 'Worker id: abc123');
// 返回: { title: 'Worker 不存在', message: '...', suggestion: '...' }
```

---

## 更新记录

| 日期 | 版本 | 更新内容 |
|-----|-----|---------|
| 2026-07-09 | v0.2.0 | 初始版本，22 个错误码 |
