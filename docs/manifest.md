# ClawKit Manifest 文档

## 1. 文档目标

manifest 是 clawkit 的统一输入模型，CLI、controller、worker 与部署文件生成都围绕它展开。

## 2. 顶层结构

```yaml
profile:
nodes:
services:
workers:
runtime:
notify:
deploy:
```

## 3. 核心字段

### 3.1 profile

```yaml
profile:
  name: "local-studio"
  version: "1.0.0"
  topology: "all-in-one"
  description: "单机开发与联调示例"
```

### 3.2 nodes

支持两类节点：

- `local`
- `ssh`

`ssh` 节点至少需要 `keyPath` 或 `password` 之一。

### 3.3 services

```yaml
services:
  controller:
    node: "local-dev"
    port: 8787
    apiPrefix: "/api"
  openClaw:
    node: "local-dev"
    deployMode: "skip"
    publicUrl: "http://127.0.0.1:8787"
    apiKey: "replace-me"
```

`services.openClaw.apiKey` 会在 `apply` 时写入 controller 的 `OPENCLAW_WEBHOOK_TOKEN`，用于校验 OpenClaw webhook 请求。示例中的 `replace-me` 仅作为占位值，正式部署前应替换为随机 token。

#### services.openClaw.deployMode

- 类型：`'local' | 'external' | 'skip'`
- 默认值：`'skip'`

三种模式说明：

- `local`：由 clawkit 负责 **本地 Docker 自动部署** OpenClaw（用于快速联调与最小落地）
- `external`：OpenClaw 由你在外部环境自行维护，clawkit 仅消费其 webhook 能力
- `skip`：跳过 OpenClaw 部署与相关环境检查（只保留 controller/worker/OpenCode 链路）

配置示例：

```yaml
services:
  openClaw:
    node: "local-dev"
    deployMode: "local" # local | external | skip
    publicUrl: "http://127.0.0.1:8787"
    apiKey: "replace-me"
```

注意事项：

1. `deployMode: local` 明确要求 `services.openClaw.node` 指向 **local 类型节点**；否则 schema 校验会失败。
2. `local` 模式下，OpenClaw 部署失败会以“步骤失败 + 非阻塞告警”的方式呈现，不影响 Controller/Worker 后续运行；你可以稍后手动部署或切换为 `external`。
3. `local` 模式部署完成后，仍需要在 Web Console 中完成 OpenClaw 的 onboarding（例如创建账号、配置 webhook、生成 token 并回填 manifest）。
4. `local` 模式当前使用固定默认端口 `18000`（健康检查地址：`http://localhost:18000/healthz`），不支持在 manifest 中自定义。

#### services.openCode.installMode

- 类型：`'local' | 'external' | 'skip'`
- 默认值：`'skip'`

三种模式说明：

- `local`：clawkit 通过官方脚本（`curl -fsSL https://opencode.ai/install | bash`）自动安装 OpenCode，并以后台方式启动 `opencode serve --port 4096`；要求 `curl` + `bash` 可用、端口 `4096` 空闲。
- `external`：使用已运行的 OpenCode 服务（需自行配置 `services.openCode.publicUrl`）。
- `skip`：clawkit 不负责 OpenCode 的安装与启动（你可以稍后手动处理）。

配置示例：

```yaml
services:
  openCode:
    node: "local-dev"
    installMode: "local" # local | external | skip
    publicUrl: "http://127.0.0.1:8787" # controller 对外可访问地址（用于外部系统回调/展示等场景）
```

注意事项：

1. `installMode='local'` 要求 `services.openCode.node` 必须指向 **local 类型节点**；否则 schema 校验会失败。
2. OpenCode 安装失败不阻断 Controller/Worker 后续运行：对应执行任务会退化为 placeholder（用于链路验证）。
3. 当前版本 `local` 模式使用固定默认端口 `4096`（健康检查地址：`http://localhost:4096`），不支持在 manifest 中自定义。
4. 相关路径（`local` 模式）：
   - 二进制：`~/.opencode/bin/opencode`
   - 启动脚本：`~/.opencode/start-opencode.sh`
   - 日志：`~/.opencode/opencode.log`
   - PID：`~/.opencode/opencode.pid`

### 3.4 workers

每个 worker 至少包含：

- `id`
- `node`
- `connectMode`
- `projects`

每个项目至少包含：

- `key`
- `repoPath`
- `baseBranch`
- `openCode.port`
- `openCode.agent`

### 3.5 runtime

当前首版推荐：

```yaml
runtime:
  promptEngine:
    mode: "template"
  memory:
    enabled: true
    provider: "local"
    path: "./data/memory"
```

说明：

- `promptEngine.mode` 当前可取 `template | llm | hybrid`
- 首个 MVP 推荐使用 `template`
- examples 与 `init` 默认也使用 `template`

如需通过 Setup 向导配置模型供应商和默认模型，可切换到 `llm` 或 `hybrid`：

```yaml
runtime:
  promptEngine:
    mode: "llm"
    provider: "openai"
    apiKeyEnv: "OPENAI_API_KEY"
    model: "gpt-4o-mini"
    temperature: 0.7
    maxTokens: 4096
    timeoutMs: 30000
```

`apiKeyEnv` 保存的是环境变量名，不是 API Key 明文。页面上的 API Key 输入仅用于临时获取模型列表，生成 manifest 时不会写入密钥。

### 3.6 notify

`notify` 为可选项；启用后至少需要一个渠道。

### 3.7 deploy

`deploy` 用于表达部署超时、重试和健康检查间隔等策略。

## 4. 拓扑约束

### all-in-one

- controller、OpenClaw、全部 worker 必须在同一个节点

### hybrid

- controller 与 OpenClaw 必须在同一个 SSH 节点
- worker 必须位于本地节点

### split

- controller 与 OpenClaw 必须在同一个控制面节点
- 至少一个 worker 位于独立执行节点

## 5. 当前实现关系

manifest 当前会被这些能力直接消费：

- `init` 生成
- `doctor` 校验
- `plan` 预览
- `apply` 生成部署文件
- `heal` 识别修复问题
- controller / worker 运行时加载

## 6. 当前边界

manifest 负责描述“声明式配置”，但不直接等于最终系统文件。

例如：

- `controller.env`、`worker.env` 由 `apply` 生成
- systemd 文件由 `apply` 生成
- OpenClaw 配置由 `apply` 生成

## 7. 结论

当前 manifest 已经不是单纯的“模型设计产物”，而是首个 MVP 的真实运行输入。
