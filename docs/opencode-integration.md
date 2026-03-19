# OpenCode 集成说明

## 为什么优先使用 `opencode serve + SDK`

本阶段优先使用 `opencode serve + @opencode-ai/sdk`，原因如下：

1. worker 与 OpenCode 部署在同一台机器，走本机 `127.0.0.1` 即可完成连接。
2. SDK 提供稳定的 `health -> session.create -> session.prompt -> session.messages/status` 调用链，更适合做结构化结果回传。
3. 相比直接散落 CLI 调用，SDK 更容易统一处理超时、认证、错误信息和后续扩展。

CLI 仍保留为备用模式，但不是主执行路径。

## 本阶段支持内容

- 单项目、单 worker、串行执行
- worker 真实调用本机 OpenCode server
- 读取项目 `AGENTS.md`
- 可选读取 `.opencode/commands/`、`skills/`、`.opencode/oh-my-opencode.jsonc`
- 将执行结果结构化回传给 controller
- controller 状态查询展示真实执行摘要

## 本阶段不支持内容

- 多 worker 并发执行
- 自动 PR
- 自动部署上线
- 复杂权限系统
- controller 侧真实模型推理

> 说明：当前仓库已经包含 Web Console，但它是对现有 controller / CLI 能力的可视化外壳，不属于 OpenCode 执行链路本身。

## 本机 OpenCode server 配置

建议使用以下环境变量：

```bash
export OPENCODE_SERVER_USERNAME="opencode"
export OPENCODE_SERVER_PASSWORD="your-password"
```

启动命令：

```bash
opencode serve --hostname 127.0.0.1 --port 4096
```

worker 默认优先连接：

- `OPENCODE_SERVER_BASE_URL`，例如 `http://127.0.0.1:4096`
- 若未提供，则退回到项目配置里的 `openCode.port`

## worker 配置项

通过环境变量配置：

```bash
export CLAWKIT_MANIFEST_PATH="/path/to/clawkit.yaml"
export CONTROLLER_URL="http://127.0.0.1:8787"
export WORKER_ID="local-worker"
export WORKER_SUPPORTED_PROJECTS="clawkit"
export OPENCODE_EXECUTION_MODE="sdk"
export OPENCODE_SERVER_BASE_URL="http://127.0.0.1:4096"
export OPENCODE_SERVER_USERNAME="opencode"
export OPENCODE_SERVER_PASSWORD_ENV="OPENCODE_SERVER_PASSWORD"
export OPENCODE_TIMEOUT_MS="300000"
```

可选启用占位回退：

```bash
export WORKER_PLACEHOLDER_FALLBACK="true"
```

## 项目规则读取

worker 执行前会读取：

1. `AGENTS.md`
2. `.opencode/commands/`
3. `skills/`
4. `.opencode/oh-my-opencode.jsonc`

其中：

- `AGENTS.md` 缺失时会明确提示，但不会强制失败
- 其余目录或文件缺失时自动降级，不中断执行

## 最小联调流程

### 1. 启动 controller

```bash
export CLAWKIT_MANIFEST_PATH="$(pwd)/clawkit.yaml"
pnpm --filter @clawkit/controller start
```

### 2. 启动 worker

```bash
export CLAWKIT_MANIFEST_PATH="$(pwd)/clawkit.yaml"
export CONTROLLER_URL="http://127.0.0.1:8787"
export WORKER_ID="local-worker"
export WORKER_SUPPORTED_PROJECTS="clawkit"
export OPENCODE_EXECUTION_MODE="sdk"
export OPENCODE_SERVER_BASE_URL="http://127.0.0.1:4096"
pnpm --filter @clawkit/worker start
```

### 3. 启动 OpenCode server

```bash
export OPENCODE_SERVER_USERNAME="opencode"
export OPENCODE_SERVER_PASSWORD="your-password"
opencode serve --hostname 127.0.0.1 --port 4096
```

### 4. 创建任务

调用 controller 的任务创建接口，生成 task draft。

### 5. 审批任务

将任务状态推进到 `approved`。

### 6. worker 拉取并执行

worker 轮询 `/api/workers/:workerId/pull`，拿到编译后的执行卡片后调用 OpenCode。

### 7. 查询结果

通过 `/api/tasks/:taskId/status` 查看真实执行摘要。
