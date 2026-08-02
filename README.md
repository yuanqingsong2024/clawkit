# clawkit

[![CI](https://github.com/yuanqingsongqq/clawkit/actions/workflows/ci.yml/badge.svg)](https://github.com/yuanqingsongqq/clawkit/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/yuanqingsongqq/clawkit?include_prereleases)](https://github.com/yuanqingsongqq/clawkit/releases)
[![License](https://img.shields.io/github/license/yuanqingsongqq/clawkit)](LICENSE)
[![Stars](https://img.shields.io/github/stars/yuanqingsongqq/clawkit)](https://github.com/yuanqingsongqq/clawkit/stargazers)
[![Forks](https://img.shields.io/github/forks/yuanqingsongqq/clawkit)](https://github.com/yuanqingsongqq/clawkit/network/members)
[![Last Commit](https://img.shields.io/github/last-commit/yuanqingsongqq/clawkit)](https://github.com/yuanqingsongqq/clawkit/commits)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)

用于串联 Claude Code、controller、worker 与 OpenCode，并提供一键部署能力的轻量 monorepo 工具集。

clawkit 提供完整的一键部署能力：从配置生成、服务部署、到运行验证的全流程自动化。同时提供围绕 controller / worker 建立的任务接入、草稿确认、派发执行与结果回传链路。

## 🎉 v0.2.0 新增功能（2026-07-11）

### 插件系统（@clawkit/plugin-core）
- ✅ **执行器插件接口**（ExecutorPlugin）：支持自定义任务执行逻辑
- ✅ **触发器插件接口**（TriggerPlugin）：支持自定义触发条件（手动、定时、事件、Webhook）
- ✅ **通知器插件接口**（NotifierPlugin）：支持任务状态变更通知
- ✅ **插件生命周期管理**：安装、启用、禁用、卸载
- ✅ **插件沙箱隔离配置**：安全执行第三方插件

### 插件市场（@clawkit/market）
- ✅ **插件搜索与浏览 API**
- ✅ **插件安装/卸载/更新服务**
- ✅ **插件详情 API**
- ✅ **插件注册表管理**

### 流水线编排（@clawkit/pipeline）
- ✅ **DAG 执行引擎**：支持拓扑排序、并行执行、条件执行
- ✅ **流水线数据模型**：Pipeline、Stage 定义与验证
- ✅ **流水线服务**：CRUD 操作、执行控制、统计信息
- ✅ **REST API**：完整的流水线管理接口

## 📦 历史版本

### v0.1.x 核心能力
- ✅ **一键部署**：`apply --deploy` 自动部署 Claude Code 和 OpenCode
- ✅ **Onboarding 辅助**：`clawkit onboard` 交互式引导配置 webhook 和 token
- ✅ **端到端验证**：`clawkit verify` 验证所有组件运行状态
- ✅ manifest 校验与部署拓扑描述
- ✅ Claude Code webhook 接入与任务协议识别
- ✅ TaskDraft / TaskMemory / PromptDraft / 审批状态流转
- ✅ approved 任务派发、worker 选择与执行结果回传
- ✅ 轻量 Web Console（含 Setup 向导）
- ✅ 单机、混合、双机三类示例配置

详细说明请参考：[一键部署功能说明](./docs/one-click-deployment.md)

## 当前范围

## 开发启动说明

- 根目录 `pnpm dev` 默认启动 monorepo 内的通用开发服务，不包含 `@clawkit/desktop`。
- `packages/desktop` 依赖 Rust / Cargo 与 Tauri 原生环境，需单独使用 `pnpm desktop:dev` 或 `pnpm desktop:start` 启动。
- 如果只开发 Web Console，直接使用 `pnpm --filter @clawkit/web dev` 即可。

当前仓库已覆盖的主能力：

- `clawkit init / doctor / plan / apply / heal / onboard / verify` CLI 命令
- **自动部署 OpenClaw**（local 模式自动 docker compose up）
- **自动安装 OpenCode**（local 模式自动安装并启动）
- **Onboarding 辅助工具**（交互式引导配置 webhook 和 token）
- **端到端验证工具**（验证所有组件运行状态）
- manifest 校验与部署拓扑描述
- OpenClaw webhook 接入与任务协议识别
- TaskDraft / TaskMemory / PromptDraft / 审批状态流转
- approved 任务派发、worker 选择与执行结果回传
- controller HTTP 服务、任务流转相关服务与 SQLite 持久化
- worker 注册、心跳、拉取任务、回传结果
- OpenCode 执行链路（支持一键安装与外部实例集成），以及本地联调用的 placeholder fallback
- 轻量 Web Console（总览、配置、部署、修复、状态、任务中心；含 OpenClaw onboarding 引导流程）
- Setup 向导（预设选择 + YAML 编辑 + 编排执行）
- 单机、混合、双机三类示例配置

当前阶段明确不做的事情：

- OpenClaw 自动 onboarding（需要用户在 UI 手动操作）
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

### 组件关系图

如果从运行时视角理解 clawkit，可以先记住下面这张最小关系图：

```text
浏览器（Web Console）
        |
        v
   controller
   - 提供 /api/*
   - 读取 manifest
   - 返回总览 / 配置 / 状态
   - 接收 webhook
   - 管理任务、审批与派发
        |
        v
      worker
   - 向 controller 注册
   - 拉取任务
   - 执行任务
   - 回传结果
```

如果再把 OpenClaw 与 OpenCode 放进去，整体关系可以理解为：

```text
OpenClaw ---> controller ---> worker ---> OpenCode
                  ^
                  |
             Web Console
```

### 各组件职责

- **Web Console**：前端页面，只负责展示状态、编辑配置、触发操作，本身不直接读取 manifest 或执行任务。
- **controller**：后端核心服务，负责提供 Web Console API、接收 OpenClaw webhook、管理任务草稿与审批、读取 manifest、维护 worker 状态。
- **worker**：执行节点，负责向 controller 注册、拉取任务、调用 OpenCode 或 placeholder executor 执行，并回传结果。
- **OpenClaw**：外部任务来源，通过 webhook 把研发任务发送给 controller。
- **OpenCode**：实际执行能力提供方，worker 会调用它完成真实执行。

### 最小运行理解

- **只想打开页面并查看配置 / 状态**：至少需要启动 `controller`。
- **想验证任务派发与 worker 状态**：需要同时启动 `controller` 和 `worker`。
- **想验证 OpenClaw webhook 接入**：还需要准备 OpenClaw 侧调用入口。
- **想验证真实执行而不是 placeholder fallback**：还需要准备 OpenCode 服务。

因此，遇到下面这些现象时，优先排查 `controller` 是否已启动并且版本正确：

- 页面显示异常或总览数据为空
- 新增 API 返回 404
- manifest 无法读取或配置页报错

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
- Docker（如果使用 local 模式部署 OpenClaw）

### 一键部署（推荐）

从零开始部署简化模式（默认优先使用简化配置）：

```bash
# 1. 安装依赖并构建
pnpm install
pnpm build

# 2. 一键部署（默认优先使用 `clawkit.yaml` / `examples/simple.yaml`）
pnpm quickstart

# 3. 完成 OpenClaw onboarding（交互式引导）
node ./packages/cli/dist/index.js onboard -f ./examples/simple.yaml

# 4. 验证所有组件
node ./packages/cli/dist/index.js verify -f ./examples/simple.yaml
```

执行完成后，你将拥有：
- ✅ OpenClaw 运行在 `http://127.0.0.1:18000`
- ✅ Controller 运行在 `http://127.0.0.1:8787`
- ✅ Worker 已注册并在线
- ✅ OpenCode 运行在 `http://127.0.0.1:4096`
- ✅ Webhook 已配置并可接收任务

详细说明请参考：[一键部署功能说明](./docs/one-click-deployment.md)

### 自定义配置

如果需要自定义配置，推荐直接使用 `init` 生成简化配置；如需旧版完整流程，再使用 setup 向导：

```bash
# 默认交互式生成简化配置
node ./packages/cli/dist/index.js init

# 如需生成完整配置
node ./packages/cli/dist/index.js init --full

# 旧版 setup 向导（完整配置流）
node ./packages/cli/dist/index.js setup

# 诊断配置
node ./packages/cli/dist/index.js doctor -f ./clawkit.yaml

# 执行部署
node ./packages/cli/dist/index.js apply -f ./clawkit.yaml --deploy

# 完成 onboarding
node ./packages/cli/dist/index.js onboard -f ./clawkit.yaml

# 验证部署
node ./packages/cli/dist/index.js verify -f ./clawkit.yaml
```

### 常用命令

```bash
# 查看 CLI 帮助
node ./packages/cli/dist/index.js --help

# 交互式生成简化配置
node ./packages/cli/dist/index.js init

# 诊断配置问题
node ./packages/cli/dist/index.js doctor -f ./examples/simple.yaml

# 预览部署计划
node ./packages/cli/dist/index.js plan -f ./examples/simple.yaml

# 生成配置文件（不部署）
node ./packages/cli/dist/index.js apply -f ./examples/simple.yaml --dry-run

# 生成配置并执行部署
node ./packages/cli/dist/index.js apply -f ./examples/simple.yaml --deploy

# Onboarding 辅助
node ./packages/cli/dist/index.js onboard -f ./examples/simple.yaml

# 端到端验证
node ./packages/cli/dist/index.js verify -f ./examples/simple.yaml

# 生成修复计划
node ./packages/cli/dist/index.js heal -f ./examples/simple.yaml --dry-run
```

### 快速脚本

根目录已提供便于试运行和联调的脚本：

```bash
# 一键部署（简化配置优先）
pnpm quickstart

# 使用旧版完整配置脚本
pnpm quickstart:full

# 开发环境快速启动
pnpm quickstart:dev

# 烟雾测试
pnpm smoke
```

脚本详细说明见 [`scripts/README.md`](./scripts/README.md)。

### 真实执行模式（推荐用于本地长期联调）

如果你已经准备好 OpenCode 服务密码，并希望稳定使用“真实执行”而不是 placeholder fallback，可以直接使用根目录脚本三件套：

```bash
# 1. 先设置 OpenCode 服务密码
export OPENCODE_SERVER_PASSWORD="your-password"

# 2. 启动真实执行全链路（OpenCode + controller + worker）
bash ./scripts/start-real-stack.sh

# 3. 停止真实执行全链路
bash ./scripts/stop-real-stack.sh

# 4. 重启真实执行全链路
bash ./scripts/restart-real-stack.sh
```

这套脚本默认会：

- 使用 `clawkit.yaml` 作为 manifest
- 使用 `replace-me` 作为本地测试用 OpenClaw webhook token
- 启动真实 OpenCode 执行模式（`WORKER_PLACEHOLDER_FALLBACK=false`）
- 将 PID 写入 `.clawkit/*.pid`

启动完成后常用入口：

- Web Console：`http://127.0.0.1:8787`
- Controller 日志：`.clawkit/logs/controller.log`
- Worker 日志：`.clawkit/logs/worker.log`
- OpenCode 日志：`opencode.log`

## 最小联调路径

如果只是验证链路是否打通，可以按下面的最小路径开始：

1. 选择或生成一个 manifest，例如 `examples/simple.yaml`
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
- [`docs/simplified-quick-start.md`](./docs/simplified-quick-start.md)：简化配置快速开始
- [`docs/cli.md`](./docs/cli.md)：CLI 命令说明
- [`docs/manifest.md`](./docs/manifest.md)：manifest 结构与字段说明
- [`docs/archive.md`](./docs/archive.md)：历史文档索引（阶段资料、验收记录、试运行记录）
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
