# clawkit 项目总体说明

## 项目简介

**clawkit** 是一个用于串联 OpenClaw、controller、worker 与 OpenCode 的轻量工具集，提供完整的一键部署能力和任务接入、审批、派发、执行的全流程自动化。

**核心定位**：最小可运行、可验证、可部署的 MVP，而非通用 DevOps 平台。

**版本**：0.1.0（2026-05-26）

---

## 一、系统架构

### 1.1 核心组件关系

```
OpenClaw --webhook--> controller --派发--> worker --调用--> OpenCode
                          ^
                          |
                     Web Console
```

### 1.2 组件职责

| 组件 | 职责 | 位置 |
|------|------|------|
| **CLI** | 用户交互入口，提供 init/doctor/plan/apply/heal/onboard/verify 命令 | `packages/cli` |
| **Controller** | 后端核心服务，接收 webhook、管理任务草稿与审批、派发任务、提供 HTTP API | `packages/controller` |
| **Worker** | 执行节点，向 controller 注册、拉取任务、调用 OpenCode 执行、回传结果 | `packages/worker` |
| **Web Console** | 轻量前端，展示状态、编辑配置、触发操作 | `packages/web` |
| **Shared** | 共享 schema、接口、类型与校验工具 | `packages/shared` |

### 1.3 最小运行理解

- **只查看页面**：启动 controller
- **验证任务派发**：启动 controller + worker
- **验证 webhook 接入**：准备 OpenClaw 侧调用入口
- **验证真实执行**：准备 OpenCode 服务（`opencode serve`）

---

## 二、支持的部署拓扑

clawkit 围绕同一套 manifest 支持三种基础拓扑：

### 2.1 单机模式（All-in-One）

```
┌─────────────────────────────────────┐
│          单台机器                    │
│  ┌─────────────────────────────┐   │
│  │ OpenClaw + OpenCode         │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ Controller + Worker         │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**适用场景**：本地开发测试、小规模部署、资源受限环境

**示例配置**：`examples/all-in-one.yaml`

### 2.2 混合模式（Hybrid）

```
┌─────────────────────┐      ┌─────────────────────┐
│     云端机器        │      │     本地机器        │
│  ┌──────────────┐   │      │  ┌──────────────┐   │
│  │  OpenClaw    │   │      │  │  OpenCode    │   │
│  └──────────────┘   │      │  └──────────────┘   │
│  ┌──────────────┐   │      │  ┌──────────────┐   │
│  │ Controller   │   │◄────►│  │   Worker     │   │
│  └──────────────┘   │      │  └──────────────┘   │
└─────────────────────┘      └─────────────────────┘
```

**适用场景**：云端管理，本地执行

**示例配置**：`examples/hybrid.yaml`

### 2.3 双机模式（Split）

```
┌─────────────────────┐      ┌─────────────────────┐
│     A 机器          │      │     B 机器          │
│  ┌──────────────┐   │      │  ┌──────────────┐   │
│  │  OpenClaw    │   │      │  │  OpenCode    │   │
│  └──────────────┘   │      │  └──────────────┘   │
│  ┌──────────────┐   │      │  ┌──────────────┐   │
│  │ Controller   │   │◄────►│  │   Worker     │   │
│  └──────────────┘   │      │  └──────────────┘   │
└─────────────────────┘      └─────────────────────┘
```

**适用场景**：完全分离的远程部署

**示例配置**：`examples/split.yaml`

---

## 三、核心功能链路

### 3.1 任务接入与审批流

```
1. OpenClaw 通过 webhook 发送研发任务文本
   ↓
2. Controller 识别任务协议，创建 TaskDraft、TaskMemory、PromptDraft
   ↓
3. 任务进入等待确认状态（支持修改草案、确认派发、取消任务）
   ↓
4. 用户在 Web Console 确认派发
   ↓
5. 任务进入已确认状态
```

### 3.2 任务派发与执行

```
1. Controller 派发已确认任务给可用 worker
   ↓
2. Worker 拉取任务
   ↓
3. Worker 调用 OpenCode 或 placeholder executor 执行
   ↓
4. 执行结果回传 controller
   ↓
5. 结果以摘要形式返回给调用侧
```

### 3.3 部署流程

```
1. 用户准备或生成 manifest 配置
   ↓
