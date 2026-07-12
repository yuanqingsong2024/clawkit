# controller 任务模型

## 1. 文档目标

本文档说明 controller 当前真实使用的核心任务模型，以及它们在“草稿生成 -> 审批 -> 派发 -> 执行结果回传”链路中的职责。

## 2. 核心模型

### 2.1 TaskDraft

`TaskDraft` 是任务主卡片，来源于研发任务协议解析结果。

关键字段：

- `taskId`
- `sourceText`
- `projectKey`
- `intent`
- `constraints`
- `acceptanceCriteria`
- `status`
- `createdAt`
- `updatedAt`

### 2.2 PromptDraft

`PromptDraft` 是待确认草稿，基于 `TaskDraft + TaskMemory` 生成。

关键字段：

- `taskId`
- `version`
- `draftText`
- `summaryView`
- `createdAt`

其中 `summaryView` 会被 controller 格式化为 OpenClaw 可直接回给用户的草稿摘要。

### 2.3 TaskMemory

`TaskMemory` 是任务上下文容器，负责承接：

- `normalizedTaskCard`
- `promptDraftHistory`
- `userRevisionHistory`
- `executionSummary`
- `similarTaskRefs`
- `projectRuleRefs`

首版最重要的现实用途有两个：

1. 保留草稿演进历史
2. 保存执行结果摘要，供状态查询与 OpenClaw 回传使用

### 2.4 ApprovalRecord

`ApprovalRecord` 记录一次审批动作。

关键字段：

- `taskId`
- `action`
- `operator`
- `comment`
- `fromStatus`
- `toStatus`
- `createdAt`

## 3. 当前实际状态集合

当前实现真实使用以下 `TaskStatus`：

- `draft`
- `prompt_generated`
- `waiting_approval`
- `approved`
- `dispatched`
- `running`
- `done`
- `failed`
- `cancelled`

也就是说，执行态已经不是“仅预留”，而是实际接入到了派发与 worker 结果回传链路中。

## 4. 模型关系

主链路如下：

```text
研发任务文本
  -> TaskProtocol
  -> TaskDraft
  -> TaskMemory
  -> PromptDraft
  -> ApprovalRecord
  -> DispatchRecord
  -> executionSummary 回写 TaskMemory
```

## 5. 设计原则

- `TaskDraft` 负责“任务是什么”
- `PromptDraft` 负责“待确认草稿长什么样”
- `TaskMemory` 负责“上下文与历史是什么”
- `ApprovalRecord` 负责“谁在什么状态做了什么动作”

这种分层可以让 controller 在不引入复杂架构的前提下，同时支撑审批流和执行结果回查。
