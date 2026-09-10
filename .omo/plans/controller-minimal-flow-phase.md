# controller 内部最小闭环实施计划

## 目标

在 `packages/controller` 内实现一个只依赖内存状态的最小应用层闭环，串起以下流程：

1. 接收一条研发任务文本
2. 解析协议
3. 生成 `TaskDraft`
4. 生成 `PromptDraft`
5. 进入 `waiting_approval`
6. 接收确认 / 修改 / 取消指令
7. 更新状态
8. 查询任务状态

## 非目标

- 不做 HTTP API
- 不做 OpenClaw webhook
- 不做 worker 调度
- 不做 OpenCode 调用
- 不做数据库持久化

## 约束

- 全部说明、注释、文档使用中文
- `approved` 当前阶段只允许改状态，不做真实派发
- `reviseDraft` 必须保留 PromptDraft 历史版本
- `getTaskStatus` 必须返回最近一次 PromptDraft 摘要与最近一次审批动作

## 实施范围

### 新增文件

1. `packages/controller/src/services/controller-flow-service.ts`
   - 新增最小应用层服务
   - 使用内存 `Map` 保存任务、记忆、Prompt 草案历史、审批记录
   - 暴露以下方法：
     - `createDraftFromText`
     - `generatePromptDraft`
     - `approveDraft`
     - `reviseDraft`
     - `cancelTask`
     - `getTaskStatus`
   - 预留派发入口，但当前只提供空实现钩子

2. `docs/controller-flow.md`
   - 说明最小闭环流程
   - 说明状态演进与版本演进
   - 提供最小 demo / 测试说明

3. `packages/controller/tests/controller-flow-service.test.js`
   - 验证最小闭环主流程
   - 验证 revise 版本递增与历史保留
   - 验证 approved 不触发派发
   - 验证状态查询返回结构

### 修改文件

1. `packages/controller/src/index.ts`
   - 导出新的应用层服务与类型

2. `packages/controller/src/services/template-prompt-engine.ts`
   - 让摘要视图与生成内容能够体现最近一次用户修改意见
   - 保持最小改动，不引入外部依赖

3. `packages/controller/tests/run-tests.js`
   - 接入新的闭环测试

## 方法级步骤

### 1. createDraftFromText

- 调用协议识别器解析输入文本
- 只接受 `create_task`
- 基于协议生成 `TaskDraft`
- 初始化 `TaskMemory`
- 保存到内存仓库
- 返回任务草案

### 2. generatePromptDraft

- 读取 `TaskDraft` 与 `TaskMemory`
- 校验当前状态允许从 `draft` 进入 `prompt_generated`
- 调用 `PromptDraftService` 生成新草案
- 将摘要写入 `promptDraftHistory`
- 更新任务状态为 `prompt_generated`
- 再推进到 `waiting_approval`
- 返回生成的 `PromptDraft`

### 3. reviseDraft

- 校验任务存在，且当前状态支持 `revise`
- 记录 `UserRevisionRecord`
- 记录 `ApprovalRecord(action=revise)`
- 将任务状态退回 `draft`
- 基于最新修改意见重新生成新的 `PromptDraft`
- 将新版本写入历史
- 再次推进到 `waiting_approval`
- 返回新的摘要版草案

### 4. approveDraft

- 校验任务存在，且当前状态为 `waiting_approval`
- 记录 `ApprovalRecord(action=approve)`
- 将状态改为 `approved`
- 调用预留派发钩子（默认空实现，不产生副作用）
- 返回最新状态

### 5. cancelTask

- 校验任务存在，且当前状态支持 `cancel`
- 记录 `ApprovalRecord(action=cancel)`
- 将状态推进到 `cancelled`
- 返回最新状态

### 6. getTaskStatus

- 校验任务存在
- 返回：
  - `taskId`
  - `projectKey`
  - `status`
  - 最近一次 `PromptDraft` 的 `summaryView`
  - 最近一次审批动作

## 测试计划

### 目标

验证 controller 内部最小闭环在纯内存模式下可跑通。

### 功能用例

1. 创建研发任务文本后可以得到 `TaskDraft`
2. 生成草案后状态变为 `waiting_approval`
3. 修改草案后会新增 PromptDraft 版本并保留旧版本
4. 确认草案后状态变为 `approved`
5. 查询状态时可看到最近摘要和最近审批动作
6. 确认草案不会触发真实派发

### 可观察结果

- `promptDraftHistory.length` 随 revise 增加
- 最新版本号递增
- `userRevisionHistory.length` 增加
- 最近审批动作按最后一次动作返回
- 派发钩子调用次数保持 0

### 执行命令

- `pnpm --filter @clawkit/controller test`
- `pnpm --filter @clawkit/controller build`

## 风险与边界

- 不新增数据库抽象，避免超过当前阶段目标
- 不创建独立 repository 层，当前只用服务内内存存储即可
- 不把 revise 设计成复杂 diff 合并，仅记录修改意见并体现在新版本草案中
- 不在 approve 时进入 `dispatched`，只保留钩子作为下一阶段扩展点
