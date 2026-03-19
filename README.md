# clawkit

一键部署、配置并串联 OpenClaw 与 OpenCode 的轻量工具。

---

> ## ⚠️ 重要验收边界说明
> 
> **当前版本（v0.1.1）已支持 controller 核心状态 SQLite 持久化，适合持续试运行，但仍存在部分运行态刷新边界。**
> 
> ### 关键限制
> 
> 1. **默认 E2E 验证 ≠ 真实 OpenCode 执行验证**
>    - `node ./scripts/e2e-local-demo.js` 默认允许 **placeholder fallback**
>    - 它只能证明**链路打通**，不能证明**真实 OpenCode 执行能力已验收**
>    - 若要验证真实执行，必须：
>      - 本机启动 `opencode serve`
>      - 关闭 `WORKER_PLACEHOLDER_FALLBACK`
>      - 确认 `placeholderExecution=false`
>    - 详见 [docs/e2e.md](./docs/e2e.md)
> 
> 2. **Controller 核心状态已持久化，但仍建议明确配置数据库路径**
>    - 任务、草稿、提示草稿、审批记录已接入 **SQLite 持久化**
>    - **Controller 重启后可恢复已创建任务与相关草稿状态**
>    - 默认数据库路径为 `data/clawkit.db`
>    - 可通过 `CONTROLLER_DB_PATH` 自定义数据库路径
> 
> 3. **Manifest 保存后仍需手动重启**
>    - Web Console 保存 manifest 后，配置不会自动生效
>    - 需要手动重启 controller/worker 进程
> 
> 完整限制说明见 [docs/known-limitations.md](./docs/known-limitations.md)

---

## 项目状态

**当前阶段：最终验收与发布收口阶段**

当前仓库已具备首个 MVP 所需的最小主链路：

- ✅ 项目初始化与 manifest 校验
- ✅ `clawkit init / doctor / plan / apply / heal`
- ✅ controller 草稿、记忆、审批流与 HTTP API
- ✅ OpenClaw webhook 接入与 token 鉴权
- ✅ worker 注册、心跳、pull、result 回传
- ✅ OpenCodeExecutor 真实执行主链路（SDK / CLI 双路径）
- ✅ 单机模式最小链路联调
- ✅ 混合模式最小部署说明
- ✅ Web Console（页面、API、生产静态文件托管）
- ✅ Setup 向导（预设选择 + YAML 编辑 + 一键执行流程 + 实时状态显示）

当前阶段明确不做：

- ❌ 复杂 Web 管理后台能力
- ❌ 自动 PR
- ❌ 自动部署生产业务代码
- ❌ controller 侧真实模型推理
- ❌ 复杂远程环境编排

当前阶段需要注意的边界：

- 单机 E2E 脚本当前默认允许 `placeholder fallback`，适合验证链路打通。
- 若要严格验证真实 OpenCode 执行，需本机先启动 OpenCode server，并关闭 `WORKER_PLACEHOLDER_FALLBACK`。
- Controller 默认启用 SQLite 持久化；如需关闭，可设置 `CONTROLLER_ENABLE_PERSISTENCE=false`。
- Controller 默认数据库路径为 `data/clawkit.db`；如需自定义，可设置 `CONTROLLER_DB_PATH=/your/path/clawkit.db`。

## 项目简介

clawkit 旨在简化 OpenClaw 与 OpenCode 的部署与配置流程，支持三种部署拓扑：

1. **单机模式（all-in-one）**：OpenClaw、controller、worker、OpenCode 在同一台机器
2. **混合模式（hybrid）**：OpenClaw + controller 在云端，worker + OpenCode 在本地
3. **双机模式（split）**：OpenClaw + controller 在 A 机器，worker + OpenCode 在 B 机器

## 技术栈

- TypeScript（CommonJS，target ES2022）
- Node.js 20+
- pnpm workspace（monorepo）
- Zod（schema 校验）
- Commander（CLI 框架）
- chalk v4（终端着色）

## CLI 命令

| 命令 | 状态 | 说明 |
|---|---|---|
| `clawkit init` | ✅ 可用 | 交互式生成 `clawkit.yaml`，支持拓扑选择，并默认产出 template 模式配置 |
| `clawkit doctor` | ✅ 可用 | 诊断配置文件和环境（文件/YAML/Schema/Node.js/pnpm/路径/端口/SSH；输出条目随配置而变） |
| `clawkit plan` | ✅ 可用 | 读取 manifest，展示 dry-run 执行计划 |
| `clawkit apply` | ✅ 可用 | 最小真实部署写入、备份、systemd 文件与启动脚本生成 |
| `clawkit heal` | ✅ 可用 | 结构化诊断、修复计划与部分自动修复 |

详细文档见 [docs/cli.md](./docs/cli.md)。

## 目录结构

