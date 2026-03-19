# clawkit 路线图

## 1. 当前版本定位

当前仓库面向 **首个可发布 MVP（建议版本 `v0.1.0`）**。

当前已经覆盖的最小主链路：

- manifest schema、examples、monorepo 结构
- CLI：`init / doctor / plan / apply / heal`
- controller：任务接入、草稿生成、审批、状态查询、OpenClaw webhook
- dispatch：`approved -> dispatched -> running -> done/failed`
- worker：`register / heartbeat / pull / result`
- executor：`OpenCodeExecutor` 主路径 + `PlaceholderExecutor` 回退路径
- 单机模式最小 E2E 联调
- 混合模式最小部署说明
- Web Console（页面、API、静态托管）

## 2. 当前阶段目标

当前阶段是：**最终验收与 MVP 发布收口阶段**。

本阶段只做：

1. 盘点当前能力
2. 修正阻塞发布的明显缺口
3. 校正文档、examples 与实现之间的偏差
4. 完成发布前验证
5. 形成发布结论

本阶段明确不做：

- 复杂 Web 管理后台能力
- 自动 PR
- 复杂远程编排
- 复杂调度系统
- 复杂权限系统
- controller 侧真实模型推理

## 3. 已完成里程碑

### M0：工程骨架完成

- monorepo 建立
- TypeScript 构建链路可用
- 文档与协作规则建立

### M1：manifest 与 CLI 可用

- manifest schema 与拓扑约束完成
- `init / doctor / plan / apply / heal` 可运行
- 三种拓扑示例补齐

### M2：控制面与执行面最小主链路打通

- OpenClaw webhook 接入
- TaskDraft / TaskMemory / PromptDraft / 审批状态机完成
- worker 注册、心跳、拉取、结果回传完成
- 派发记录与任务状态流转完成
- OpenCodeExecutor 结构化结果回传完成

### M3：MVP 发布前验收

- build 通过
- test 通过
- 单机 E2E 通过
- examples 与 schema 对齐
- 文档与实现对齐

## 4. 后续版本方向

### v0.1.x

- 补充更多错误处理与文档示例
- 强化严格真实 OpenCode 联调说明
- 收敛更多非阻塞文档漂移

### v0.2.0

- 更稳定的混合模式落地指南
- 更细粒度的执行结果结构
- 更多 `heal` 自动修复项
- 更完整的运行诊断与观测信息

### 暂不纳入路线图的内容

- Web 审批界面
- 自动代码托管集成与自动 PR
- 企业级权限系统
- 复杂分布式调度与任务队列

## 5. 发布判断原则

满足以下条件即可认为首个 MVP 可以发布：

1. `pnpm build` 通过
2. `pnpm test` 通过
3. 单机最小 E2E 通过
4. examples 可被 `doctor / plan / apply / heal` 正确读取
5. README 与核心 docs 能指导用户完成最小落地
