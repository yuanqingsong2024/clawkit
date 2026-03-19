# clawkit heal 说明

## 1. 目标

`clawkit heal` 当前阶段用于诊断最常见的部署问题，并对一部分本地配置问题执行自动修复。

当前阶段 **heal 负责**：

- 结构化诊断
- 输出修复计划
- 检查配置文件缺失或损坏
- 检查 OpenClaw webhook token 是否配置
- 检查项目路径是否存在
- 检查 OpenCode server 可达性
- 检查 worker 是否已注册
- 检查 controller 服务是否可用
- 自动重建本地缺失/损坏的生成文件

当前阶段 **heal 不负责**：

- 自动公网修复
- 自动申请域名/证书
- 自动部署生产代码
- 自动 PR
- 复杂远程自愈编排
- 自动远程重启 systemd 服务

---

## 2. 命令

仅输出诊断与修复计划：

```bash
clawkit heal -f ./clawkit.yaml
```

显式 dry-run：

```bash
clawkit heal -f ./clawkit.yaml --dry-run
```

执行最小自动修复：

```bash
clawkit heal -f ./clawkit.yaml --force
```

---

## 3. 当前阶段覆盖的问题

1. manifest 缺失关键字段或格式错误
2. 配置文件缺失
3. 配置文件损坏或与当前 schema 不兼容
4. worker 未注册
5. OpenCode server 不可达
6. OpenClaw webhook token 未配置
7. 项目路径不存在
8. controller 服务未启动或状态异常

---

## 4. 自动修复策略

### 可自动修复

- 本地生成文件缺失
- 本地 `controller.env` / `worker.env` 缺少关键字段
- 本地 `~/.openclaw/openclaw.json` 缺失（通过重新执行 apply 逻辑补齐）

### 当前只给建议，不自动修复

- manifest 本身缺字段
- 项目路径不存在
- OpenCode server 未启动
- worker 未注册
- controller 服务异常
- SSH 远程问题

---

## 5. 输出示例

```text
✗ 配置文件缺失：Controller 环境变量文件：未找到 /tmp/work/controller.env
ℹ 建议：可通过 heal --force 自动重建本地生成文件。
ℹ 可自动修复：是

⚠ OpenCode server 不可达：site-web
ℹ 建议：请先启动 opencode serve --hostname 127.0.0.1 --port 4096
ℹ 可自动修复：否
```

---

## 6. 建议使用方式

### 6.1 先看计划

```bash
clawkit heal -f ./clawkit.yaml
```

### 6.2 确认后执行自动修复

```bash
clawkit heal -f ./clawkit.yaml --force
```

这样可以避免盲修。

---

## 7. 典型场景

### 7.1 apply 后手工误删了 env 文件

```bash
clawkit heal -f ./clawkit.yaml --force
```

预期：重新生成本地 env 与相关文件。

### 7.2 OpenCode 没启动

```bash
clawkit heal -f ./clawkit.yaml
```

预期：提示 `opencode serve --hostname 127.0.0.1 --port <port>`。

### 7.3 worker 没连上 controller

```bash
clawkit heal -f ./clawkit.yaml
```

预期：提示检查 `CONTROLLER_URL`、worker 进程与 controller 地址。
