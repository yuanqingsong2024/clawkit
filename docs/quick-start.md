# clawkit 一键部署脚本使用指南

本文档介绍 clawkit 一键部署脚本的使用方法、适用场景和常见问题。

## 脚本概览

clawkit 提供三个一键脚本，降低内部试运行和首次使用成本：

| 脚本 | 用途 | 适用场景 |
|---|---|---|
| `quick-start.sh` | 单机模式一键部署与启动 | 内部试运行、首次部署 |
| `quick-start-dev.sh` | 本地开发环境快速启动 | 频繁调试、开发测试 |
| `smoke-test.sh` | 部署后快速验证 | 健康检查、验证部署 |

## 核心设计原则

1. **不重复造轮子**：复用现有 `clawkit doctor/apply` 命令，脚本只做编排
2. **最小可用**：优先支持单机模式，满足内部试运行需求
3. **清晰反馈**：每步输出中文日志，失败即停止
4. **灵活可控**：支持跳过构建、仅部署不启动等参数

## quick-start.sh（生产部署）

### 用途

单机模式（all-in-one）一键部署与启动，适合内部试运行和首次部署。

### 核心流程

1. 环境检查（Node.js/pnpm/项目根目录/manifest 文件）
2. 安装依赖（pnpm install）
3. 构建项目（pnpm build，可跳过）
4. 部署前检查（clawkit doctor）
5. 执行部署（clawkit apply）
6. 启动服务（controller + worker）
7. 可选烟雾测试（调用 smoke-test.sh）
8. 输出部署摘要（地址、日志、下一步建议）

### 使用方法

#### 基础用法

```bash
# 使用默认配置（examples/all-in-one.yaml）
./scripts/quick-start.sh

# 或使用 pnpm 命令
pnpm quickstart
```

#### 自定义配置

```bash
# 使用自定义 manifest 文件
./scripts/quick-start.sh -f ./my-config.yaml
```

#### 跳过构建

```bash
# 适合已构建过的情况，节省时间
./scripts/quick-start.sh --skip-build
```

#### 仅部署不启动

```bash
# 只执行部署，不启动服务
./scripts/quick-start.sh --no-start
```

#### 部署后自动测试

```bash
# 部署完成后自动执行烟雾测试
./scripts/quick-start.sh --smoke-test
```

### 支持的参数

| 参数 | 说明 | 默认值 |
|---|---|---|
| `-f, --file <path>` | manifest 文件路径 | `examples/all-in-one.yaml` |
| `--skip-build` | 跳过构建步骤 | 否 |
| `--no-start` | 只部署不启动服务 | 否 |
| `--smoke-test` | 部署后自动执行烟雾测试 | 否 |
| `-h, --help` | 显示帮助信息 | - |

### 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `OPENCLAW_WEBHOOK_TOKEN` | OpenClaw webhook token | `replace-me`（仅供测试） |
| `CONTROLLER_URL` | Controller 地址 | `http://127.0.0.1:8787` |
| `WORKER_ID` | Worker ID | `local-worker` |
| `WORKER_SUPPORTED_PROJECTS` | 支持的项目 key | `clawkit` |

### 输出示例

