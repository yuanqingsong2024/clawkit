# ClawKit CLI 文档

## 1. 当前 CLI 能力

当前 CLI 已经提供一组以简化配置优先的可运行命令：

- `init`：默认生成简化配置；使用 `--full` 可生成完整配置
- `doctor`：诊断 manifest 与环境
- `plan`：输出 dry-run 执行计划
- `apply`：生成并写入最小部署文件
- `heal`：诊断并修复部分本地问题

## 2. 命令列表

| 命令 | 状态 | 说明 |
|---|---|---|
| `clawkit init` | ✅ 可用 | 交互式生成配置，默认走简化配置流 |
| `clawkit doctor` | ✅ 可用 | 诊断配置与环境 |
| `clawkit plan` | ✅ 可用 | 查看执行计划 |
| `clawkit apply` | ✅ 可用 | 生成 env / systemd / 启动脚本 / OpenClaw 配置建议 |
| `clawkit heal` | ✅ 可用 | 输出修复计划并自动修复部分本地文件 |
| `clawkit start` | ✅ 可用 | 推荐入口，一键启动服务 |
| `clawkit project` | ✅ 可用 | 管理简化配置中的项目列表 |
| `clawkit status` | ✅ 可用 | 查看服务运行状态 |
| `clawkit logs` | ✅ 可用 | 查看运行日志 |

## 3. init

### 输入

```bash
clawkit init [options]
```

| 选项 | 说明 |
|---|---|
| `-o, --output <path>` | 输出文件路径，默认 `./clawkit.yaml` |
| `--full` | 生成完整配置（包含拓扑、nodes、services、workers、runtime 等全部字段） |

### 默认交互项（简化配置）

1. 输入项目标识与项目路径
2. 是否自动执行任务
3. 是否配置危险操作关键词
4. 输入 OpenClaw webhook token
5. 可选输入 OpenClaw URL

说明：默认 `init` 生成的是简化配置；如需旧版完整配置流，请使用 `clawkit init --full`。

## 4. doctor

```bash
clawkit doctor -f ./clawkit.yaml
```

当前检查项包括：

- manifest 文件存在性
- YAML 语法
- schema 校验
- Node.js 版本
- pnpm 可用性
- 本地 repoPath 存在性
- 端口冲突
- SSH 节点结构

## 5. plan

```bash
clawkit plan -f ./clawkit.yaml
clawkit plan -f ./examples/simple.yaml
```

输出内容包括：

- 拓扑与节点
- 角色分布
- 待生成文件
- 执行步骤
- 当前阶段边界说明

## 6. apply

```bash
clawkit apply -f ./clawkit.yaml
clawkit apply -f ./clawkit.yaml --dry-run
clawkit start
```

当前负责：

- 读取并校验 manifest
- 生成 `controller.env`、`worker.env`
- 生成 systemd 文件与启动脚本
- 生成 `~/.openclaw/openclaw.json`
- 本地真实写入
- SSH 节点最小远程写入

## 7. heal

```bash
clawkit heal -f ./clawkit.yaml --dry-run
clawkit heal -f ./clawkit.yaml --force
```

当前覆盖：

- manifest 不合法
- 生成文件缺失或损坏
- OpenClaw token 缺失
- repoPath 不存在
- OpenCode 不可达
- worker 未注册
- controller 未启动

## 8. 命令关系

推荐使用顺序：

```text
init -> doctor -> plan -> start
```

如果你需要查看展开后的部署文件，再使用：

```text
init -> doctor -> plan -> apply --dry-run -> apply
```

## 9. 当前边界

CLI 当前不负责：

- 自动公网暴露
- 自动申请证书
- 自动部署生产业务代码
- 自动 PR
- 复杂远程环境编排
