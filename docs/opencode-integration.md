# OpenCode 集成指南（一键安装 + 外部实例 + 手动控制）

本文档面向“要让 worker 具备真实 OpenCode 执行能力”的用户，覆盖三种安装模式（local/external/skip）、一键安装流程、手动启停方法与常见故障排查。

> 说明：clawkit 的 OpenCode 集成分为两层：
> 1) **安装/可用性**：OpenCode 服务是否可用（本地一键安装或外部实例）；
> 2) **执行/退化**：worker 执行任务时会优先走 OpenCode；若 OpenCode 不可用且允许回退，则退化为 placeholder（用于链路验证）。

## 1. 简介

OpenCode 是一个用于执行工程任务的本地/服务端工具。clawkit 通过 worker 的 OpenCodeExecutor 调用 OpenCode 服务来执行任务。

为了降低首次落地门槛，Web Console 的 Setup 向导支持在 `installMode=local` 时触发 **OpenCode 一键安装**：自动安装、后台启动、健康检查；失败不会阻断 controller/worker 的运行。

## 2. 三种安装模式（installMode）

`services.openCode.installMode` 支持三种模式：`local | external | skip`。

### 2.1 local（本地一键安装 + 后台启动）

适用场景：本机联调、单机/混合拓扑的最小落地，希望“一键安装并拉起 OpenCode”。

前置要求：

- 本机可用 `curl` 与 `bash`
- 端口 `4096` 空闲（当前版本固定使用）
- `services.openCode.node` 必须指向 `type: local` 的节点

配置示例：

```yaml
services:
  openCode:
    node: "local-dev"
    installMode: "local"
    publicUrl: "http://127.0.0.1:8787"
```

行为说明：

- controller 会在需要时执行官方安装脚本：`curl -fsSL https://opencode.ai/install | bash`
- `apply` 会生成启动脚本：`~/.opencode/start-opencode.sh`
- controller 会以后台方式启动：`opencode serve --port 4096`
- controller 会轮询健康检查：`http://localhost:4096`，每 2 秒一次，最多 30 次（总计约 60 秒）

相关路径（固定）：

- 二进制：`~/.opencode/bin/opencode`
- 启动脚本：`~/.opencode/start-opencode.sh`
- 日志：`~/.opencode/opencode.log`
- PID：`~/.opencode/opencode.pid`

### 2.2 external（外部实例集成）

适用场景：OpenCode 已由你在其他机器/集群部署，clawkit 不负责安装与启动，只对接已运行的服务。

配置示例：

```yaml
services:
  openCode:
    node: "local-dev"
    installMode: "external"
    publicUrl: "https://your-controller.example.com"
```

说明：

- `external` 模式要求你自行保证 OpenCode 服务已运行、网络可达。
- Web Console Setup 会跳过“安装 OpenCode”步骤，并提示当前为 external。

### 2.3 skip（跳过 OpenCode）

适用场景：先验证 controller/worker/OpenClaw 链路，OpenCode 后续再安装。

配置示例：

```yaml
services:
  openCode:
    node: "local-dev"
    installMode: "skip"
    publicUrl: "http://127.0.0.1:8787"
```

说明：

- clawkit 不负责 OpenCode 安装与启动。
- 若 worker 运行时未能连接 OpenCode，任务将按配置退化为 placeholder（用于链路验证）。

## 3. 一键安装流程（local 模式）

一键安装在内部按 4 个阶段执行：

1. **检测（已安装/已运行）**
   - 检查二进制是否存在；若已满足条件则跳过安装
2. **安装（执行官方脚本）**
   - 运行：`curl -fsSL https://opencode.ai/install | bash`
3. **启动（后台启动 serve）**
   - 启动：`opencode serve --port 4096`
   - 写入 PID 文件，日志追加到 `~/.opencode/opencode.log`
4. **健康检查（轮询 60s）**
   - 轮询 `http://localhost:4096`：每 2 秒一次，最多 30 次

失败行为：

- 任一阶段失败都会以“步骤失败 + 非阻塞告警”的方式呈现，不影响 controller/worker 继续运行。
- 失败后对应任务执行会退化为 placeholder（用于链路验证），你可以稍后修复环境并重试。

## 4. 手动控制（启动 / 重启 / 停止 / 前台调试）

### 4.1 启动 / 重启

```bash
# 推荐：使用 apply 生成的启动脚本
bash ~/.opencode/start-opencode.sh
```

### 4.2 停止

```bash
# 通过 PID 文件停止
kill "$(cat ~/.opencode/opencode.pid)"
```

### 4.3 查看日志

```bash
tail -f ~/.opencode/opencode.log
```

### 4.4 前台调试（不建议用于长期运行）

```bash
~/.opencode/bin/opencode serve --port 4096 --foreground
```

## 5. 故障排查（常见问题）

