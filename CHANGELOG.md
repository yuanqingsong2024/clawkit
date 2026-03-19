# 变更记录

## 0.1.0 - 2026-03-11

首个可发布 MVP 版本，聚焦最小可用链路与发布前收口。

### 新增

- 新增 `clawkit init / doctor / plan / apply / heal` 五个 CLI 命令的最小可用实现。
- 新增 controller 任务草稿、任务记忆、审批流、HTTP API 与 OpenClaw webhook 接入。
- 新增 worker 注册、心跳、拉取任务、回传执行结果的最小闭环。
- 新增 `OpenCodeExecutor` 与 `OpenCodeClient`，支持通过 SDK 或 CLI 对接 OpenCode。
- 新增单机模式示例、混合模式示例以及部署说明文档。
- 新增 Web Console，覆盖总览、配置、部署、修复、状态、任务中心，并支持生产静态文件托管。

### 完善

- 补充发布前收口文档，明确最小运行步骤、E2E 验证方式、错误处理边界与 MVP 发布结论。
- 更新 README 与核心 docs，修正阶段状态、Web Console 与 OpenCode 主路径说明不一致的问题。

### 已知限制

- 单机 E2E 演示脚本默认允许 placeholder fallback，用于验证链路打通；严格真实执行联调仍需本机先启动 OpenCode server 并关闭 fallback。
- 当前阶段不包含复杂远程编排、不包含 controller 侧真实模型推理，也不包含自动 PR 与自动生产发布。
