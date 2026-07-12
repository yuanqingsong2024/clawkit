# clawkit 一键部署功能说明

本文档说明 clawkit 的一键部署能力、新增功能和使用方法。

## 更新日期

2026-05-13

## 概述

clawkit 现已支持真正的一键部署，可以自动完成从配置生成到服务启动的完整流程，包括：

- ✅ 自动部署 OpenClaw（Docker Compose）
- ✅ 自动安装并启动 OpenCode
- ✅ 自动启动 Controller 和 Worker
- ✅ 提供 Onboarding 辅助工具
- ✅ 提供端到端验证工具

## 新增功能

### 1. `apply --deploy` 真实部署

**功能**：在生成配置文件后，自动执行 OpenClaw 和 OpenCode 的部署与启动。

**使用方法**：

```bash
# 生成配置并执行真实部署
node ./packages/cli/dist/index.js apply -f ./examples/simple.yaml --deploy
```

**执行流程**：

1. 生成所有配置文件（env、systemd、启动脚本、docker-compose.yml）
2. 如果 `deployMode=local`，自动执行 `docker compose up -d` 启动 OpenClaw
3. 等待 OpenClaw 健康检查通过（最多 60 秒）
4. 如果 `installMode=local`，自动安装 OpenCode（如果未安装）
5. 启动 OpenCode 服务并等待健康检查通过（最多 60 秒）

**非阻塞失败**：

- OpenClaw 或 OpenCode 部署失败不会中断整个流程
- 失败时会输出警告信息，但 Controller/Worker 仍可继续运行
- 可以稍后手动修复并重试

### 2. `clawkit onboard` Onboarding 辅助

**功能**：交互式引导用户完成 OpenClaw 的配置流程。

**使用方法**：

```bash
node ./packages/cli/dist/index.js onboard -f ./clawkit.yaml
```

**辅助步骤**：

1. **检查 OpenClaw 运行状态**：验证 OpenClaw 是否已启动
2. **创建账号**：提示用户在 OpenClaw UI 创建账号
3. **配置 Webhook**：显示需要配置的 webhook URL
4. **配置 Token**：生成或使用现有 token，提示用户在 OpenClaw 中配置
5. **更新 Manifest**：可选自动更新 manifest 中的 apiKey
6. **重启 Controller**：提示用户重启 controller 使配置生效

**适用场景**：

- 首次部署后需要配置 OpenClaw webhook
- Token 过期需要重新生成
- 忘记配置步骤需要引导

### 3. `clawkit verify` 端到端验证

**功能**：验证所有组件的运行状态，生成详细的验证报告。

**使用方法**：

```bash
node ./packages/cli/dist/index.js verify -f ./clawkit.yaml
```

**验证项目**：

1. **Controller**：检查 HTTP API 是否可访问
2. **Worker**：检查是否有活跃的 Worker 注册
3. **OpenClaw**：检查健康接口是否正常
4. **OpenCode**：检查服务是否可访问
5. **Webhook 配置**：检查 token 是否已配置且符合安全要求

**输出示例**：

```
========================================
验证报告
========================================

✓ Controller: 运行正常 (端口 8787)

✓ Worker: 1 个 Worker 在线
    - local-worker (local-dev)

✓ OpenClaw: 运行正常 (local 模式)

✓ OpenCode: 运行正常 (local 模式)

✓ Webhook 配置: Token 已配置
    长度: 64 字符

========================================
总计: 5 项检查
  通过: 5
========================================

所有检查通过！
```

### 4. 更新的 `quick-start-simple.sh`

**变更**：现在默认调用 `apply --deploy`，实现真正的一键部署。

**使用方法**：

```bash
# 一键部署（包含 OpenClaw 和 OpenCode，简化配置优先）
./scripts/quick-start-simple.sh

# 或使用 pnpm 命令
pnpm quickstart
```

**执行流程**：

1. 环境检查（Node.js、pnpm、manifest 文件）
2. 安装依赖
3. 构建项目
4. 执行 doctor 检查
5. **执行 apply --deploy（自动部署 OpenClaw 和 OpenCode）**
6. 启动 Controller 和 Worker
7. 输出部署摘要

## 完整的一键部署流程

### 场景：从零开始部署简化模式

```bash
# 1. 克隆项目并安装依赖
git clone <repo-url>
cd clawkit
pnpm install

# 2. 构建项目
pnpm build

# 3. 一键部署（自动完成所有步骤）
pnpm quickstart

# 4. 完成 OpenClaw onboarding
node ./packages/cli/dist/index.js onboard -f ./examples/simple.yaml

# 5. 验证所有组件
node ./packages/cli/dist/index.js verify -f ./examples/simple.yaml
```

### 预期结果

执行完上述步骤后，你将拥有：

- ✅ OpenClaw 运行在 `services.openClaw.publicUrl` 指定的本地端口（默认示例为 `http://127.0.0.1:18000`）
- ✅ Controller 运行在 `http://127.0.0.1:8787`
- ✅ Worker 已注册并在线
- ✅ OpenCode 运行在项目 `workers[*].projects[*].openCode.port` 指定的端口（默认示例为 `http://127.0.0.1:4096`）
- ✅ Webhook 已配置并可接收任务

## 当前能力边界

### ✅ 已实现的能力

| 功能 | 状态 | 说明 |
|------|------|------|
| 配置生成 | ✅ | init/setup/doctor/plan/apply |
| Controller 启动 | ✅ | 自动启动并提供 HTTP API |
| Worker 启动 | ✅ | 自动注册、拉取任务、执行任务 |
| OpenClaw 部署 | ✅ | local 模式自动 docker compose up |
| OpenCode 安装 | ✅ | local 模式自动安装并启动 |
| Onboarding 辅助 | ✅ | 交互式引导配置 webhook 和 token |
| 端到端验证 | ✅ | 验证所有组件运行状态 |
| 任务主链路 | ✅ | webhook → 草稿 → 审批 → 派发 → 执行 → 回传 |

