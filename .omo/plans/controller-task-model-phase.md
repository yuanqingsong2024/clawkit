# controller 任务草稿与审批状态机阶段计划

## 1. 目标

- 在 `packages/controller` 中落地任务草稿、任务记忆、PromptDraft、审批记录的核心模型。
- 在 `packages/shared` 中补齐本阶段共享枚举、版本结构与错误码。
- 在 `packages/controller` 中提供 SQLite 最小表结构与初始化脚本。
- 在 `docs/` 中补齐中文设计文档，明确职责与阶段边界。

## 2. 非目标

- 不实现 worker 真实执行逻辑。
- 不实现 OpenClaw / OpenCode 真实联调。
- 不实现 Web UI。
- 不实现自动 PR。
- 不实现复杂权限系统。
- 不实现多任务并发调度。
- 不实现真实任务派发。
- 不实现真正的模型调用，只预留 PromptEngine 抽象。

## 3. 模块划分

### 3.1 packages/shared

- `src/interfaces/task.ts`：定义任务状态枚举、审批动作枚举。
- `src/schema/prompt-draft.ts`：定义 PromptDraft 版本结构与风险标记结构。
- `src/types/errors.ts`：定义 controller 相关错误码。
- `src/index.ts`：统一导出新增 schema、类型与枚举。

### 3.2 packages/controller

- `src/models/`：定义 `TaskDraft`、`TaskMemory`、`PromptDraft`、`ApprovalRecord` 以及必要的辅助接口。
- `src/services/prompt-engine.ts`：仅定义 PromptEngine 抽象接口，不做真实模型调用。
- `src/persistence/init.sql`：定义 SQLite 最小建表语句与索引。
- `src/persistence/schema.ts`：暴露初始化脚本常量与表名常量。
- `src/index.ts`：统一导出模型、抽象、持久化常量与控制器入口。

## 4. 数据建模原则

- 时间字段统一使用 `Date`（运行时）与 ISO8601 文本（SQLite）表达。
- 需要保留历史的字段使用数组建模，并在 SQLite 中落为 JSON 文本列。
- 审批记录采用追加式存储，不在当前阶段实现复杂状态机引擎。
- `TaskDraft.status` 使用共享任务状态枚举，审批动作使用共享审批动作枚举。
- `PromptDraft.version` 使用结构化版本对象，而不是裸字符串，便于后续扩展主/次版本与修订号。

## 5. 实施步骤

1. 补齐 shared 共享枚举、schema 与错误码。
2. 在 controller 中定义核心模型与 PromptEngine 抽象接口。
3. 设计 SQLite 最小表结构与初始化脚本。
4. 更新 controller/shared 导出入口。
5. 编写三篇中文文档说明模型职责、记忆设计与审批流边界。
6. 运行 TypeScript 构建、相关文件诊断，确认未引入真实执行逻辑。

## 6. 验证清单

- `TaskDraft` / `TaskMemory` / `PromptDraft` / `ApprovalRecord` 模型存在且字段齐全。
- `TaskStatus` / `ApprovalAction` / `PromptDraftVersion` / `ControllerErrorCode` 已导出。
- SQLite 初始化脚本包含主表、审批记录表、记忆表、PromptDraft 表及最小索引。
- 文档 `docs/task-model.md`、`docs/task-memory.md`、`docs/approval-flow.md` 齐全且为中文。
- `pnpm -r build` 通过。

## 7. 风险与约束

- 避免把“审批状态机”实现成真实工作流引擎；当前只做状态表达与记录模型。
- 避免引入 ORM、数据库驱动、队列或调度器。
- 避免把 PromptEngine 抽象写成可执行实现；仅保留接口边界。
- 避免把 controller 设计成多任务并发系统；当前只支持单任务草稿生命周期的基础表达。
