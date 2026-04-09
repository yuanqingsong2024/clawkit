# clawkit

用于串联 OpenClaw、controller、worker 与 OpenCode，并提供最小部署配置能力的轻量 monorepo 工具集。

clawkit 当前提供两条并行主线：一条是以 `clawkit` CLI 为入口的配置生成、诊断、部署预览与最小落地；另一条是围绕 controller / worker 建立的任务接入、草稿确认、派发执行与结果回传链路。仓库目标不是实现完整生产管理平台，而是把首个 MVP 所需的最小主链路收敛到可安装、可配置、可验证的状态。

## 当前范围

当前仓库已覆盖的主能力：

- `clawkit init / doctor / plan / apply / heal` CLI 主命令
- manifest 校验与部署拓扑描述
- OpenClaw webhook 接入与任务协议识别
- TaskDraft / TaskMemory / PromptDraft / 审批状态流转
- approved 任务派发、worker 选择与执行结果回传
- controller HTTP 服务、任务流转相关服务与 SQLite 持久化
- worker 注册、心跳、拉取任务、回传结果
- OpenCode 执行链路，以及本地联调用的 placeholder fallback
- 轻量 Web Console（总览、配置、部署、修复、状态、任务中心）
- Setup 向导（预设选择 + YAML 编辑 + 编排执行）
- 单机、混合、双机三类示例配置

当前阶段明确不做的事情：

- 复杂 Web 管理后台
- 自动 PR 或自动发布业务代码
- controller 侧真实模型推理
- 超出最小链路范围的复杂远程编排

## 仓库结构

这是一个 pnpm workspace monorepo，工作区定义在 `packages/*`。

### 核心包

- `packages/cli`：命令行入口，提供 `init / doctor / plan / apply / heal`
- `packages/shared`：共享 schema、接口、类型与校验工具
- `packages/controller`：控制器服务，负责 webhook 接入、草稿/审批流、派发编排、HTTP 服务与持久化
- `packages/worker`：工作节点，负责注册、心跳、拉取任务、执行任务与结果上报
- `packages/web`：轻量 Web Console，包含页面、前端路由与构建产物
- `packages/templates`：模板位目录；当前不维护独立静态模板文件，部署文件由 CLI 在运行时生成

### 其他目录

- `docs/`：详细设计、联调、部署、限制与验收文档
- `examples/`：`all-in-one`、`hybrid`、`split` 示例 manifest
- `scripts/`：快速启动、联调、清理与烟雾测试脚本

## 支持的部署拓扑

clawkit 围绕同一套 manifest 支持三种基础拓扑：

1. `all-in-one`：OpenClaw、controller、worker、OpenCode 部署在同一台机器
2. `hybrid`：OpenClaw + controller 在云端，worker + OpenCode 在本地
3. `split`：OpenClaw + controller 在 A 机器，worker + OpenCode 在 B 机器

对应示例见：

- `examples/all-in-one.yaml`
- `examples/hybrid.yaml`
- `examples/split.yaml`

这里的“支持”指 manifest、CLI 与示例配置层面的支持；如果从 Web Setup 向导入口进入，当前内置预设只有 `all-in-one` 和 `hybrid`，`split` 需要通过 YAML 手动编辑。

## 核心链路

从整体功能看，clawkit 当前最重要的不是单独某个命令，而是下面这条最小闭环：

1. OpenClaw 通过 webhook 把研发任务文本发送给 controller
2. controller 识别任务协议，创建 `TaskDraft`、`TaskMemory` 与 `PromptDraft`
3. 任务进入等待确认状态，支持修改草案、确认派发、取消任务、查询状态
4. 已确认任务由 controller 派发给可用 worker
5. worker 拉取任务后调用 OpenCode 或 placeholder executor 执行
6. 执行结果回传 controller，并以摘要形式返回给调用侧

如果只把仓库理解成“部署配置工具”，会低估 controller / worker 这部分已经存在的任务主链路能力。

## 快速开始

### 环境要求

- Node.js >= 20.0.0
- pnpm >= 8.0.0

### 安装与构建

```bash
pnpm install
pnpm build
```

### 常用命令