### ⚠️ 仍需手动操作的部分

1. **OpenClaw Onboarding**（6 步）
   - 在 OpenClaw UI 创建账号
   - 配置 webhook URL
   - 配置 webhook token
   - 更新 manifest（可通过 `onboard` 命令辅助）
   - 重启 controller

2. **首次运行前的准备**
   - 安装 Docker（如果使用 local 模式部署 OpenClaw）
   - 安装 Node.js >= 20.0.0
   - 安装 pnpm >= 8.0.0

### ❌ 明确不做的功能

以下功能属于当前版本**明确不做**的范围：

1. **OpenClaw 自动 Onboarding**
   - 无法通过 API 自动创建账号
   - 无法通过 API 自动配置 webhook
   - 需要用户在 UI 手动操作

2. **复杂部署场景**
   - 不支持多实例部署
   - 支持通过 manifest 推导单实例端口：OpenClaw local 模式从 `services.openClaw.publicUrl` 读取端口；OpenCode local 模式从第一个项目的 `openCode.port` 读取端口
   - 不支持多端口/多实例编排，也不支持一份 manifest 同时拉起多套 OpenClaw/OpenCode
   - 不支持远程节点自动安装 OpenCode

3. **生产级功能**
   - 不支持自动 PR
   - 不支持自动部署业务代码
   - 不支持复杂权限系统
   - 不支持配置热更新，修改 manifest 后仍需重启 controller/worker

## 故障排查

### OpenClaw 部署失败

**现象**：`apply --deploy` 执行时 OpenClaw 部署失败

**可能原因**：
- Docker 未安装或无权限
- 端口 18000 被占用
- 镜像拉取失败

**解决方法**：

```bash
# 检查 Docker
docker --version
docker compose version

# 检查端口
lsof -i :18000

# 手动部署
cd ~/.openclaw
docker compose up -d
docker logs -f openclaw-gateway
```

### OpenCode 安装失败

**现象**：`apply --deploy` 执行时 OpenCode 安装失败

**可能原因**：
- 网络无法访问 https://opencode.ai/install
- 端口 4096 被占用
- 安装脚本执行失败

**解决方法**：

```bash
# 手动安装
curl -fsSL https://opencode.ai/install | bash

# 检查安装
~/.opencode/bin/opencode --version

# 手动启动
bash ~/.opencode/start-opencode.sh

# 查看日志
tail -f ~/.opencode/opencode.log
```

### Worker 无法连接 OpenCode

**现象**：任务执行失败，日志显示无法连接 OpenCode

**可能原因**：
- OpenCode 未启动
- 端口配置不匹配
- 健康检查超时
- `OPENCODE_SERVER_PASSWORD` 未设置，导致脚本无法真正拉起服务

**解决方法**：

```bash
# 验证 OpenCode 状态
curl http://127.0.0.1:4096

# 检查进程
ps aux | grep opencode

# 重启 OpenCode
kill $(cat ~/.opencode/opencode.pid)
bash ~/.opencode/start-opencode.sh
```

### Webhook 调用失败

**现象**：OpenClaw 发送任务后 Controller 无响应

**可能原因**：
- Token 未配置或不匹配
- Webhook URL 配置错误
- Controller 未启动

**解决方法**：

```bash
# 运行 onboard 辅助
node ./packages/cli/dist/index.js onboard -f ./clawkit.yaml

# 运行 verify 验证
node ./packages/cli/dist/index.js verify -f ./clawkit.yaml

# 检查 Controller 日志
tail -f .clawkit/logs/controller.log
```

## 命令速查表

| 命令 | 功能 | 示例 |
|------|------|------|
| `setup` | 交互式生成配置 | `clawkit setup` |
| `doctor` | 诊断配置问题 | `clawkit doctor -f ./clawkit.yaml` |
| `apply` | 生成配置文件 | `clawkit apply -f ./clawkit.yaml` |
| `apply --deploy` | 生成配置并部署 | `clawkit apply -f ./clawkit.yaml --deploy` |
| `onboard` | Onboarding 辅助 | `clawkit onboard -f ./clawkit.yaml` |
| `verify` | 端到端验证 | `clawkit verify -f ./clawkit.yaml` |
| `heal` | 生成修复计划 | `clawkit heal -f ./clawkit.yaml` |

## 推荐工作流

### 首次部署

```bash
# 1. 生成配置
pnpm build
node ./packages/cli/dist/index.js setup

# 2. 一键部署
pnpm quickstart

# 3. 完成 onboarding
node ./packages/cli/dist/index.js onboard -f ./clawkit.yaml

# 4. 验证部署
node ./packages/cli/dist/index.js verify -f ./clawkit.yaml
```

### 日常开发

```bash
# 快速启动（已部署过）
pnpm quickstart:dev

# 验证状态
node ./packages/cli/dist/index.js verify -f ./clawkit.yaml
```

### 故障排查

```bash
# 1. 诊断配置
node ./packages/cli/dist/index.js doctor -f ./clawkit.yaml

# 2. 验证组件
node ./packages/cli/dist/index.js verify -f ./clawkit.yaml

# 3. 生成修复计划
node ./packages/cli/dist/index.js heal -f ./clawkit.yaml --dry-run

# 4. 执行修复
node ./packages/cli/dist/index.js heal -f ./clawkit.yaml
```

## 相关文档

- [快速开始](./quick-start.md)
- [OpenClaw 集成指南](./openclaw-integration.md)
- [OpenCode 集成指南](./opencode-integration.md)
- [项目范围说明](./project-scope.md)
- [已知限制](./known-limitations.md)
