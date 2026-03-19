# clawkit apply 说明

## 1. 目标

`clawkit apply` 当前阶段负责把 manifest 渲染成最小可用部署文件，并执行最小真实写入。

当前阶段 **apply 负责**：

- 读取并校验 manifest
- 生成配置文件
- 生成 env 文件
- 生成 systemd service 文件
- 生成本地启动脚本
- 写入 `~/.openclaw/openclaw.json`
- 写入前自动备份旧文件
- 支持本机模式真实写入
- 支持 SSH 节点最小远程写入

当前阶段 **apply 不负责**：

- 自动公网暴露
- 自动申请域名/证书
- 自动部署生产业务代码
- 自动 PR
- 复杂环境编排
- 远程代码同步
- 自动安装 systemd unit

---

## 2. 命令

```bash
clawkit apply -f ./clawkit.yaml
```

仅预览：

```bash
clawkit apply -f ./clawkit.yaml --dry-run
```

---

## 3. 当前阶段会生成哪些文件

### 控制面

- `controller.env`
- `systemd/clawkit-controller.service`
- `scripts/start-controller.sh`
- `clawkit.yaml`（节点工作目录副本）

### 执行面

- `worker-<id>.env`
- `systemd/clawkit-worker-<id>.service`
- `scripts/start-worker-<id>.sh`
- `opencode-<project>.launch.yaml`
- `clawkit.yaml`（节点工作目录副本）

### OpenClaw

- `~/.openclaw/openclaw.json`

---

## 4. 备份策略

如果目标文件已存在，`apply` 会先自动备份：

```text
<原文件路径>.<时间戳>.bak
```

示例：

```text
controller.env.20260311093015.bak
```

---

## 5. 单机模式示例

```bash
clawkit apply -f ./examples/all-in-one.yaml
```

预期结果：

1. 在本地工作目录生成 controller / worker / OpenCode 相关文件
2. 在 `~/.openclaw/openclaw.json` 写入 webhook 配置
3. 如果旧文件存在，会自动备份

---

## 6. 混合模式示例

```bash
clawkit apply -f ./examples/hybrid.yaml
```

当前阶段混合模式说明：

- 本地节点：真实写入
- SSH 节点：执行最小远程写入
- 不负责远程安装依赖、代码同步、systemd enable/start

如果 SSH 节点要真实写入，请确保：

1. 已配置 `keyPath` 或 ssh-agent
2. 目标机器可通过 `ssh user@host` 无交互连接

---

## 7. 生成后的启动建议

### 本地 controller

```bash
bash <workDir>/scripts/start-controller.sh
```

### 本地 worker

```bash
bash <workDir>/scripts/start-worker-<id>.sh
```

### systemd 安装示例（手动）

```bash
sudo cp <workDir>/systemd/clawkit-controller.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now clawkit-controller.service
```

> 当前阶段只生成 unit 文件，不自动安装。

---

## 8. 常见提示

### 8.1 token 未配置

如果 manifest 没有 `services.openClaw.apiKey`，`apply` 仍会写文件，但会写入占位值：

```text
__CHANGE_ME_OPENCLAW_TOKEN__
```

请手动替换后再启动 controller。

### 8.2 为什么没有自动启动服务？

当前阶段强调“最小部署动作”和“边界清晰”，因此：

- 负责写文件
- 负责生成启动脚本和 service 文件
- 不负责复杂启动编排

这样可以避免误启动远程服务、误覆盖现网配置。
