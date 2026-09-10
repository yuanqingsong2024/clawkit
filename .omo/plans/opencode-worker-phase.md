# OpenCodeExecutor 接入阶段实施计划

## 目标

- 在 worker 中以 `opencode serve + @opencode-ai/sdk` 为主路径实现真实执行
- 保留 `PlaceholderExecutor` 作为回退方案，但默认不再作为主路径
- 读取项目规则（`AGENTS.md`、可选 `.opencode/commands`、`skills`、`.opencode/oh-my-opencode.jsonc`）并组装最终执行上下文
- 将真实执行结果结构化回传给 controller，并在任务状态查询中展示真实摘要

## 非目标

- 不实现复杂调度
- 不实现多 worker 并发执行
- 不实现自动 PR
- 不实现自动部署上线
- 不实现 Web UI
- 不实现复杂权限系统

## 设计原则

- 最小可用版本优先
- 主路径优先走 SDK，CLI 仅作为统一封装后的备用方案
- 项目配置优先复用现有 manifest 中的 `repoPath`、`baseBranch`、`openCode`
- 默认最小权限，禁止高风险动作默认放开
- 所有文档、日志、注释使用中文

## 模块拆分

### 1. shared 扩展

- 扩展 `TaskExecutionContext`
  - 增加 `repoPath`
  - 增加 `branchBase`
  - 增加项目配置快照
  - 增加执行 prompt 草稿/执行边界输入
- 扩展 `TaskExecutionResult`
  - 增加 `workerId`
  - 增加 `projectKey`
  - 增加 `changedFiles`
  - 增加 `commands`
  - 增加 `testResult`
  - 增加 `rawOutputSummary`
  - 增加结构化错误字段
- 扩展 `WorkerPullTaskResponse` 与 `WorkerSubmitResultRequest`
  - 让 worker 拉取时直接获得执行所需项目元数据
  - 让结果回传支持真实执行摘要与失败结构

### 2. controller 扩展

- 新增最小项目索引服务
  - 从 manifest 读取 worker 项目列表
  - 按 `projectKey` 提供 `repoPath/baseBranch/openCode`
- 更新 `DispatchService`
  - `pullTask()` 返回完整项目执行上下文
  - `submitResult()` 写入完整执行摘要
- 更新状态查询摘要
  - 展示真实执行摘要，不再仅展示占位提示

### 3. worker 扩展

- 新增 `OpenCodeClient`
  - 支持 `server.baseUrl`
  - 支持 `server.username`
  - 支持 `server.passwordEnv`
  - 支持 `mode: sdk | cli`
  - 支持 `timeoutMs`
  - 支持 server 可用性检查
- 新增 `OpenCodeExecutor`
  - 校验项目路径
  - 读取项目上下文
  - 组装最终 prompt
  - 调用 OpenCode
  - 规范化执行结果
- 新增辅助服务
  - `ProjectContextReader`
  - `WorkerPromptCompiler`
  - `ExecutionResultNormalizer`
  - `SecurityBoundaryBuilder`

### 4. 文档与测试

- 新增中文文档
  - `docs/opencode-integration.md`
  - `docs/executor.md`
  - `docs/security-boundary.md`
- 增加最小测试
  - OpenCodeClient 连接测试
  - 项目上下文读取测试
  - Prompt 编译测试
  - OpenCodeExecutor 成功/失败测试
  - worker 结果回传测试
  - controller 状态更新测试

## 文件级改动建议

### shared

- `packages/shared/src/interfaces/task-executor.ts`
- `packages/shared/src/types/worker-api.ts`
- `packages/shared/src/index.ts`

### controller

- `packages/controller/src/models/task-memory.ts`
- `packages/controller/src/services/dispatch-service.ts`
- `packages/controller/src/http/services/controller-api-service.ts`
- `packages/controller/src/http/services/service-container.ts`
- `packages/controller/src/services/project-registry.ts`（新增）

### worker

- `packages/worker/src/config.ts`
- `packages/worker/src/worker.ts`
- `packages/worker/src/index.ts`
- `packages/worker/src/executors/placeholder-executor.ts`
- `packages/worker/src/executors/open-code-executor.ts`（新增）
- `packages/worker/src/services/open-code-client.ts`（新增）
- `packages/worker/src/services/project-context-reader.ts`（新增）
- `packages/worker/src/services/worker-prompt-compiler.ts`（新增）
- `packages/worker/src/services/execution-result-normalizer.ts`（新增）
- `packages/worker/src/services/security-boundary-builder.ts`（新增）

### docs

- `docs/opencode-integration.md`（新增）
- `docs/executor.md`（新增）
- `docs/security-boundary.md`（新增）

## 执行顺序

1. 先扩展 shared 类型与 worker/controller 传输协议
2. 再实现 controller 项目索引与派发上下文补全
3. 再实现 worker 的 OpenCodeClient 与 OpenCodeExecutor
4. 再实现项目上下文读取、权限边界、prompt 编译与结果归一化
5. 再更新状态查询展示
6. 再补文档
7. 最后补测试并执行构建验证

## 风险点

- SDK 返回内容不完全结构化，需要保留最小文本解析兜底
- OpenCode server 认证与本机端口配置容易缺失，错误信息必须清晰
- 当前 controller 为内存态，测试必须显式验证状态写回而非依赖持久化
- 权限边界只能做到“最小默认配置 + 明确提示”，不能伪装成完整权限系统

## 验收清单

- worker 默认走 `OpenCodeExecutor`
- `PlaceholderExecutor` 仍可作为 fallback
- worker 能读取 `AGENTS.md` 等项目规则并注入最终 prompt
- 最终 prompt 包含项目标识、仓库路径、任务目标、验收标准、禁止事项、输出契约、项目规则提示、当前执行边界
- 结果结构包含成功与失败两类标准结构
- controller 查询接口展示真实执行摘要
- 文档与测试齐全
- 无越界实现自动 PR、自动部署、复杂调度
