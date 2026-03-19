# Setup 向导 all-in-one 测试指南

本指南帮助你使用纯本地配置验证 Setup 向导的表单功能，完全避免 SSH 连接问题。

---

## 一、准备工作

### 1. 确保项目已构建
```bash
cd /Volumes/software/new-code/clawkit
pnpm build
```

### 2. 测试配置文件
已为你生成测试配置：`test-all-in-one.yaml`

**配置特点**：
- ✅ 纯本地部署（`type: local`）
- ✅ 无需 SSH 连接
- ✅ 所有文件写入本地目录
- ✅ 适合快速验证功能

---

## 二、验证配置文件

### 1. 运行 doctor 检查
```bash
node ./packages/cli/dist/index.js doctor -f test-all-in-one.yaml
```

**预期结果**：
```
✓ 所有检查通过
```

### 2. 预览部署计划
```bash
node ./packages/cli/dist/index.js apply -f test-all-in-one.yaml --dry-run
```

**预期结果**：
- 显示将要生成的 9 个文件
- 所有文件路径都在 `.clawkit/local-dev/` 目录下
- 无远程 SSH 操作

---

## 三、在 Setup 向导中使用

### 方式 1：通过 Web Console 使用（推荐）

1. **启动 controller**：
   ```bash
   node ./packages/controller/dist/index.js
   ```

2. **访问 Setup 向导**：
   ```
   http://127.0.0.1:8787/setup
   ```

3. **在表单模式中填写**：
   ```
   配置名称: test-all-in-one
   部署拓扑: all-in-one
   本地节点名称: local-dev
   本地工作目录: ./.clawkit/local-dev
   Controller 端口: 8787
   API 前缀: /api
   OpenClaw 地址: http://127.0.0.1:8787
   OpenClaw Token: test-token-replace-me
   Worker ID: local-worker
   连接模式: pull
   Worker 标签: local,test
   项目 key: clawkit
   仓库路径: .
   基础分支: main
   OpenCode 端口: 4096
   OpenCode Agent: build
   OpenCode 模式: default
   Memory Provider: local
   Memory Path: ./data/memory
   ```

4. **点击"先校验配置"**：
   - 确认看到"配置校验通过"提示
   - 查看 YAML 预览

5. **点击"确认并启动部署"**：
   - 观察执行状态
   - 查看实时日志
   - 等待完成或失败

### 方式 2：通过 CLI 直接执行

```bash
# 执行部署（真实写入）
node ./packages/cli/dist/index.js apply -f test-all-in-one.yaml

# 查看生成的文件
ls -la .clawkit/local-dev/
```

---

## 四、验证生成的文件

### 1. 检查目录结构
```bash
tree .clawkit/local-dev/
```

**预期结构**：
```
.clawkit/local-dev/
├── clawkit.yaml                          # manifest 副本
├── controller.env                        # Controller 环境变量
├── worker-local-worker.env               # Worker 环境变量
├── opencode-clawkit.launch.yaml          # OpenCode 启动配置
├── scripts/
│   ├── start-controller.sh               # Controller 启动脚本
│   └── start-worker-local-worker.sh      # Worker 启动脚本
└── systemd/
    ├── clawkit-controller.service        # Controller systemd 服务
    └── clawkit-worker-local-worker.service # Worker systemd 服务
```

### 2. 查看关键文件内容

**Controller 环境变量**：
```bash
cat .clawkit/local-dev/controller.env
```

**Worker 环境变量**：
```bash
cat .clawkit/local-dev/worker-local-worker.env
```

**启动脚本**：
```bash
cat .clawkit/local-dev/scripts/start-controller.sh
```

---

## 五、启动服务

### 1. 启动 Controller
```bash
# 方式 A：使用生成的启动脚本
./.clawkit/local-dev/scripts/start-controller.sh

# 方式 B：直接运行
node ./packages/controller/dist/index.js
```

**预期输出**：
```
Controller HTTP 服务已启动：http://0.0.0.0:8787
```

