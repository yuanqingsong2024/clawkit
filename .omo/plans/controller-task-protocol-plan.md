# controller 任务协议与审批状态机实现计划

## 1. 目标

在当前 controller 草稿、记忆与审批设计阶段，实现稳定的任务协议解析与审批状态机能力，覆盖：

- 五种输入协议的消息解析与字段提取
- 协议识别与标准化输出
- 受约束的任务状态机与审批动作接口
- 中文文档与基础测试

## 2. 非目标

- 不实现 worker 真实派发
- 不实现 OpenCode 调用
- 不实现自动执行触发
- 不实现权限系统、多级审批或通知机制

## 3. 已验证上下文

1. `packages/controller/src/models/approval-state-machine.ts` 已有旧版审批状态机，但状态与动作仍是旧设计。
2. `packages/shared/src/interfaces/task.ts` 已导出旧版 `TaskStatus` 与 `ApprovalAction`。
3. `packages/shared/src/types/errors.ts` 已有部分 controller 错误码，可扩展。
4. 现有文档 `docs/task-model.md` 与 `docs/approval-flow.md` 使用全中文、分节说明“做什么 / 不做什么 / 为什么”。
5. 当前仓库缺少稳定测试基础设施，需要补最小可用测试能力。

## 4. 计划波次

### Wave 1：类型与边界对齐

**目标**：先稳定 shared 与 controller 的状态、动作、错误码边界。

涉及文件：

- 修改 `packages/shared/src/interfaces/task.ts`
- 修改 `packages/shared/src/types/errors.ts`
- 视需要修改 `packages/shared/src/index.ts`
- 重构 `packages/controller/src/models/approval-state-machine.ts`
- 视需要调整 `packages/controller/src/models/task-draft.ts`
- 视需要调整 `packages/controller/src/models/approval-record.ts`
- 修改 `packages/controller/src/models/index.ts`
- 修改 `packages/controller/src/index.ts`

关键动作：

1. 将任务状态统一为：`draft`、`prompt_generated`、`waiting_approval`、`approved`、`dispatched`、`running`、`done`、`failed`、`cancelled`。
2. 将审批动作统一为：`approve`、`revise`、`cancel`、`view_status`。
3. 补充协议与状态机相关错误码：至少覆盖协议无法识别、字段缺失、非法状态流转、非法审批动作。
4. 提供状态机 API：
   - `getAllowedTaskTransitions(status)`
   - `canTransitionTaskStatus(from, to)`
   - `assertTaskStatusTransition(from, to)`
   - `transitionTaskStatus(from, to)`
   - `canApplyApprovalAction(status, action)`
   - `getNextTaskStatusForAction(status, action)`
   - `applyApprovalAction(status, action)`

### Wave 2：任务协议模块实现

**目标**：实现消息解析器与协议识别器，稳定标准化协议对象。

涉及文件：

- 新增 `packages/controller/src/protocol/types.ts`
- 新增 `packages/controller/src/protocol/parser.ts`
- 新增 `packages/controller/src/protocol/recognizer.ts`
- 新增 `packages/controller/src/protocol/index.ts`
- 视需要更新 `packages/controller/src/index.ts`

关键动作：

1. 设计协议类型：
   - `CreateTaskProtocol`
   - `ConfirmDispatchProtocol`
   - `ReviseDraftProtocol`
   - `CancelTaskProtocol`
   - `TaskStatusQueryProtocol`
   - `TaskProtocol` 联合类型
2. parser 负责：
   - 判断文本是否匹配命令头
   - 提取 `projectKey`、`goal`、`constraints`、`acceptance`、`taskId`、`modification`
   - 对错误输入返回中文错误信息
3. recognizer 负责：
   - 识别命令类别
   - 返回标准化协议对象
   - 对非法协议输出错误码与可读中文消息

### Wave 3：文档与测试基础设施

**目标**：补齐中文文档与基础测试，证明协议和状态机可用。

涉及文件：

- 新增 `docs/task-protocol.md`
- 新增 `docs/state-machine.md`
- 修改 `package.json`（如需根级测试依赖）
- 修改 `packages/controller/package.json`
- 视需要新增 `vitest.config.ts`
- 新增 `packages/controller/src/__tests__/protocol-parser.test.ts`
- 新增 `packages/controller/src/__tests__/state-machine.test.ts`

关键动作：

1. 采用最小测试方案，优先 `vitest`。
2. 文档需说明：协议格式、字段要求、错误示例、状态说明、合法与非法流转。
3. 协议测试至少覆盖五种合法协议与常见非法输入。
4. 状态机测试至少覆盖：
   - 当前阶段合法流转
   - 非法流转阻止
   - 审批动作到状态的映射
   - 预留状态不可误用

## 5. 依赖关系

- Wave 1 完成后，Wave 2 才能稳定使用统一状态与错误码。
- Wave 2 与 Wave 3 中的文档编写可部分并行。
- 测试编写依赖 Wave 1、Wave 2 的实际 API 定型。

## 6. 验证计划

### 功能验收

1. 能正确解析五种协议。
2. 非法协议返回错误码与清晰中文提示。
3. 能完成基础状态流转。
4. 非法状态流转可阻止并报错。
5. 文档与测试齐全。

### 执行顺序

1. 对所有改动文件执行 `lsp_diagnostics`
2. 运行 controller 包测试
3. 运行 `pnpm build`
4. 运行 `pnpm test`

## 7. 风险控制

- 不直接删除旧模型文件，优先在原文件上重构以减少导出断裂。
- 所有新增中文文档与错误消息必须保持可操作性。
- 测试基础设施保持最小可用，避免把当前阶段扩展成完整工程化改造。
