# OpenClaw webhook + E2E + apply/heal 阶段计划

## 阶段目标

把现有 controller、worker、OpenCodeExecutor 串成可运行的最小端到端链路，并让 CLI 的 `apply` / `heal` 具备最小可用能力。

## 非目标

- 不实现 Web UI
- 不实现自动 PR
- 不实现复杂调度策略
- 不实现多租户
- 不实现复杂权限系统
- 不做过度自动化
- 不支持多任务并发调度

## 现实前提

1. OpenClaw 使用 hook / webhook 接入，本阶段以 webhook 为主，hook 仅保留说明。
2. OpenClaw 配置位于 `~/.openclaw/openclaw.json`。
3. Webhook 请求必须走 token 鉴权。
4. worker 与 OpenCode 同机。
5. OpenCode 优先走 `opencode serve + SDK`。
6. 权限边界继续保持：禁止 `git push`、禁止自动生产部署、禁止危险删除。

## 已有基础能力

### Controller

- 已有 HTTP 服务、任务路由、审批路由、worker 路由、dispatch 路由
- 已有 `ControllerFlowServiceImpl`：创建草稿、生成 PromptDraft、审批、修改、取消、状态查询
- 已有 `DispatchService`：approved -> dispatch -> worker pull -> result submit -> DONE/FAILED
- 已有 `ControllerApiService.handleOpenClawRequest`，但 OpenClaw 请求/响应结构与格式化逻辑仍耦合在单文件中

### Worker

- 已有 Worker register / heartbeat / pull / submitResult 主循环
- 已有 `OpenCodeExecutor`
- 已有 `OpenCodeClient`，支持 SDK `global.health / session.create / session.prompt / session.messages`

### CLI

- 已有 `init / doctor / plan`
- `apply / heal` 仍为占位
- 已有 manifest schema、日志工具、plan/doctor 基础能力

## 模块调整方案

### 1. Controller：OpenClaw 适配与格式化层

新增或整理：

- `OpenClawAdapter`
  - 将 OpenClaw webhook 请求转换为内部请求
  - 统一做 token 鉴权与 payload 校验
  - 将 controller 内部结果转换为 OpenClaw 友好响应
- `DraftResponseFormatter`
  - 输出草稿摘要
  - 输出建议回复：
    - `#确认派发 <taskId>`
    - `#修改草案 <taskId>`
    - `#取消任务 <taskId>`
    - `#任务状态 <taskId>`
- `ResultResponseFormatter`
  - 输出执行完成/失败摘要
  - 同时保留结构化字段供程序使用

### 2. Controller：真实 webhook 入口

- 新增独立的 OpenClaw webhook 路由
- 保留现有 `/api/tasks/from-openclaw` 兼容能力
- 当前阶段以 webhook 为主入口
- 请求头使用 Bearer token 鉴权

### 3. Controller：确认后自动进入派发

- 在“确认草稿”场景中，不再仅停留在 approved 文案
- controller 在确认成功后立即调用 `dispatchService.dispatchTask(taskId)`
- 若无可用 worker，返回清晰中文失败摘要与建议下一步

### 4. 端到端链路

最小链路：

1. OpenClaw webhook 创建研发任务
2. controller 解析为 TaskDraft + PromptDraft
3. controller 返回草稿摘要
4. 用户确认后 controller 自动派发
5. worker 拉取任务并调用 OpenCodeExecutor
6. worker 回传结构化结果
7. controller 更新状态并返回结果摘要

### 5. CLI apply

新增 `ApplyService`，最小落地能力：

- 读取并校验 manifest
- 生成 controller env / worker env
- 生成 OpenClaw 配置建议输出
- 生成 systemd service 文件或本地运行说明
- 本机模式真实写入
- SSH 节点模式最小远程写入
- 写入前自动备份旧文件
- 输出中文日志

### 6. CLI heal

新增 `HealService`，最小能力：

- 结构化诊断结果
- plan / dry-run 视图
- 检查并处理：
  - manifest 缺失关键字段
  - 配置文件缺失
  - 配置文件损坏或 schema 不兼容
  - worker 未注册
  - OpenCode server 不可达
  - OpenClaw webhook token 未配置
  - 项目路径不存在
  - 服务未启动或状态异常
- 对可修复项提供自动修复

### 7. 文档

新增：

- `docs/openclaw-webhook.md`
- `docs/e2e.md`
- `docs/apply.md`
- `docs/heal.md`
- `docs/deployment-examples.md`

### 8. 测试

至少覆盖：

- OpenClawAdapter 输入输出测试
- DraftResponseFormatter 测试
- ResultResponseFormatter 测试
- apply 最小写入测试
- heal 最小修复测试
- 单机模式端到端联调说明
- 混合模式联调说明

## 执行顺序

### Wave 1：Controller 适配层与真实状态串联

1. 补齐 OpenClawAdapter / 格式化器 / webhook 路由 / token 鉴权
2. 改造确认后自动派发与结果摘要返回
3. 补 controller 侧测试

### Wave 2：CLI apply

1. 提炼 manifest 读取与写入计划
2. 渲染 env / service / 本地运行说明
3. 加入备份、本机写入、最小 SSH 写入
4. 补 apply 测试

### Wave 3：CLI heal

1. 诊断模型
2. 修复计划与 dry-run
3. 自动修复常见问题
4. 补 heal 测试

### Wave 4：联调与文档

1. 单机模式 E2E 验证
2. 混合模式说明
3. 补中文文档与示例

## 验收标准

- OpenClaw 可以真实接入 controller
- 草稿摘要可以回给 OpenClaw
- 用户确认后可以进入真实执行链路
- 执行结果可以以适合用户阅读的方式返回
- `clawkit apply` 具备最小真实部署能力
- `clawkit heal` 具备最小真实修复能力
- 单机模式可以跑通
- 混合模式有清晰文档
- 文档与测试齐全
- 没有越界实现自动 PR、复杂调度、Web UI