2. 执行 doctor 诊断配置问题
   ↓
3. 执行 plan 预览部署计划
   ↓
4. 执行 apply 生成配置文件并部署
   ↓
5. 执行 onboard 完成 OpenClaw webhook 配置
   ↓
6. 执行 verify 验证所有组件运行状态
```

---

## 四、仓库结构

### 4.1 Monorepo 工作区

```
clawkit/
├── packages/
│   ├── cli/              # 命令行工具入口
│   ├── controller/       # 控制器服务
│   ├── worker/           # 工作节点
│   ├── web/              # Web Console 前端
│   ├── shared/           # 共享代码（schema、类型、工具）
│   └── templates/        # 模板位目录（运行时生成）
├── docs/                 # 详细设计与文档
├── examples/             # 示例配置（all-in-one/hybrid/split）
├── scripts/              # 快速启动与联调脚本
├── data/                 # SQLite 数据库（运行时生成）
└── .clawkit/             # 部署生成文件（运行时生成）
```

### 4.2 关键文件

| 文件 | 说明 |
|------|------|
| `package.json` | 根工作区配置 |
| `pnpm-workspace.yaml` | pnpm workspace 定义 |
| `tsconfig.base.json` | TypeScript 基础配置 |
| `AGENTS.md` | AI 协作规则 |
| `clawkit.yaml` | 默认配置文件（用户生成） |

---

## 五、快速开始

### 5.1 环境要求

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Docker（如果使用 local 模式部署 OpenClaw）

### 5.2 一键部署（推荐）

```bash
# 1. 安装依赖并构建
pnpm install
pnpm build

# 2. 一键部署
pnpm quickstart

# 3. 完成 OpenClaw onboarding
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

### 5.3 常用命令

```bash
# 查看帮助
node ./packages/cli/dist/index.js --help

# 交互式生成配置
node ./packages/cli/dist/index.js init

# 诊断配置问题
node ./packages/cli/dist/index.js doctor -f ./clawkit.yaml

# 预览部署计划
node ./packages/cli/dist/index.js plan -f ./clawkit.yaml

# 生成配置（不部署）
node ./packages/cli/dist/index.js apply -f ./clawkit.yaml --dry-run

# 生成配置并部署
node ./packages/cli/dist/index.js apply -f ./clawkit.yaml --deploy

# Onboarding 辅助
node ./packages/cli/dist/index.js onboard -f ./clawkit.yaml

# 端到端验证
node ./packages/cli/dist/index.js verify -f ./clawkit.yaml

# 生成修复计划
node ./packages/cli/dist/index.js heal -f ./clawkit.yaml --dry-run
```

### 5.4 快速脚本

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

---

## 六、CLI 命令说明

### 6.1 init - 初始化配置

生成新的 manifest 配置文件。

```bash
node ./packages/cli/dist/index.js init [--full]
```

- `--full`：生成完整配置（默认生成简化配置）

### 6.2 doctor - 诊断配置

检查 manifest 配置是否有问题。

```bash
node ./packages/cli/dist/index.js doctor -f <manifest-file>
```

### 6.3 plan - 预览部署计划

显示将要执行的部署步骤。

```bash
node ./packages/cli/dist/index.js plan -f <manifest-file>
```

### 6.4 apply - 执行部署

生成配置文件并执行部署。

```bash
node ./packages/cli/dist/index.js apply -f <manifest-file> [--dry-run] [--deploy]
```

- `--dry-run`：仅生成配置，不执行部署
- `--deploy`：执行部署（包括启动服务）

### 6.5 heal - 生成修复计划

识别常见问题并输出修复建议。

```bash
node ./packages/cli/dist/index.js heal -f <manifest-file> [--dry-run]
```

### 6.6 onboard - Onboarding 辅助

交互式引导完成 OpenClaw webhook 配置。

```bash
node ./packages/cli/dist/index.js onboard -f <manifest-file>
```

### 6.7 verify - 端到端验证

验证所有组件运行状态。

```bash
node ./packages/cli/dist/index.js verify -f <manifest-file>
```

---

## 七、当前版本包含什么

### 7.1 已实现功能

