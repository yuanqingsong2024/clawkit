# 脚本目录说明

此目录用于存放项目构建、清理、部署与联调脚本。

## 脚本列表

### 一键部署脚本（推荐）

- `quick-start-simple.sh`：**简化版一键部署**（推荐，优先使用简化配置）
- `quick-start.sh`：完整版一键部署（兼容旧流程与高级场景）
- `quick-start-dev.sh`：本地开发环境快速启动（适合频繁调试）
- `smoke-test.sh`：部署后快速验证关键服务是否可用

### 其他脚本

- `clean.sh`：清理构建产物与依赖目录
- `e2e-local-demo.js`：单机模式最小端到端联调脚本
- `start-local.sh`：手动启动单机链路（controller/worker），支持占位执行与真实执行

## 快速开始

### 一键部署（推荐）

```bash
# 使用简化配置一键部署（推荐）
./scripts/quick-start-simple.sh

# 或使用 pnpm 命令
pnpm quickstart

# 使用完整配置一键部署
./scripts/quick-start.sh

# 或使用 pnpm 命令
pnpm quickstart:full
```

详细使用方法请参考 [简化版快速开始指南](../docs/simplified-quick-start.md) 或 [完整版一键部署脚本使用指南](../docs/quick-start.md)。

### 开发环境快速启动

```bash
# 快速启动开发环境
./scripts/quick-start-dev.sh

# 或使用 pnpm 命令
pnpm quickstart:dev
```

### 烟雾测试

```bash
# 验证部署是否成功
./scripts/smoke-test.sh

# 或使用 pnpm 命令
pnpm smoke
```

## 详细使用方法

### quick-start-simple.sh（简化版一键部署，推荐）

**用途**：使用简化配置快速部署单机模式，适合新用户和快速上手。

**基础用法**：

```bash
# 使用默认配置（自动查找）
./scripts/quick-start-simple.sh

# 使用自定义配置
./scripts/quick-start-simple.sh -f ./my-config.yaml

# 跳过构建
./scripts/quick-start-simple.sh --skip-build

# 仅部署不启动
./scripts/quick-start-simple.sh --no-start

# 部署后自动测试
./scripts/quick-start-simple.sh --smoke-test
```

**配置文件自动查找顺序**：

1. `clawkit.yaml`（项目根目录）
2. `examples/simple.yaml`（简化配置示例）
3. `examples/minimal.yaml`（最小配置示例）
4. `examples/all-in-one.yaml`（完整配置示例）

**支持的参数**：

- `-f, --file <path>`：manifest 文件路径（默认：自动查找）
- `--skip-build`：跳过构建步骤
- `--no-start`：只部署不启动服务
- `--smoke-test`：部署后自动执行烟雾测试
- `-h, --help`：显示帮助信息

### quick-start.sh（完整版一键部署，兼容旧流程）

**用途**：使用完整配置部署，适合高级用户、复杂场景或需要兼容旧流程时使用。

**基础用法**：

```bash
# 使用默认完整配置
./scripts/quick-start.sh

# 使用自定义配置
./scripts/quick-start.sh -f ./my-config.yaml

# 跳过构建
./scripts/quick-start.sh --skip-build

# 仅部署不启动
./scripts/quick-start.sh --no-start

# 部署后自动测试
./scripts/quick-start.sh --smoke-test
```

**支持的参数**：

- `-f, --file <path>`：manifest 文件路径（默认：`examples/all-in-one.yaml`，仅旧版完整配置流）
- `--skip-build`：跳过构建步骤
- `--no-start`：只部署不启动服务
- `--smoke-test`：部署后自动执行烟雾测试
- `-h, --help`：显示帮助信息

**manifest 路径同步说明**：

- 脚本在启动前会把当前使用的 manifest 路径同步写入 `data/controller-config.json`
- 这样可以保证脚本本次指定的 manifest 与 controller 实际读取的路径一致
- 如果此前在页面里保存过其他 manifest 路径，本次脚本启动会以脚本指定路径为准

### quick-start-dev.sh（开发环境）

**用途**：本地开发环境快速启动，适合频繁调试。

**基础用法**：

```bash
./scripts/quick-start-dev.sh
```

**特点**：

- 服务在前台运行，按 `Ctrl+C` 停止
- 适合开发调试，不适合生产部署
- 启动速度快，无需额外配置
- 启动前会同步 `data/controller-config.json`，确保 controller 使用当前脚本指定的 manifest 路径

### smoke-test.sh（烟雾测试）

**用途**：部署后快速验证关键服务是否可用。

**基础用法**：

```bash
# 使用默认地址
./scripts/smoke-test.sh

# 自定义 Controller 地址
./scripts/smoke-test.sh --controller-url http://192.168.1.100:8787
```

**检查项**：

- Controller 健康状态
- Worker 注册状态
- Web Console 可访问性

### 清理项目

```bash
./scripts/clean.sh
```

### 运行单机端到端联调

```bash
node ./scripts/e2e-local-demo.js
```

> 说明：该联调脚本当前默认允许 placeholder fallback，适合验证链路是否打通；若要验证严格真实 OpenCode 执行，请参考 `docs/e2e.md` 中的手工联调步骤。

### 手动启动单机链路

终端 A（启动 controller）：

```bash
export OPENCLAW_WEBHOOK_TOKEN="replace-me"
./scripts/start-local.sh controller
```

终端 B（启动 worker，占位执行）：

```bash
./scripts/start-local.sh worker-placeholder
```

终端 B（启动 worker，真实 OpenCode 执行）：

```bash
export OPENCODE_SERVER_PASSWORD="your-password"
./scripts/start-local.sh worker-opencode
```

> 说明：真实执行模式需要先手动启动 `opencode serve`，并确保 `OPENCODE_SERVER_PASSWORD_ENV` 对应的环境变量已设置。

> 说明补充：如果使用桌面端的“启动 OpenCode”按钮，也需要先设置 `OPENCODE_SERVER_PASSWORD`，否则会直接返回失败提示，不会真正拉起服务。

> 统一说明：无论是脚本启动还是桌面端一键启动，真实执行模式都依赖 `OPENCODE_SERVER_PASSWORD`，否则只会得到失败提示。

> 补充说明：`start-local.sh` 也会在启动前同步 `data/controller-config.json`，避免页面保存的旧路径覆盖这次命令指定的 manifest。

## 常见问题

### 环境检查失败

**问题**：未找到 Node.js 或 pnpm

**解决方法**：

```bash
# 安装 Node.js（推荐使用 nvm）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# 安装 pnpm
npm install -g pnpm
```

### 服务启动失败

**排查步骤**：

```bash
# 1. 查看日志
tail -f .clawkit/logs/controller.log
tail -f .clawkit/logs/worker.log

# 2. 检查端口占用
lsof -i :8787

# 3. 检查进程状态
ps aux | grep clawkit
```

### 停止服务

```bash
# 方法 1：使用 PID 文件
kill $(cat .clawkit/controller.pid) $(cat .clawkit/worker.pid)

# 方法 2：强制停止
pkill -f clawkit
```

## 更多文档

- [一键部署脚本使用指南](../docs/quick-start.md) - 详细使用方法和常见问题
- [CLI 使用文档](../docs/cli.md) - 命令详细说明
- [端到端联调说明](../docs/e2e.md) - 链路联调与真实 OpenCode 执行
- [最小使用手册](../docs/minimal-user-guide.md) - 环境准备和启动步骤
