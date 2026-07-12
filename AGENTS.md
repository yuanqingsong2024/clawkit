# clawkit 项目协作规则

本文档定义了 clawkit 项目的开发规范与 AI 协作规则。

## 语言规范

- **代码注释**：必须使用中文
- **文档**：必须使用中文
- **对话与解释**：必须使用中文
- **代码标识符**：遵循 TypeScript 社区惯例（通常为英文）

## 项目结构与构建

### Monorepo 结构

这是一个 pnpm workspace monorepo，工作区定义在 `packages/*`：

- `packages/cli`：命令行工具（`init / doctor / plan / apply / heal`）
- `packages/controller`：控制器服务（HTTP API、webhook 接入、任务派发、SQLite 持久化）
- `packages/worker`：工作节点（注册、心跳、拉取任务、执行任务、结果回传）
- `packages/web`：轻量 Web Console（React + Vite + Tailwind）
- `packages/shared`：共享代码（schema、接口、类型、校验工具）
- `packages/templates`：模板位目录（部署文件由 CLI 运行时生成，不是静态模板）

### 关键构建顺序

**controller 依赖 cli**：`packages/controller/package.json` 的 build 脚本会先构建 cli：
```bash
pnpm --filter @clawkit/cli build && tsc && ...
```

修改 cli 后必须重新构建 controller。

### 常用命令

```bash
# 根目录 monorepo 命令（会递归执行所有 package）
pnpm build          # 构建所有包
pnpm test           # 运行所有测试
pnpm lint           # 类型检查所有包
pnpm clean          # 清理所有构建产物

# 快速启动脚本
pnpm quickstart     # 一键部署（优先使用 ./scripts/quick-start-simple.sh）
pnpm quickstart:full # 旧版完整配置一键部署（./scripts/quick-start.sh）
pnpm quickstart:dev # 开发环境快速启动（./scripts/quick-start-dev.sh）
pnpm smoke          # 烟雾测试（./scripts/smoke-test.sh）

# CLI 命令（需要先 pnpm build）
node ./packages/cli/dist/index.js --help
node ./packages/cli/dist/index.js init
node ./packages/cli/dist/index.js doctor -f ./examples/simple.yaml
node ./packages/cli/dist/index.js plan -f ./examples/simple.yaml
node ./packages/cli/dist/index.js apply -f ./examples/simple.yaml --dry-run

# 单包命令（进入对应 package 目录）
cd packages/controller && pnpm build
cd packages/worker && pnpm start
cd packages/web && pnpm dev
```

## 核心链路理解

### 运行时组件关系

```
OpenClaw --webhook--> controller --派发--> worker --调用--> OpenCode
                          ^
                          |
                     Web Console
```

**最小运行要求**：
- 只想打开页面查看配置/状态：至少启动 `controller`
- 想验证任务派发与 worker 状态：同时启动 `controller` 和 `worker`
- 想验证 OpenClaw webhook 接入：还需要准备 OpenClaw 侧调用入口
- 想验证真实执行而不是 placeholder fallback：还需要准备 OpenCode 服务

**关键边界**：
- `e2e-local-demo.js` 默认允许 placeholder fallback，适合验证链路打通
- 若要验证真实 OpenCode 执行，需要先启动 `opencode serve` 并关闭 `WORKER_PLACEHOLDER_FALLBACK`
- controller 使用 SQLite 持久化，默认数据库路径为 `data/clawkit.db`
- Web Console 保存 manifest 后不会自动刷新运行态，需要手动重启 controller/worker

### 关键环境变量

**Controller**：
- `OPENCLAW_WEBHOOK_TOKEN`：webhook 鉴权 token（必须与 OpenClaw 配置一致）
- `CONTROLLER_DB_PATH`：SQLite 数据库路径（默认 `data/clawkit.db`）
- `CONTROLLER_ENABLE_PERSISTENCE`：是否启用持久化（默认 `true`）
- `CLAWKIT_MANIFEST_PATH`：manifest 文件路径

**Worker**：
- `WORKER_PLACEHOLDER_FALLBACK`：是否允许 placeholder 回退（`true` / `false`）
- `OPENCODE_SERVER_BASE_URL`：OpenCode 服务地址（默认 `http://127.0.0.1:4096`）
- `OPENCODE_SERVER_PASSWORD`：OpenCode 服务密码
- `OPENCODE_SERVER_PASSWORD_ENV`：密码环境变量名（默认 `OPENCODE_SERVER_PASSWORD`）

### 三种部署拓扑

1. **all-in-one**：OpenClaw、controller、worker、OpenCode 部署在同一台机器
2. **hybrid**：OpenClaw + controller 在云端，worker + OpenCode 在本地
3. **split**：OpenClaw + controller 在 A 机器，worker + OpenCode 在 B 机器

示例配置见 `examples/simple.yaml`、`examples/minimal.yaml`、`examples/all-in-one.yaml`、`examples/hybrid.yaml`、`examples/split.yaml`。