- ✅ manifest schema 与三种拓扑示例
- ✅ CLI：`init / doctor / plan / apply / heal / onboard / verify`
- ✅ Controller：
  - 研发任务协议解析
  - TaskDraft / TaskMemory / PromptDraft 草稿管理
  - 审批状态机
  - HTTP API
  - OpenClaw webhook 接入
  - SQLite 持久化
- ✅ Worker：
  - 注册、心跳、拉取任务、结果回传
  - OpenCodeExecutor 主路径
  - PlaceholderExecutor 回退路径
- ✅ Web Console：
  - 总览、配置、部署、修复、状态、任务中心
  - Setup 向导（预设选择 + YAML 编辑 + 编排执行）
- ✅ 部署能力：
  - OpenClaw 一键部署（支持本地 Docker 或外部实例）
  - OpenCode 一键安装（支持本地安装或外部实例）
  - 三种部署模式（local / external / skip）
  - 自动执行流程（doctor / plan / apply / deploy）
  - 非阻塞失败处理

### 7.2 明确不做什么

- ❌ 复杂 Web 管理后台
- ❌ 自动 PR 或自动部署业务代码
- ❌ 复杂远程环境编排
- ❌ 多 worker 复杂调度
- ❌ push 模式派发
- ❌ 复杂权限系统
- ❌ controller 侧真实大模型生成 Prompt
- ❌ OpenClaw 自动 onboarding（需要用户手动配置）
- ❌ OpenCode 多实例/多端口编排
- ❌ OpenCode 版本管理与升级

---

## 八、关键边界与限制

### 8.1 运行时边界

1. **e2e-local-demo.js** 默认允许 placeholder fallback，适合链路验证，不代表真实 OpenCode 执行环境已验收
2. **真实 OpenCode 执行** 需要先启动 `opencode serve` 并关闭 `WORKER_PLACEHOLDER_FALLBACK`
3. **SQLite 持久化** 默认路径为 `data/clawkit.db`，可通过环境变量 `CONTROLLER_DB_PATH` 覆盖
4. **Web Console** 保存 manifest 后不会自动刷新运行态，需要手动重启 controller/worker

### 8.2 部署边界

1. **apply 命令** 负责校验、生成配置、本地写入、SSH 远程写入，但不负责远程代码同步、自动安装依赖、自动安装 systemd
2. **heal 命令** 负责识别常见问题和修复本地文件，但不负责远程自动修复或自动重启服务
3. **OpenClaw 部署** 支持本地 Docker 或外部实例，但不支持多实例编排、版本管理、自动 onboarding
4. **OpenCode 安装** 支持本地一键安装或外部实例，但不支持多实例编排、包管理升级、systemd 管理、远程节点安装

### 8.3 功能边界

1. **manifest 配置** 是静态的，不会自动同步到 OpenClaw 内部配置
2. **Setup 向导** 当前是"预设 + YAML 编辑 + 编排执行"，不是逐字段完整表单式向导
3. **templates 目录** 是模板位目录，最小部署文件由 CLI 运行时生成，不是从静态模板拷贝

---

## 九、环境变量

### 9.1 Controller 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENCLAW_WEBHOOK_TOKEN` | webhook 鉴权 token | 无 |
| `CONTROLLER_DB_PATH` | SQLite 数据库路径 | `data/clawkit.db` |
| `CONTROLLER_ENABLE_PERSISTENCE` | 是否启用持久化 | `true` |
| `CLAWKIT_MANIFEST_PATH` | manifest 文件路径 | 无 |

### 9.2 Worker 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `WORKER_PLACEHOLDER_FALLBACK` | 是否允许 placeholder 回退 | `true` |
| `OPENCODE_SERVER_BASE_URL` | OpenCode 服务地址 | `http://127.0.0.1:4096` |
| `OPENCODE_SERVER_PASSWORD` | OpenCode 服务密码 | 无 |
| `OPENCODE_SERVER_PASSWORD_ENV` | 密码环境变量名 | `OPENCODE_SERVER_PASSWORD` |

---

## 十、文档索引

按使用场景建议优先阅读：

