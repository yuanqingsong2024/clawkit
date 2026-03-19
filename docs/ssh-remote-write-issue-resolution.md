# SSH 远程写入问题解决方案总结

> **问题**：`apply 执行失败：远程写入失败（claw.example.com）：Connection closed by 198.18.0.84 port 22`
> 
> **解决时间**：2026-03-16
> 
> **状态**：✅ 已提供完整解决方案

---

## 一、问题根源分析

### 1. 为什么会进行"远程写入"？

`clawkit apply` 命令会根据 manifest 中的节点类型决定文件写入方式：

- **`type: local`** → 本地文件写入（无需 SSH）
- **`type: ssh`** → 远程 SSH 写入（需要 SSH 连接）

当你使用 **hybrid** 或 **split** 拓扑时，会包含 SSH 节点，因此触发远程写入。

### 2. 远程写入的内容

对于每个 SSH 节点，会通过 SSH 连接写入以下文件：

```
<节点工作目录>/
├── clawkit.yaml                    # manifest 副本
├── controller.env                  # Controller 环境变量（如果是 controller 节点）
├── worker-<id>.env                 # Worker 环境变量（如果是 worker 节点）
├── scripts/
│   ├── start-controller.sh         # Controller 启动脚本
│   └── start-worker-<id>.sh        # Worker 启动脚本
└── systemd/
    ├── clawkit-controller.service  # Controller systemd 服务
    └── clawkit-worker-<id>.service # Worker systemd 服务
```

### 3. SSH 连接失败的原因

根据代码分析（`packages/cli/src/services/apply.service.ts:465-472`），SSH 连接失败可能是：

#### 原因 A：SSH 密钥路径不存在
- 配置中指定：`keyPath: ~/.ssh/id_ed25519`
- 实际存在：`~/.ssh/id_rsa`
- **结果**：SSH 认证失败，连接被拒绝

#### 原因 B：远程服务器不可达
- 主机名解析失败（`claw.example.com`）
- 端口不可达（22）
- 防火墙阻止
- SSH 服务未运行

#### 原因 C：认证方式不支持
当前代码仅支持：
- 私钥认证（`keyPath`）
- ssh-agent 认证（`SSH_AUTH_SOCK`）

**不支持密码认证**。

---

## 二、解决方案

### 方案 1：使用 all-in-one 配置（推荐，最简单）

**优点**：
- ✅ 完全避免 SSH 问题
- ✅ 所有文件写入本地
- ✅ 适合快速验证功能

**实施步骤**：

1. **使用提供的测试配置**：
   ```bash
   # 配置文件已生成：test-all-in-one.yaml
   ```

2. **验证配置**：
   ```bash
   node ./packages/cli/dist/index.js doctor -f test-all-in-one.yaml
   ```

3. **快速启动**：
   ```bash
   ./scripts/test-setup-wizard.sh
   ```

4. **访问 Setup 向导**：
   ```
   http://127.0.0.1:8787/setup
   ```

5. **在表单中填写**（或直接使用预设）：
   - 选择 `all-in-one` 拓扑
   - 填写基础信息
   - 点击"确认并启动部署"

### 方案 2：修复 SSH 密钥路径

**适用场景**：需要使用 hybrid 或 split 拓扑

**实施步骤**：

1. **确认实际密钥路径**：
   ```bash
   ls -la ~/.ssh/
   # 你有：id_rsa（不是 id_ed25519）
   ```

2. **在 Setup 向导中修正**：
   - 切换到表单模式
   - 找到"SSH 私钥路径"字段
   - 改为：`~/.ssh/id_rsa`
   - 重新启动部署

3. **或直接编辑配置文件**：
   ```yaml
   nodes:
     cloud-control:
       type: ssh
       host: claw.example.com
       keyPath: ~/.ssh/id_rsa  # 改为实际存在的密钥
   ```

### 方案 3：验证并修复 SSH 连接

**前提检查**：

```bash
# 1. 测试 SSH 连接
ssh -i ~/.ssh/id_rsa deploy@claw.example.com

# 2. 检查主机名解析
host claw.example.com

# 3. 检查端口可达性
nc -zv claw.example.com 22

# 4. 检查密钥权限
chmod 600 ~/.ssh/id_rsa

# 5. 添加公钥到远程服务器
ssh-copy-id -i ~/.ssh/id_rsa.pub deploy@claw.example.com
```

### 方案 4：生成 Ed25519 密钥

**如果你想使用 Ed25519 密钥**：

```bash
# 生成新密钥
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""

# 添加到远程服务器
ssh-copy-id -i ~/.ssh/id_ed25519.pub deploy@claw.example.com

# 测试连接
ssh -i ~/.ssh/id_ed25519 deploy@claw.example.com
```

### 方案 5：仅本地模式执行 apply

**临时跳过远程写入**：

```bash
# 使用 --only-local 参数
node ./packages/cli/dist/index.js apply -f <配置文件> --only-local
```

这会跳过所有 SSH 节点的文件写入，仅处理本地节点。

---

## 三、已完成的工作

### 1. 修复了示例文件
- ✅ `examples/hybrid.yaml`：密钥路径改为 `~/.ssh/id_rsa`
- ✅ `examples/all-in-one.yaml`：修复了被误改成 hybrid 的配置

