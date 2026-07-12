# OpenClaw 集成指南（部署 + Onboarding + Webhook）

本文档面向“要把 OpenClaw 跑起来并接入 clawkit controller”的用户，覆盖三种部署模式、Web Console 引导流程、以及常见故障排查。

> 说明：clawkit 的 OpenClaw 集成分为两层：
> 1) **部署/可用性**：OpenClaw 是否可用（本地 docker 或外部实例）；
> 2) **接入/鉴权**：OpenClaw 通过 webhook 调用 controller，并使用 token 鉴权。

## 1. 部署模式（deployMode）

`services.openClaw.deployMode` 支持三种模式：`local | external | skip`。

### 1.1 local（本地 Docker 自动部署）

适用场景：本机联调、最小落地、希望“一键拉起” OpenClaw。

配置示例：

```yaml
services:
  openClaw:
    node: "local-dev"
    deployMode: "local"
    publicUrl: "http://127.0.0.1:8787" # controller 对外可访问地址
    apiKey: "replace-me" # webhook token（会写入 controller 的 OPENCLAW_WEBHOOK_TOKEN）
```

行为说明：

- `doctor` 会在 `deployMode=local` 时额外检查：Docker 可用性、Docker Compose V2、端口 `18000` 是否冲突。
- `apply` 会生成 OpenClaw 的本地 docker compose 文件：`~/.openclaw/docker-compose.yml`。
- Web Console 的 Setup 编排会在 `deployMode=local` 时执行“部署 OpenClaw”步骤；**部署失败非阻塞**，不会影响后续 Controller/Worker/OpenCode 的检查与运行。

约束与注意事项：

1. `deployMode: local` 要求 `services.openClaw.node` 指向 **local 类型节点**（避免“本地部署但指向远程节点”的歧义配置）。
2. `local` 仅负责把 OpenClaw 容器跑起来；**仍需要 onboarding**（见下文）完成账号、webhook、token 等配置。

### 1.2 external（外部实例集成）

适用场景：OpenClaw 已由你在其他机器/集群部署，clawkit 只负责接入与鉴权。

配置示例：

```yaml
services:
  openClaw:
    node: "local-dev"
    deployMode: "external"
    publicUrl: "https://your-controller.example.com" # controller 对外可访问地址
    apiKey: "replace-me"
```

行为说明：

- Web Console Setup 会跳过 OpenClaw 部署步骤，并提示当前为 external。
- `doctor` 不会做 Docker/端口相关检查。

### 1.3 skip（跳过 OpenClaw）

适用场景：只验证 controller/worker/OpenCode 链路，暂不接 OpenClaw。

配置示例：

```yaml
services:
  openClaw:
    node: "local-dev"
    deployMode: "skip"
    publicUrl: "http://127.0.0.1:8787"
    apiKey: "" # 允许为空，但后续 webhook 鉴权相关调用会失败
```

行为说明：

- Web Console Setup 会跳过 OpenClaw 部署。
- controller 仍可运行；但如果未配置 token，OpenClaw webhook 调用会被鉴权拦截。

## 2. Onboarding 流程（6 步）

> 目标：让 OpenClaw 能够携带 token 调用 controller 的 webhook，并在 clawkit 配置中生效。

1. **访问 Web Console**：打开 clawkit 的 Web Console，进入 Setup 向导或部署页面。
2. **在 OpenClaw UI 创建账号**：如果是 `local` 模式，请先确认 OpenClaw 容器已启动，然后访问 OpenClaw UI 完成初始账号创建。
3. **配置 Webhook 地址**：在 OpenClaw 中将 webhook 指向 controller：

   - 推荐入口：`POST /api/openclaw/webhook`
   - 兼容旧入口：`POST /api/tasks/from-openclaw`

   其中 controller 的对外地址来自 manifest 的 `services.openClaw.publicUrl`。

4. **生成并记录 Token**：在 OpenClaw 中生成 webhook token（或你自定义生成一个随机 token）。
5. **更新 manifest 配置**：把 token 写入 `services.openClaw.apiKey`，并确认 `publicUrl` 可被 OpenClaw 访问。

   ```yaml
   services:
     openClaw:
       deployMode: "local"
       publicUrl: "http://127.0.0.1:8787"
       apiKey: "your-random-token"
   ```

6. **重启 Controller**：manifest 保存后需要让新配置生效：重启 controller（以及按需重启 worker/OpenCode）。

   ```bash
   # 以 systemd 为例（实际服务名以 apply 生成结果为准）
   systemctl restart clawkit-controller
   ```

## 3. 故障排查（常见问题）

### 3.1 Docker 检查失败（deployMode=local）

现象：`doctor` 提示 Docker 不可用或 Docker Compose V2 不可用。

处理建议：

- 确认 `docker --version` 可运行；Linux 下确认当前用户有权限访问 docker。
- Compose 必须是 V2（命令为 `docker compose`，不是 `docker-compose`）。

### 3.2 端口冲突（18000）

现象：`doctor` 报告 OpenClaw 端口 `18000` 已被占用。

处理建议：

- 释放占用端口的进程后重试。
- 当前版本 `local` 模式不支持自定义端口；如果无法释放端口，建议切换到 `external`。

### 3.3 镜像拉取失败

现象：OpenClaw 容器启动失败，日志提示 pull 失败或网络错误。

处理建议：

- 检查是否能访问 `ghcr.io`。
- 如需指定镜像，可通过环境变量覆盖（以 compose 文件为准）：

  ```bash
  export OPENCLAW_IMAGE=ghcr.io/openclaw/openclaw:latest
  ```

### 3.4 健康检查超时

现象：容器已启动但健康检查长时间不通过。

处理建议：

- 查看容器日志：

  ```bash
  docker logs -f openclaw-gateway
  ```

- 手动检查健康接口：

  ```bash
   curl -v http://127.0.0.1:18000/healthz
  ```

### 3.5 手动部署方法（local 模式兜底）

现象：Web Console 的“部署 OpenClaw”步骤失败，但希望继续使用本地模式。

处理建议：使用 `apply` 生成的 compose 文件手动拉起：

```bash
# 生成部署文件（会写入 ~/.openclaw/docker-compose.yml）
node ./packages/cli/dist/index.js apply -f ./examples/all-in-one.yaml

cd ~/.openclaw
docker compose up -d
docker compose ps
```

## 4. 高级配置

### 4.1 数据持久化（local 模式）

clawkit 生成的 compose 默认挂载：

- `~/.openclaw:/home/node/.openclaw`
- `~/.openclaw/workspace:/home/node/.openclaw/workspace`

这意味着 OpenClaw 的本地数据会保存在 `~/.openclaw` 下，适合开发联调与单机最小落地。

### 4.2 日志查看

```bash
docker logs -f openclaw-gateway
```

### 4.3 容器管理命令

```bash
# 启动/停止
cd ~/.openclaw
docker compose up -d
docker compose down

# 查看状态
docker compose ps

# 重启
docker compose restart
```

## 5. 参考资源

- [`docs/manifest.md`](./manifest.md)：manifest 字段说明（含 `services.openClaw.deployMode`）
- [`docs/quick-start.md`](./quick-start.md)：快速上手与最小部署路径
- [`docs/web-console.md`](./web-console.md)：Web Console 与 Setup 向导
- [`docs/openclaw-webhook.md`](./openclaw-webhook.md)：OpenClaw webhook 协议与交互细节
- OpenClaw 项目主页（外部）：https://github.com/openclaw/openclaw