| 文档 | 适用场景 |
|------|---------|
| [`docs/quick-start.md`](./docs/quick-start.md) | 一键部署与快速上手 |
| [`docs/simplified-quick-start.md`](./docs/simplified-quick-start.md) | 简化配置快速开始 |
| [`docs/cli.md`](./docs/cli.md) | CLI 命令详细说明 |
| [`docs/manifest.md`](./docs/manifest.md) | manifest 结构与字段说明 |
| [`docs/project-scope.md`](./docs/project-scope.md) | 当前版本做什么、不做什么 |
| [`docs/e2e.md`](./docs/e2e.md) | 本地联调与真实 OpenCode 执行验证 |
| [`docs/web-console.md`](./docs/web-console.md) | Web Console 与 Setup 向导 |
| [`docs/controller-api.md`](./docs/controller-api.md) | controller HTTP API |
| [`docs/openclaw-webhook.md`](./docs/openclaw-webhook.md) | OpenClaw webhook 接入与交互协议 |
| [`docs/controller-flow.md`](./docs/controller-flow.md) | controller 内部草稿与审批闭环 |
| [`docs/dispatch-flow.md`](./docs/dispatch-flow.md) | 任务派发、执行与结果回写链路 |
| [`docs/worker.md`](./docs/worker.md) | worker 设计与运行说明 |
| [`docs/architecture.md`](./docs/architecture.md) | 系统架构设计 |
| [`docs/known-limitations.md`](./docs/known-limitations.md) | 已知限制与边界 |

---

## 十一、开发说明

### 11.1 常用工作区命令

```bash
# 构建所有包
pnpm build

# 运行所有测试
pnpm test

# 类型检查所有包
pnpm lint

# 清理所有构建产物
pnpm clean
```

### 11.2 单包开发

进入对应 package 目录查看 `package.json` 中的脚本定义：

```bash
cd packages/cli && pnpm build
cd packages/controller && pnpm build
cd packages/worker && pnpm build
cd packages/web && pnpm dev
```

### 11.3 代码规范

- **语言**：代码注释、文档、对话一律使用中文
- **标识符**：遵循 TypeScript 社区惯例（通常为英文）
- **类型**：使用严格模式，避免 `any`
- **错误处理**：必须处理所有可能的错误情况，错误信息使用中文

### 11.4 提交规范

使用 Conventional Commits 格式：

```
<type>(<scope>): <中文摘要>

<详细说明>
```

类型：`feat / fix / docs / refactor / test / chore`

---

## 十二、故障排查

### 12.1 页面显示异常或总览数据为空

**原因**：controller 未启动或版本不正确

**解决**：
1. 检查 controller 是否已启动：`ps aux | grep controller`
2. 查看 controller 日志：`tail -f .clawkit/controller.log`
3. 重新启动 controller：`pnpm quickstart`

### 12.2 新增 API 返回 404

**原因**：controller 版本过旧

**解决**：
1. 重新构建：`pnpm build`
2. 重新启动 controller：`pnpm quickstart`

### 12.3 manifest 无法读取或配置页报错

**原因**：manifest 文件格式错误或路径不正确

**解决**：
1. 检查 manifest 路径：`node ./packages/cli/dist/index.js doctor -f ./clawkit.yaml`
2. 查看诊断输出，按提示修复
3. 重新启动 controller

### 12.4 Worker 无法连接到 OpenCode

**原因**：OpenCode 未启动或地址配置错误

**解决**：
1. 检查 OpenCode 是否已启动：`ps aux | grep opencode`
2. 检查 `OPENCODE_SERVER_BASE_URL` 环境变量
3. 启动 OpenCode：`pnpm opencode`

---

## 十三、贡献指南

### 13.1 开发流程

1. **理解需求**：先确认理解正确，再开始实现
2. **分步执行**：一次只做一件事，完成后再继续
3. **保持简单**：不过度设计，不提前优化
4. **中文交流**：所有解释、注释、文档使用中文
5. **验证结果**：每次修改后验证构建和类型检查

### 13.2 禁止行为

- ❌ 一次性实现多个功能
- ❌ 引入未讨论的依赖
- ❌ 修改不相关的代码
- ❌ 删除现有功能（除非明确要求）

### 13.3 协作规则

详见 [`AGENTS.md`](./AGENTS.md)

---

## 十四、许可证

本项目采用 MIT 许可证。详见 [`LICENSE`](./LICENSE)

---

## 十五、联系与反馈

- **问题报告**：https://github.com/anomalyco/opencode
- **文档反馈**：提交 issue 或 PR
- **功能建议**：在 issue 中详细描述需求与使用场景

---

**最后更新**：2026-05-26