### 2. 启动 Worker（新终端）
```bash
# 方式 A：使用生成的启动脚本
./.clawkit/local-dev/scripts/start-worker-local-worker.sh

# 方式 B：直接运行
node ./packages/worker/dist/index.js
```

**预期输出**：
```
Worker 已启动：local-worker
```

### 3. 验证服务状态

**访问 Web Console**：
```
http://127.0.0.1:8787
```

**检查 Controller 健康**：
```bash
curl http://127.0.0.1:8787/api/health
```

**检查 Worker 注册**：
```bash
curl http://127.0.0.1:8787/api/workers
```

---

## 六、Setup 向导完整流程验证

### 验证清单

#### 1. 表单模式基础功能
- [ ] 页面正常加载
- [ ] 可以选择 all-in-one 拓扑
- [ ] 表单字段正确显示
- [ ] 字段可以编辑
- [ ] YAML 预览实时更新

#### 2. 表单校验
- [ ] 留空必填字段时显示错误
- [ ] 端口号格式错误时显示提示
- [ ] URL 格式错误时显示提示

#### 3. preview 功能
- [ ] 点击"先校验配置"成功
- [ ] 显示"配置校验通过"提示
- [ ] YAML 预览区域显示标准化 manifest

#### 4. 启动部署
- [ ] 点击"确认并启动部署"成功
- [ ] 显示"4. 执行状态"区块
- [ ] 步骤状态实时更新
- [ ] 可以看到实时日志流
- [ ] 最终显示执行摘要

#### 5. 失败场景
- [ ] 故意填写错误配置（如端口冲突）
- [ ] 确认看到步骤失败状态
- [ ] 确认看到错误摘要
- [ ] 重试按钮可用

#### 6. 模式切换
- [ ] 可以切换到 YAML 模式
- [ ] YAML 内容与表单一致
- [ ] 可以在 YAML 模式编辑
- [ ] 可以切回表单模式

---

## 七、常见问题

### Q1: apply 执行失败，提示"远程写入失败"
**A**: 确认你使用的是 `test-all-in-one.yaml` 配置，而不是 hybrid 配置。all-in-one 不会进行远程写入。

### Q2: Controller 启动失败，提示端口被占用
**A**: 检查端口 8787 是否被占用：
```bash
lsof -i :8787
# 如果被占用，杀掉进程或修改配置中的端口
```

### Q3: Worker 无法连接到 Controller
**A**: 确认：
- Controller 已启动
- 端口配置一致（都是 8787）
- 防火墙未阻止本地连接

### Q4: Setup 向导页面无法访问
**A**: 确认：
- Controller 已启动
- 访问正确的 URL：`http://127.0.0.1:8787/setup`
- 浏览器控制台无 JavaScript 错误

---

## 八、清理测试环境

### 删除生成的文件
```bash
rm -rf .clawkit/local-dev/
```

### 删除测试配置
```bash
rm test-all-in-one.yaml
```

### 停止服务
```bash
# 在运行 Controller/Worker 的终端按 Ctrl+C
```

---

## 九、下一步

完成 all-in-one 验证后，如果需要测试 hybrid 模式：

1. **修复 SSH 密钥路径**：
   - 在 Setup 向导中将 `keyPath` 改为 `~/.ssh/id_rsa`

2. **验证 SSH 连接**：
   ```bash
   ssh -i ~/.ssh/id_rsa deploy@claw.example.com
   ```

3. **确认远程服务器准备就绪**：
   - 公钥已添加
   - 目标目录有写入权限
   - SSH 服务正常运行

4. **在 Setup 向导中使用 hybrid 配置**

---

## 十、反馈与改进

如在验证过程中发现问题，请记录：
- 问题现象
- 复现步骤
- 浏览器控制台错误（如有）
- Controller 日志输出

这些信息将帮助快速定位和修复问题。

---

**测试配置文件位置**：`/Volumes/software/new-code/clawkit/test-all-in-one.yaml`

**快速启动命令**：
```bash
# 1. 启动 Controller
node ./packages/controller/dist/index.js

# 2. 访问 Setup 向导
open http://127.0.0.1:8787/setup
```