### 5.1 curl / bash 不可用

现象：`doctor` 在 `installMode=local` 时提示缺少 `curl` 或 `bash`。

处理建议：安装对应依赖后重试；或切换为 `external` / `skip`。

### 5.2 端口 4096 被占用

现象：启动失败或健康检查一直不通过；`doctor` 报告端口冲突。

处理建议：释放占用端口的进程后重试；当前版本不支持自定义端口，如无法释放建议切换为 `external`。

### 5.3 官方安装脚本网络失败

现象：安装阶段报错（DNS/超时/被拦截）。

处理建议：确认能访问 `https://opencode.ai/`；必要时配置代理或在网络可达环境先手动安装，再使用 `local` 进入“已安装跳过”路径。

### 5.4 二进制不可执行

现象：`~/.opencode/bin/opencode` 存在但启动时报“权限不足”或“格式错误”。

处理建议：

- 确认文件权限：`chmod +x ~/.opencode/bin/opencode`
- 确认系统架构匹配（例如 x86_64/arm64）
- 删除后重新执行安装（或切换 external）

### 5.5 健康检查超时（60s）

现象：安装/启动看似成功，但健康检查在 60 秒内未通过。

处理建议：

- 查看日志：`tail -n 200 ~/.opencode/opencode.log`
- 手动访问：`curl -v http://127.0.0.1:4096`
- 确认本机防火墙/安全软件未阻止本地回环访问

## 6. 高级配置（当前版本边界内的可调整项）

### 6.1 更换二进制路径 / 日志位置（建议做法）

当前版本的默认路径是固定约定（见上文）。如果你希望使用其他位置的 OpenCode：

- 推荐做法：选择 `installMode=skip` 或 `external`，并由你自己负责安装路径、启动方式与日志管理。
- `installMode=local` 下不提供“二进制路径/日志路径参数化”的 manifest 字段；如需自定义，请通过你自己的启动脚本与运维方式实现。

### 6.2 推荐架构：共享单一 OpenCode 服务

**重要**：推荐使用全局 `openCodeBaseUrl` 配置，让所有项目共享一个 OpenCode 服务实例。

**为什么共享？**
- OpenCode 是重量级服务，每个实例会消耗大量资源
- OpenCode 本身通过 `directory` 参数和 session 机制天然支持多项目隔离
- 简化运维：只需启动和监控一个服务

**配置方式**：

```yaml
# 推荐：全局配置，所有项目共享
services:
  openCode:
    node: "local-dev"
    installMode: "local"
    publicUrl: "http://127.0.0.1:4096"

workers:
  - id: "local-worker"
    projects:
      - key: "project-a"
        repoPath: "/path/to/project-a"
        openCode:
          agent: "build"
          # 不配置 port，使用全局 OpenCode 服务
      
      - key: "project-b"
        repoPath: "/path/to/project-b"
        openCode:
          agent: "build"
          # 不配置 port，使用全局 OpenCode 服务
```

**何时需要项目独立端口？**

只有在以下特殊场景下才需要为项目配置独立的 `port`：
- 不同项目需要不同版本的 OpenCode
- 不同项目有严格的资源隔离要求（如隔离环境变量）

```yaml
# 不推荐：项目独立端口（仅特殊场景）
workers:
  - id: "local-worker"
    projects:
      - key: "legacy-project"
        repoPath: "/path/to/legacy"
        openCode:
          port: 4096  # 使用旧版 OpenCode
          agent: "build"
      
      - key: "new-project"
        repoPath: "/path/to/new"
        openCode:
          port: 4097  # 使用新版 OpenCode
          agent: "build"
```

### 6.3 与 worker 的连接逻辑

worker 会使用项目配置中的 `projects[*].openCode.port` 连接 OpenCode 服务端口。

- `installMode=local` 固定启动在 `4096`：建议把相关项目的 `openCode.port` 也配置为 `4096`。
- 如果你配置了其他端口，worker 会按配置去连接，可能与一键安装启动的端口不一致，从而导致连接失败并触发退化。

### 6.3 与 worker 的连接逻辑

worker 连接 OpenCode 服务的优先级：
1. **优先**：使用全局配置 `OPENCODE_SERVER_BASE_URL` 环境变量
2. **其次**：使用全局 `services.openCode.publicUrl` 配置
3. **最后**：如果项目配置了 `openCode.port`，则使用 `http://127.0.0.1:<port>`

推荐做法：
- 在环境变量或 manifest 全局配置中设置 OpenCode 服务地址
- 不在项目级别配置 `port` 字段
- 这样所有项目自动共享同一个 OpenCode 服务

## 7. 参考资源

- OpenCode 官网：https://opencode.ai/
- 官方安装脚本 URL：`https://opencode.ai/install`
- 相关 manifest 字段说明：[`docs/manifest.md`](./manifest.md)