```
========================================
步骤 1/7：环境检查
========================================
[信息] Node.js 版本：20.11.0
[信息] pnpm 版本：8.15.0
[成功] 环境检查通过

========================================
步骤 2/7：安装依赖
========================================
[信息] 正在安装依赖...
[成功] 依赖安装完成

========================================
步骤 3/7：构建项目
========================================
[信息] 正在构建项目...
[成功] 项目构建完成

========================================
步骤 4/7：部署前检查（doctor）
========================================
[信息] 正在执行配置诊断...
[成功] 配置诊断通过

========================================
步骤 5/7：执行部署（apply）
========================================
[信息] 正在执行部署...
[成功] 部署完成

========================================
步骤 6/7：启动服务
========================================
[信息] 启动 controller...
[成功] controller 已启动（PID: 12345）
[信息] 启动 worker...
[成功] worker 已启动（PID: 12346）
[成功] 所有服务已启动

========================================
部署结果摘要
========================================
[成功] clawkit 部署成功！

[信息] 服务地址：
[信息]   Controller API: http://127.0.0.1:8787/api
[信息]   Web Console:    http://127.0.0.1:8787

[信息] 日志位置：
[信息]   Controller: .clawkit/logs/controller.log
[信息]   Worker:     .clawkit/logs/worker.log

[信息] 进程 ID：
[信息]   Controller: 12345
[信息]   Worker:     12346

[信息] 下一步建议：
[信息]   1. 查看日志：tail -f .clawkit/logs/controller.log
[信息]   2. 访问 Web Console：http://127.0.0.1:8787
[信息]   3. 执行烟雾测试：./scripts/smoke-test.sh
[信息]   4. 停止服务：kill $(cat .clawkit/controller.pid) $(cat .clawkit/worker.pid)

[成功] 部署完成！
```

## quick-start-dev.sh（开发调试）

### 用途

本地开发环境快速启动，适合频繁调试和开发测试。

### 核心流程

1. 快速环境检查
2. 安装依赖
3. 构建项目
4. 启动服务（前台运行）
5. 输出本地访问地址

### 使用方法

```bash
# 直接运行
./scripts/quick-start-dev.sh

# 或使用 pnpm 命令
pnpm quickstart:dev
```

### 特点

- 服务在前台运行，按 `Ctrl+C` 停止
- 适合开发调试，不适合生产部署
- 启动速度快，无需额外配置

### 输出示例

```
========================================
clawkit 开发环境快速启动
========================================

[信息] 正在安装依赖...
[信息] 正在构建项目...

[成功] 准备启动开发服务...

[信息] 本地访问地址：
[信息]   Controller API: http://127.0.0.1:8787/api
[信息]   Web Console:    http://127.0.0.1:8787

[警告] 注意：此脚本适合开发调试，不适合生产部署
[警告] 生产部署请使用：./scripts/quick-start.sh

[信息] 按 Ctrl+C 停止服务

[信息] 启动 controller（前台运行）...
[信息] 启动 worker（前台运行）...
```

## smoke-test.sh（健康检查）

### 用途

部署后快速验证关键服务是否可用。

### 检查项

1. Controller 健康状态（HTTP `/api/health`）
2. Worker 注册状态（查询 controller API）
3. Web Console 可访问性

### 使用方法

```bash
# 使用默认地址（http://127.0.0.1:8787）
./scripts/smoke-test.sh

# 或使用 pnpm 命令
pnpm smoke

# 自定义 Controller 地址
./scripts/smoke-test.sh --controller-url http://192.168.1.100:8787
```

### 支持的参数

| 参数 | 说明 | 默认值 |
|---|---|---|
| `--controller-url <url>` | Controller 地址 | `http://127.0.0.1:8787` |
| `-h, --help` | 显示帮助信息 | - |

### 输出格式

- **通过**：检查项正常
- **警告**：检查项异常但不影响基本功能
- **失败**：检查项失败，需要修复

### 输出示例

```
========================================
clawkit 烟雾测试
========================================

[信息] Controller 地址：http://127.0.0.1:8787

[信息] 开始执行烟雾测试...

[通过] Controller 健康检查通过
[通过] Worker 已注册（数量：1）
[通过] Web Console 可访问

========================================
烟雾测试结果摘要
========================================

通过：3 项
警告：0 项
失败：0 项

[成功] 烟雾测试全部通过！
```

## 与现有命令的关系

一键部署脚本与现有 CLI 命令的关系：

| 脚本功能 | 复用的 CLI 命令 | 说明 |
|---|---|---|
| 部署前检查 | `clawkit doctor` | 诊断配置文件和环境 |
| 执行部署 | `clawkit apply` | 应用配置并执行部署 |
| 启动服务 | 参考 `start-local.sh` | 复用环境变量和启动方式 |

