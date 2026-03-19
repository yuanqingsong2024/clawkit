# controller 内部最小闭环说明

## 1. 文档目标

本文档说明 controller 当前阶段新增的最小应用层闭环。

```js
const { ControllerFlowServiceImpl } = require('@clawkit/controller');
```

本阶段只解决一件事：

- 把“研发任务文本 -> TaskDraft -> PromptDraft -> waiting_approval -> 修改 / 确认 / 取消 -> 状态查询”串通。

本阶段明确不做：

- HTTP API
- OpenClaw webhook
- worker 调度
- OpenCode 调用
- 真实派发执行

## 2. 闭环流程

### 2.1 创建草案

调用 `createDraftFromText`：

1. 解析 `#研发任务` 协议
2. 生成 `TaskDraft`
3. 初始化 `TaskMemory`
4. 将任务保存到内存存储

此时任务状态为 `draft`。

### 2.2 生成 Prompt 草案

调用 `generatePromptDraft`：

1. 校验任务存在
2. 生成 `PromptDraft`
3. 写入 `promptDraftHistory`
4. 状态从 `draft` 进入 `prompt_generated`
5. 再推进到 `waiting_approval`

这样做的原因是：当前阶段不需要单独暴露 `prompt_generated` 的人工停顿点，但仍然保留状态机里的中间态表达。

### 2.3 修改草案

调用 `reviseDraft`：

1. 记录用户修改意见到 `userRevisionHistory`
2. 记录一次 `revise` 审批动作
3. 状态退回 `draft`
4. 基于最新修改意见重新生成新的 `PromptDraft`
5. 写入新的 PromptDraft 版本
6. 保留旧版本历史
7. 返回新的摘要视图（`PromptDraft.summaryView`）

版本策略：

- 首次生成：`generation=1, revision=0`
- 同一轮修改后重生：`generation=1, revision+1`

## 3. approveDraft 的边界

调用 `approveDraft` 后：

- 只把状态改为 `approved`
- 记录一次 `approve` 审批动作
- **不会**进入 `dispatched`
- **不会**触发 worker
- **不会**触发 OpenCode

也就是说，`approved` 在当前阶段只是“已确认，可供下一阶段接入派发”的标记。

## 4. getTaskStatus 返回内容

`getTaskStatus(taskId)` 返回：

- `taskId`
- `projectKey`
- 当前状态
- 最近一次 `PromptDraft` 摘要
- 最近一次审批动作

这样做的原因是：当前阶段最重要的是让调用方看到“现在处于什么状态”“最后一版草案长什么样”“最后发生过什么审批动作”。

## 5. 最小演示流程

下面是一个最小演示流程，对应测试 `packages/controller/tests/controller-flow-service.test.js`：

### 步骤 1：创建研发任务

```js
const service = new ControllerFlowServiceImpl();

const created = service.createDraftFromText(`#研发任务
项目: clawkit
目标: 在 controller 内实现最小闭环
约束: 只做 controller 内部；不进入真实派发；全部使用中文
验收: 可以创建草案；可以修改草案；可以确认草案；可以查询状态`);
```

### 步骤 2：生成草案

```js
const generated = await service.generatePromptDraft(created.taskDraft.taskId);
```

预期：

- 返回 `PromptDraft`
- 任务状态进入 `waiting_approval`

### 步骤 3：修改草案

```js
const summary = await service.reviseDraft({
  taskId: created.taskDraft.taskId,
  operator: '产品经理',
  comment: '补充状态查询结果中的最近审批动作',
});
```

预期：

- `PromptDraft` 版本递增
- `userRevisionHistory` 增加一条记录
- 旧版本仍保留在历史中
- 返回新的摘要视图（`PromptDraft.summaryView`）

### 步骤 4：确认草案

```js
const approved = service.approveDraft({
  taskId: created.taskDraft.taskId,
  operator: '负责人',
  comment: '确认进入下一阶段准备态',
});
```

预期：

- 状态变为 `approved`
- 不进入 `dispatched`

### 步骤 5：查询状态

```js
const snapshot = service.getTaskStatus(created.taskDraft.taskId);
```

预期：

- 返回任务 ID
- 返回项目标识
- 返回当前状态
- 返回最近一次 Prompt 草案摘要
- 返回最近一次审批动作

## 6. 验证命令

在仓库根目录执行：

```bash
pnpm --filter @clawkit/controller build
pnpm --filter @clawkit/controller test
```

如果测试通过，说明 controller 内部最小闭环已经可以跑通。