### 2. 生成了测试配置
- ✅ `test-all-in-one.yaml`：纯本地配置，无需 SSH

### 3. 创建了测试脚本
- ✅ `scripts/test-setup-wizard.sh`：一键启动测试环境

### 4. 编写了完整文档
- ✅ `docs/setup-wizard-all-in-one-test-guide.md`：详细测试指南

---

## 四、推荐的验证流程

### 阶段 1：验证 Setup 向导基础功能（all-in-one）

```bash
# 1. 快速启动
./scripts/test-setup-wizard.sh

# 2. 访问 Setup 向导
open http://127.0.0.1:8787/setup

# 3. 验证功能
- 表单模式正常
- 字段可编辑
- YAML 预览实时更新
- preview 功能正常
- 启动部署成功
- 状态展示正常
```

### 阶段 2：验证 hybrid 模式（可选）

```bash
# 1. 修复 SSH 密钥路径
# 2. 验证 SSH 连接
ssh -i ~/.ssh/id_rsa deploy@claw.example.com

# 3. 在 Setup 向导中使用 hybrid 配置
# 4. 确认远程写入成功
```

---

## 五、关键文件位置

### 配置文件
- `test-all-in-one.yaml`：测试配置（已生成）
- `examples/hybrid.yaml`：hybrid 示例（已修复）
- `examples/all-in-one.yaml`：all-in-one 示例（已修复）

### 文档
- `docs/setup-wizard-all-in-one-test-guide.md`：详细测试指南
- `docs/setup-wizard-quick-start.md`：快速启动指南
- `docs/setup-wizard-manual-verification.md`：完整验证清单

### 脚本
- `scripts/test-setup-wizard.sh`：快速启动脚本

### 源码
- `packages/cli/src/services/apply.service.ts`：apply 命令实现
- `packages/web/src/pages/SetupWizardPage.tsx`：Setup 向导页面

---

## 六、常见问题

### Q1: 为什么 all-in-one 不需要 SSH？
**A**: all-in-one 拓扑中所有节点都是 `type: local`，文件直接写入本地目录，不需要远程连接。

### Q2: hybrid 和 split 一定需要 SSH 吗？
**A**: 是的。hybrid 和 split 拓扑包含远程节点（`type: ssh`），必须通过 SSH 连接写入配置文件。

### Q3: 可以使用密码认证吗？
**A**: 当前版本不支持密码认证，仅支持：
- 私钥认证（`keyPath`）
- ssh-agent 认证

### Q4: 远程写入失败会影响本地文件吗？
**A**: 不会。本地文件和远程文件是独立写入的，远程失败不影响本地。

### Q5: 如何回滚已写入的文件？
**A**: apply 命令会自动备份已存在的文件，备份文件名格式：
```
<原文件名>.<时间戳>.bak
```

---

## 七、技术细节

### SSH 连接实现
```typescript
// packages/cli/src/services/apply.service.ts:465-472
const result = spawnSync('ssh', [...this.buildSshArgs(node), command], {
  encoding: 'utf8',
  input: filePlan.content,
});

if (result.status !== 0) {
  const message = result.stderr.trim() || result.stdout.trim() || '未知 SSH 错误';
  throw new Error(`远程写入失败（${node.host}）：${message}`);
}
```

### SSH 参数构造
```typescript
// packages/cli/src/services/apply.service.ts:478-485
private buildSshArgs(node: SshNode): string[] {
  const args = ['-p', String(node.port)];
  if (node.keyPath) {
    args.push('-i', node.keyPath.replace(/^~\//, `${os.homedir()}/`));
  }
  args.push(`${node.user}@${node.host}`);
  return args;
}
```

### 远程写入命令
```bash
mkdir -p <目录> && \
if [ -f <文件> ]; then cp <文件> <备份>; fi && \
cat > <文件>
```

---

## 八、下一步行动

### 立即可做
1. **运行快速启动脚本**：
   ```bash
   ./scripts/test-setup-wizard.sh
   ```

2. **访问 Setup 向导**：
   ```
   http://127.0.0.1:8787/setup
   ```

3. **验证基础功能**：
   - 表单模式
   - preview 功能
   - 启动部署
   - 状态展示

### 后续可选
1. **修复 SSH 配置**（如需使用 hybrid）
2. **验证 hybrid 模式**
3. **测试失败场景**
4. **测试重试功能**

---

## 九、总结

**问题原因**：
- 使用了 hybrid 配置
- SSH 密钥路径配置错误（`id_ed25519` 不存在）
- 实际拥有的是 `id_rsa`

**解决方案**：
- ✅ 提供了 all-in-one 测试配置（推荐）
- ✅ 修复了示例文件中的密钥路径
- ✅ 创建了快速启动脚本
- ✅ 编写了完整的测试指南

**验证状态**：
- ✅ 代码实现完成
- ✅ 构建通过
- ✅ 测试配置就绪
- ⏳ 待手动验证

**推荐行动**：
先使用 all-in-one 配置验证 Setup 向导的表单功能，确认所有功能正常后，再配置 hybrid 模式测试远程部署。

---

**快速启动命令**：
```bash
./scripts/test-setup-wizard.sh
```

**Setup 向导地址**：
```
http://127.0.0.1:8787/setup
```