**设计原则**：脚本只做编排，不重复实现部署逻辑。

## 失败时排查建议

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

### 配置诊断失败

**问题**：`clawkit doctor` 检查失败

**解决方法**：
1. 查看 doctor 输出的具体错误信息
2. 根据建议修复配置文件
3. 重新运行 `./scripts/quick-start.sh`

### 服务启动失败

**问题**：Controller 或 Worker 无法启动

**排查步骤**：
```bash
# 1. 查看日志
tail -f .clawkit/logs/controller.log
tail -f .clawkit/logs/worker.log

# 2. 检查端口占用
lsof -i :8787

# 3. 检查进程状态
ps aux | grep clawkit

# 4. 检查环境变量
echo $OPENCLAW_WEBHOOK_TOKEN
```

### 烟雾测试失败

**问题**：`smoke-test.sh` 检查失败

**排查步骤**：
```bash
# 1. 检查服务是否已启动
ps aux | grep clawkit

# 2. 手动测试 Controller API
curl http://127.0.0.1:8787/api/health

# 3. 查看日志
tail -f .clawkit/logs/controller.log
```

## 当前阶段支持的内容

### 支持

- 单机模式（all-in-one）一键部署
- 本地开发快速启动
- 基础健康检查
- 自动备份现有文件
- 清晰的中文日志输出

### 不支持

- 远程批量部署
- 自动域名和证书配置
- 复杂多租户编排
- 自动化运维平台
- 复杂 systemd 管理器重构

## 常见使用场景

### 场景 1：首次部署

```bash
# 1. 克隆项目
git clone <repo-url>
cd clawkit

# 2. 一键部署
./scripts/quick-start.sh

# 3. 验证部署
./scripts/smoke-test.sh
```

### 场景 2：开发调试

```bash
# 1. 快速启动开发环境
./scripts/quick-start-dev.sh

# 2. 修改代码后重新构建
pnpm build

# 3. 重启服务（Ctrl+C 停止后重新运行）
./scripts/quick-start-dev.sh
```

### 场景 3：已构建过，快速重启

```bash
# 跳过构建，直接部署和启动
./scripts/quick-start.sh --skip-build
```

### 场景 4：仅部署不启动

```bash
# 只执行部署，手动启动服务
./scripts/quick-start.sh --no-start

# 手动启动 controller
export OPENCLAW_WEBHOOK_TOKEN="your-token"
pnpm --filter @clawkit/controller start

# 手动启动 worker
pnpm --filter @clawkit/worker start
```

## 停止服务

### 方法 1：使用 PID 文件

```bash
# 停止 controller 和 worker
kill $(cat .clawkit/controller.pid) $(cat .clawkit/worker.pid)
```

### 方法 2：查找进程并停止

```bash
# 查找进程
ps aux | grep clawkit

# 停止进程
kill <PID>
```

### 方法 3：强制停止

```bash
# 强制停止所有 clawkit 相关进程
pkill -f clawkit
```

## 日志查看

### 实时查看日志

```bash
# Controller 日志
tail -f .clawkit/logs/controller.log

# Worker 日志
tail -f .clawkit/logs/worker.log
```

### 查看历史日志

```bash
# 查看最近 100 行
tail -n 100 .clawkit/logs/controller.log

# 查看全部日志
cat .clawkit/logs/controller.log
```

## 下一步

部署成功后，建议：

1. 访问 Web Console：http://127.0.0.1:8787
2. 查看 [最小使用手册](./minimal-user-guide.md) 了解如何使用
3. 查看 [端到端联调说明](./e2e.md) 了解如何验证真实 OpenCode 执行
4. 查看 [CLI 使用文档](./cli.md) 了解更多命令

## 反馈与支持

如遇到问题，请：

1. 查看日志文件
2. 参考本文档的排查建议
3. 提交 Issue 并附上日志信息
