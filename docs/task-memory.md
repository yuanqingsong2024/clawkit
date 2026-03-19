# controller 任务记忆设计

## 1. 文档目标

本文档说明 `TaskMemory` 在 controller 中的职责、字段含义与当前阶段边界。

当前阶段只做任务记忆的数据设计与最小持久化表达，不实现：

- 真实记忆召回算法
- 相似任务检索服务
- 规则引擎
- 自动执行总结

## 2. 为什么需要 TaskMemory

`TaskDraft` 只负责表达“当前任务是什么”，但 controller 在生成 Prompt 草案时还需要知道：

- 这条任务被整理成了什么标准卡片。
- 之前生成过哪些 Prompt 草案。
- 用户曾经要求改过哪些内容。
- 可以参考哪些类似任务和项目规则。

这些信息都不适合直接塞进 `TaskDraft`，因此单独抽出 `TaskMemory`。

## 3. TaskMemory 字段说明

### 3.1 主字段

- `taskId`
  - 对应任务主键。
- `normalizedTaskCard`
  - 任务的标准化卡片，是后续生成 Prompt 的统一输入形态。
- `promptDraftHistory`
  - Prompt 草案历史摘要。
- `userRevisionHistory`
  - 用户修订要求历史。
- `executionSummary`
  - 执行总结占位字段。
- `similarTaskRefs`
  - 相似任务引用。
- `projectRuleRefs`
  - 项目规则引用。
- `createdAt`
  - 创建时间。
- `updatedAt`
  - 更新时间。

### 3.2 normalizedTaskCard

`normalizedTaskCard` 用于把原始任务统一整理为标准结构。

当前字段：

- `title`
- `objective`
- `scope`
- `outOfScope`
- `constraints`
- `acceptanceCriteria`

这样做的原因是：

- 后续不论来源是 CLI、API 还是其他入口，都可以先归一化再进入 Prompt 生成阶段。
- 先把“任务卡片格式”稳定下来，可以减少未来 Prompt 模板返工。

### 3.3 promptDraftHistory

`promptDraftHistory` 只保留历史摘要，不直接复制完整草案全文。

当前字段：

- `version`
- `summary`
- `createdAt`

这样设计的原因是：

- 完整草案正文由 `PromptDraft` 单独保存。
- `TaskMemory` 只需要知道“曾经有哪些版本”和“每版大意是什么”。
- 可以避免一份数据在两个模型里重复膨胀。

### 3.4 userRevisionHistory

`userRevisionHistory` 用来记录人工提出的修改意见。

当前字段：

- `revisionId`
- `operator`
- `comment`
- `targetVersion`
- `createdAt`

它的职责不是审批，而是保留“为什么重新改写 Prompt”的上下文。

### 3.5 executionSummary

`executionSummary` 当前允许为 `null`，或者保存一个固定为 `not_started` 的占位结构。

这样设计的原因是：

- 这一阶段明确不做真实执行。
- 但后续一旦进入执行阶段，就不需要再回头改 TaskMemory 的数据边界。

### 3.6 引用类字段

`similarTaskRefs` 与 `projectRuleRefs` 当前都使用统一的 `MemoryReference` 结构：

- `refId`
- `title`
- `summary`

这样设计的原因是：

- 先把“引用关系”表达清楚。
- 暂时不绑定真实检索服务、规则仓库或外部系统。

## 4. 持久化策略

在 SQLite 中，`TaskMemory` 对应 `task_memories` 表。

当前策略：

- 复杂结构全部存成 JSON 文本列。
- 一条任务对应一条任务记忆记录。
- 不实现拆表、不实现复杂 repository。

涉及的 JSON 列包括：

- `normalized_task_card_json`
- `prompt_draft_history_json`
- `user_revision_history_json`
- `execution_summary_json`
- `similar_task_refs_json`
- `project_rule_refs_json`

这样做的原因是：

- 当前阶段重点是稳定模型边界，而不是追求复杂查询能力。
- 后续如果要拆分子表，也可以在不破坏 controller 模型的前提下演进。

## 5. 当前阶段边界

`TaskMemory` 当前只负责“为 Prompt 草案生成与人工修订保留上下文”，不负责：

- 调用向量检索
- 自动合并多任务记忆
- 执行日志归档
- worker 执行快照

## 6. 结论

`TaskMemory` 是 controller 的上下文容器。

它的存在让系统可以在不进入真实执行阶段的前提下，先把“任务卡片、草案历史、人工修订、规则引用”这四类核心上下文稳定下来，为后续 Prompt 生成与审批确认打基础。