## 开发原则

### 1. 最小可用版本优先

- 优先实现核心功能，避免过度设计
- 每个阶段只完成明确定义的目标
- 不提前实现未来可能需要的功能

### 2. 禁止过度设计

- 不引入不必要的抽象层
- 不使用复杂的设计模式（除非确有必要）
- 保持代码简单直接

### 3. 明确阶段目标

每次开发必须明确：
- 当前阶段要做什么
- 当前阶段不做什么
- 验收标准是什么

## 代码规范

### TypeScript 规范

- 使用严格模式（strict: true）
- 避免使用 `any`，必要时使用 `unknown`
- 优先使用接口（interface）而非类型别名（type）
- 函数必须有明确的返回类型

### 注释规范

```typescript
// 单行注释：解释"为什么"而不是"做什么"
function deployController() {
  // 使用 spawn 而非 exec，因为需要实时输出日志
  const process = spawn('node', ['controller.js']);
}

/**
 * 多行注释：用于函数、类、接口
 * @param config 部署配置对象
 * @returns 部署结果，包含状态和错误信息
 */
async function deploy(config: DeployConfig): Promise<DeployResult> {
  // 实现
}
```

### 错误处理

- 必须处理所有可能的错误情况
- 错误信息必须清晰且可操作
- 使用中文错误信息

```typescript
try {
  await deployService();
} catch (error) {
  throw new Error(`部署失败：${error.message}`);
}
```

### 依赖管理

- 共享依赖放在根 `package.json`
- 特定依赖放在各 package 的 `package.json`
- 使用 `workspace:*` 引用内部包

## Git 规范

### 提交信息格式

```
<type>(<scope>): <subject>

<body>
```

类型（type）：
- `feat`：新功能
- `fix`：修复 bug
- `docs`：文档更新
- `refactor`：重构
- `test`：测试相关
- `chore`：构建、工具等

示例：
```
feat(cli): 添加 init 命令

实现项目初始化命令，支持交互式配置生成。
```

## 开发流程

### 1. 需求确认

- 明确功能范围
- 确定验收标准
- 识别技术风险

### 2. 设计方案

- 简单设计，避免过度
- 考虑现有代码结构
- 评估实现成本

### 3. 实现开发

- 小步提交，频繁集成
- 先实现核心路径
- 后补充边界情况

### 4. 测试验证

- 手动测试核心功能
- 确保构建通过
- 检查类型错误

## AI 协作规则

### 对 AI 的要求

1. **理解需求**：先确认理解正确，再开始实现
2. **分步执行**：一次只做一件事，完成后再继续
3. **保持简单**：不过度设计，不提前优化
4. **中文交流**：所有解释、注释、文档使用中文
5. **验证结果**：每次修改后验证构建和类型检查

### 禁止行为

- 不要一次性实现多个功能
- 不要引入未讨论的依赖
- 不要修改不相关的代码
- 不要删除现有功能（除非明确要求）

## 项目阶段与范围

### 已完成阶段

**第一阶段：项目初始化**（已完成）

- ✅ 创建目录结构
- ✅ 配置构建工具
- ✅ 编写基础文档
- ✅ 创建最小骨架代码

**第二阶段：MVP 主链路实现**（已完成）

- ✅ controller / worker 任务派发与执行链路
- ✅ OpenClaw webhook 接入与协议解析
- ✅ TaskDraft / TaskMemory / PromptDraft 草稿与审批流
- ✅ Web Console 轻量控制台
- ✅ SQLite 持久化
- ✅ OpenCode 执行链路（含 placeholder fallback）
- ✅ 三种拓扑示例配置与最小部署能力

### 当前阶段范围

**当前版本包含**：

- manifest schema 与三种拓扑示例（all-in-one / hybrid / split）
- CLI：`init / doctor / plan / apply / heal`
- controller：任务协议解析、草稿审批、HTTP API、webhook 接入、派发编排
- worker：注册、心跳、拉取任务、执行任务、结果回传
- Web Console：总览、配置、部署、修复、状态、任务中心、Setup 向导
- 本地 E2E 联调脚本与最小部署自动化

**当前版本明确不做**（不是缺陷）：

- 复杂 Web 管理后台能力
- 自动 PR 或自动部署生产业务代码
- 复杂远程环境编排
- 多 worker 复杂调度与 push 模式派发
- 复杂权限系统
- controller 侧真实大模型生成 Prompt

详细范围说明请参考 [`docs/project-scope.md`](./docs/project-scope.md)。

## 问题处理

遇到问题时：
1. 先尝试理解问题根源
2. 查看相关文档和代码
3. 提出解决方案并说明理由
4. 等待确认后再实施

## 文档维护

- 代码变更必须同步更新文档
- 新增功能必须补充使用说明
- 架构变更必须更新架构文档