```
clawkit/
├── packages/
│   ├── cli/                 # 命令行工具（✅ 已实现 init/doctor/plan/apply/heal）
│   │   └── src/
│   │       ├── commands/    # 命令定义
│   │       ├── services/    # 业务逻辑（InitService/DoctorServiceImpl/PlanServiceImpl）
│   │       └── utils/       # 工具（logger、prompt）
│   ├── shared/              # 共享代码（✅ 已实现 schema/接口/类型）
│   │   └── src/
│   │       ├── schema/      # Zod schema 定义
│   │       ├── interfaces/  # 接口定义（DoctorService/PlanService）
│   │       ├── types/       # 类型定义（Manifest/RenderInput）
│   │       └── utils/       # 工具函数（校验格式化）
│   ├── controller/          # 控制器服务（✅ 协议解析、状态机、HTTP API、OpenClaw 接入）
│   │   └── src/
│   │       ├── models/      # 数据模型（TaskDraft/TaskMemory/PromptDraft/ApprovalRecord）
│   │       ├── protocol/    # 协议解析与识别
│   │       ├── services/    # 服务层（TaskDraftService/TaskMemoryService/PromptEngine）
│   │       └── persistence/ # 持久化（SQLite schema）
│   ├── worker/              # 工作节点（✅ 注册、心跳、pull、result、OpenCodeExecutor）
│   ├── web/                 # Web Console（✅ 页面、路由、API 调用、构建产物）
│   └── templates/           # 配置模板与说明
├── docs/                    # 项目文档
│   ├── cli.md               # CLI 使用文档
│   ├── doctor.md            # Doctor 诊断文档
│   ├── manifest.md          # Manifest 设计文档
│   ├── architecture.md      # 架构设计
│   ├── roadmap.md           # 开发路线图
│   ├── web-console.md       # Web Console 使用与部署说明
│   ├── e2e.md               # 端到端联调说明
│   ├── release-acceptance.md # 发布验收文档
│   ├── minimal-user-guide.md # 最小使用手册
│   ├── release-notes-v0.1.0-draft.md # 首发说明草稿
│   └── project-scope.md     # 项目范围
├── examples/                # 示例配置
│   ├── all-in-one.yaml      # 单机模式示例
│   ├── hybrid.yaml          # 混合模式示例
│   └── split.yaml           # 双机模式示例
├── scripts/                 # 构建脚本
└── AGENTS.md                # AI 协作规则
```

## 本地开发

### 环境要求

- Node.js >= 20.0.0
- pnpm >= 8.0.0

### 安装依赖

```bash
pnpm install
```

### 构建

```bash
pnpm build
```

### 运行测试

```bash
pnpm test
```

### 使用 CLI

```bash
# 交互式初始化配置
node ./packages/cli/dist/index.js init

# 诊断配置文件
node ./packages/cli/dist/index.js doctor -f ./examples/all-in-one.yaml

# 查看执行计划
node ./packages/cli/dist/index.js plan -f ./examples/all-in-one.yaml

# 预览最小部署写入
node ./packages/cli/dist/index.js apply -f ./examples/all-in-one.yaml --dry-run

# 诊断与修复计划
node ./packages/cli/dist/index.js heal -f ./examples/all-in-one.yaml --dry-run
```

## 最小运行步骤

### 1. 生成或准备 manifest

可直接使用：

- `examples/all-in-one.yaml`
- `examples/hybrid.yaml`
- `examples/split.yaml`

### 2. 构建项目

```bash
pnpm install
pnpm build
```

### 3. 预览部署结果

```bash
node ./packages/cli/dist/index.js apply -f ./examples/all-in-one.yaml --dry-run
```

### 4. 启动单机最小链路

如果只验证链路是否打通，可直接运行：

```bash
node ./scripts/e2e-local-demo.js
```

如果要严格验证真实 OpenCode 执行，请参考 [`docs/e2e.md`](./docs/e2e.md)。

## 错误处理说明

当前阶段的错误处理原则：

- webhook token 缺失或错误：返回明确 401 / 503 中文错误
- 任务协议不合法：返回结构化中文错误码与字段说明
- worker / project 不可用：返回清晰的派发失败原因
- OpenCode 不可达：返回结构化失败结果，并提示 `opencode serve` 启动方式
- `heal` 只自动修复本地生成文件，不擅自做远程高风险操作

详细说明见：

- [`docs/openclaw-webhook.md`](./docs/openclaw-webhook.md)
- [`docs/heal.md`](./docs/heal.md)
- [`docs/executor.md`](./docs/executor.md)
- [`docs/e2e.md`](./docs/e2e.md)

### 清理

```bash
pnpm clean
```

## 文档

- [CLI 使用文档](./docs/cli.md) — 命令详细说明与输出示例
- [Doctor 诊断文档](./docs/doctor.md) — 诊断检查项与报告格式
- [Manifest 设计文档](./docs/manifest.md) — 配置结构、字段说明、拓扑约束
- [Web Console 文档](./docs/web-console.md) — Web 界面能力、启动方式与生产静态托管
- [Setup 向导文档](./docs/setup-wizard.md) — 一键配置与部署流程使用说明
- [端到端联调说明](./docs/e2e.md) — 链路联调与真实 OpenCode 执行联调边界
- [发布验收文档](./docs/release-acceptance.md) — 首个版本发布判断依据
- [最小使用手册](./docs/minimal-user-guide.md) — 环境准备、启动步骤与常见问题
- [v0.1.0 首发说明草稿](./docs/release-notes-v0.1.0-draft.md) — 首个版本发布说明草稿
- [架构设计](./docs/architecture.md) — 系统架构
- [开发路线图](./docs/roadmap.md) — 阶段规划

## 当前发布结论

从当前代码、测试与文档状态看，仓库已经满足**首个可发布 MVP**的主要条件。

已验证证据：

- `pnpm build` 通过
- `pnpm test` 通过
- `node ./scripts/e2e-local-demo.js` 通过（链路验证）

发布前仍需关注：

- 当前运行环境若低于 Node.js 20，会出现 engine warning
- 严格真实 OpenCode 执行联调需要本机额外准备 OpenCode server 环境
- 当前仓库尚未声明正式开源许可证；若计划公开开源发布，建议先补充 `LICENSE`

## 许可证

当前仓库尚未声明正式开源许可证。

如果首版发布是内部 MVP，可先按当前状态发布；如果要公开开源发布，建议在发布前补充 `LICENSE` 文件。

## 贡献

欢迎贡献！请先阅读 [AGENTS.md](./AGENTS.md) 了解协作规则。
