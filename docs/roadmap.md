# clawkit 路线图

## 1. 当前版本定位

当前仓库正在向 **v0.2.0** 版本演进。

已实现的增强功能：

- **插件系统**：支持自定义执行器、触发器、通知器
- **插件市场**：提供插件搜索、安装、卸载、更新功能
- **流水线编排**：支持 DAG 任务编排与执行

核心主链路（v0.1.0）：

- manifest schema、examples、monorepo 结构
- CLI：`init / doctor / plan / apply / heal`
- controller：任务接入、草稿生成、审批、状态查询、Claude Code webhook
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

### M4：插件系统（v0.2.0）

- 插件核心模块（`@clawkit/plugin-core`）实现
- 执行器插件接口（ExecutorPlugin）
- 触发器插件接口（TriggerPlugin）
- 通知器插件接口（NotifierPlugin）
- 插件生命周期管理
- 插件沙箱隔离配置

### M5：插件市场（v0.2.0）

- 插件市场服务（MarketService）
- 插件安装/卸载/更新服务
- 插件搜索与浏览 API
- 插件详情 API
- 插件注册表管理

### M6：流水线编排（v0.2.0）

- 流水线数据模型
- DAG 执行引擎
- 流水线服务
- 流水线 API

## 5. 后续版本方向

### v0.2.x

- 插件示例开发
- 流水线可视化编辑
- 插件配置热加载
- 更完整的插件市场功能

### 暂不纳入路线图的内容

- Web 审批界面
- 自动代码托管集成与自动 PR
- 企业级权限系统
- 复杂分布式调度与任务队列

## 6. 发布判断原则

满足以下条件即可认为首个 MVP 可以发布：

1. `pnpm build` 通过
2. `pnpm test` 通过
3. 单机最小 E2E 通过
4. examples 可被 `doctor / plan / apply / heal` 正确读取
5. README 与核心 docs 能指导用户完成最小落地