```bash
# 查看 CLI 帮助
node ./packages/cli/dist/index.js --help

# 初始化 manifest
node ./packages/cli/dist/index.js init

# 诊断示例配置
node ./packages/cli/dist/index.js doctor -f ./examples/all-in-one.yaml

# 预览部署计划
node ./packages/cli/dist/index.js plan -f ./examples/all-in-one.yaml

# 预览最小部署写入
node ./packages/cli/dist/index.js apply -f ./examples/all-in-one.yaml --dry-run

# 生成诊断与修复计划
node ./packages/cli/dist/index.js heal -f ./examples/all-in-one.yaml --dry-run
```

### 快速脚本

根目录已提供便于试运行和联调的脚本：

```bash
pnpm quickstart
pnpm quickstart:dev
pnpm smoke
```

脚本详细说明见 [`scripts/README.md`](./scripts/README.md)。

## 最小联调路径

如果只是验证链路是否打通，可以按下面的最小路径开始：

1. 选择或生成一个 manifest，例如 `examples/all-in-one.yaml`
2. 执行 `pnpm install && pnpm build`
3. 使用 `plan` 或 `apply --dry-run` 检查部署结果
4. 运行 `node ./scripts/e2e-local-demo.js` 做本地最小联调

这条路径默认允许 placeholder fallback，因此它证明的是“任务链路可跑通”，不是“真实 OpenCode 执行环境已经验收完成”。

## 关键边界

使用仓库前需要明确这几个边界：

1. `e2e-local-demo.js` 默认允许 placeholder fallback，更适合做链路验证。
2. 若要验证真实 OpenCode 执行，需要先准备 `opencode serve` 相关环境，并关闭 `WORKER_PLACEHOLDER_FALLBACK`。
3. controller 已接入 SQLite 持久化，默认数据库路径为 `data/clawkit.db`，也可通过环境变量覆盖。
4. `packages/templates/` 当前是模板位目录，最小部署文件由 CLI 运行时生成，而不是从静态模板直接拷贝。
5. Web Console 是轻量控制台，Setup 当前主要是“预设 + YAML 编辑 + 编排执行”，尚不是逐字段完整表单式向导。
6. README 描述的是仓库当前实际能力范围；如果与历史阶段性规则文档有差异，应以当前代码与 docs 中的现状为准理解。

更完整的限制说明见 [`docs/known-limitations.md`](./docs/known-limitations.md)。

## 文档索引

按使用场景建议优先阅读这些文档：

- [`docs/quick-start.md`](./docs/quick-start.md)：一键部署与快速上手
- [`docs/cli.md`](./docs/cli.md)：CLI 命令说明
- [`docs/manifest.md`](./docs/manifest.md)：manifest 结构与字段说明
- [`docs/project-scope.md`](./docs/project-scope.md)：当前版本做什么、不做什么与 MVP 边界
- [`docs/e2e.md`](./docs/e2e.md)：本地联调与真实 OpenCode 执行验证
- [`docs/web-console.md`](./docs/web-console.md)：Web Console 与 Setup 向导
- [`docs/controller-api.md`](./docs/controller-api.md)：controller HTTP API
- [`docs/openclaw-webhook.md`](./docs/openclaw-webhook.md)：OpenClaw webhook 接入与交互协议
- [`docs/controller-flow.md`](./docs/controller-flow.md)：controller 内部草稿与审批闭环
- [`docs/dispatch-flow.md`](./docs/dispatch-flow.md)：任务派发、执行与结果回写链路
- [`docs/worker.md`](./docs/worker.md)：worker 设计与运行说明

## 开发说明

常用工作区命令：

```bash
pnpm build
pnpm test
pnpm lint
pnpm clean
```

如果需要进入某个包单独处理，可查看对应 `package.json` 中的脚本定义，例如：

- `packages/cli/package.json`
- `packages/controller/package.json`
- `packages/worker/package.json`
- `packages/web/package.json`

## 语言与协作约定

本仓库默认使用中文编写说明、注释与文档。协作前请先阅读：

- [`AGENTS.md`](./AGENTS.md)

英文入口说明见 [`README.en.md`](./README.en.md)。
