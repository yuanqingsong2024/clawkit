# Setup 向导快速启动与验证指南

本文档提供快速启动 Setup 向导并进行基础验证的步骤。

---

## 一、环境准备

### 1. 确保项目已构建
```bash
cd /Volumes/software/new-code/clawkit
pnpm build
```

### 2. 准备最小运行环境
Setup 向导需要 controller 服务运行才能访问。

---

## 二、启动方式

### 方式 A：使用现有 E2E 脚本（推荐）
```bash
# 这个脚本会自动启动 controller 并托管 Web Console
node ./scripts/e2e-local-demo.js
```

启动后访问：`http://127.0.0.1:8787`

### 方式 B：手动启动 controller
```bash
# 启动 controller（会自动托管 Web Console 静态文件）
node ./packages/controller/dist/index.js
```

启动后访问：`http://127.0.0.1:8787`（或配置的端口）

---

## 三、快速验证步骤

### 验证 1：页面可访问
1. 打开浏览器访问 `http://127.0.0.1:8787`
2. 点击左侧导航栏的 "Setup 向导"
3. 确认页面正常加载，无 JavaScript 错误

**预期结果**：
- ✅ 页面正常显示
- ✅ 看到"1. 选择部署拓扑"区块
- ✅ 看到"2. 填写配置"区块
- ✅ 看到"表单模式"和"YAML 模式"切换按钮

---

### 验证 2：表单模式基础功能
1. 确认默认进入"表单模式"
2. 选择 `all-in-one` 拓扑
3. 观察表单字段是否正确显示：
   - 配置名称
   - 部署拓扑
   - 本地节点名称
   - 本地工作目录
   - Controller 端口
   - OpenClaw 地址
   - Worker ID
   - 项目 key
   - 仓库路径
   - OpenCode 端口
4. 修改任意字段，观察下方 YAML 预览是否实时更新

**预期结果**：
- ✅ 表单字段完整显示
- ✅ 字段值可编辑
- ✅ YAML 预览实时更新

---

### 验证 3：topology 切换
1. 切换到 `hybrid` 拓扑
2. 观察是否出现额外的云端节点字段：
   - 控制面节点名称
   - SSH 主机
   - SSH 端口
   - SSH 用户
   - SSH 私钥路径
   - 远程工作目录

**预期结果**：
- ✅ hybrid 特有字段正确显示
- ✅ YAML 预览包含远程节点配置

---

### 验证 4：表单校验
1. 清空"配置名称"字段
2. 点击"先校验配置"按钮
3. 观察是否显示错误提示

**预期结果**：
- ✅ 显示"表单校验失败"错误
- ✅ 错误信息指出"配置名称不能为空"

---

### 验证 5：YAML 模式切换
1. 填写完整的 all-in-one 配置
2. 点击"切到 YAML 模式"按钮
3. 观察 YAML 编辑器是否显示
4. 确认 YAML 内容与表单一致

**预期结果**：
- ✅ 成功切换到 YAML 模式
- ✅ YAML 内容正确
- ✅ 可以编辑 YAML

---

### 验证 6：preview 功能
1. 在表单模式填写完整配置：
   ```
   配置名称: test-setup
   Controller 端口: 8787
   OpenClaw 地址: http://127.0.0.1:8787
   Worker ID: local-worker
   项目 key: clawkit
   仓库路径: .
   OpenCode 端口: 4096
   ```
2. 点击"先校验配置"按钮
3. 观察是否显示"配置校验通过"提示

**预期结果**：
- ✅ 显示"配置校验通过"提示
- ✅ YAML 预览区域显示标准化 manifest

---

### 验证 7：启动部署（可选）
> ⚠️ 此步骤需要完整的运行环境（OpenCode server 等）

1. 在完成 preview 后，点击"确认并启动部署"
2. 观察执行状态区域是否显示
3. 观察步骤状态是否实时更新

**预期结果**：
- ✅ 显示"4. 执行状态"区块
- ✅ 步骤状态实时更新
- ✅ 可以看到实时日志流

---

## 四、常见问题排查

### 问题 1：页面无法访问
**可能原因**：
- controller 未启动
- 端口被占用

**解决方案**：
```bash
# 检查 controller 是否运行
ps aux | grep controller

# 检查端口占用
lsof -i :8787

# 重新启动
node ./packages/controller/dist/index.js
```

---

### 问题 2：表单字段未显示
**可能原因**：
- 前端构建未完成
- 静态文件未正确托管

**解决方案**：
```bash
# 重新构建
pnpm build

# 确认 dist 目录存在
ls -la packages/web/dist/

# 重启 controller
```

---

### 问题 3：preview 失败
**可能原因**：
- 后端接口未正确响应
- manifest 格式不正确

**解决方案**：
- 检查浏览器控制台错误信息
- 检查 controller 日志
- 确认填写的字段值格式正确（如 URL、端口号）

---

## 五、最小验收标准

完成以下验证即可认为基础功能正常：

- [ ] 页面可访问，无 JavaScript 错误
- [ ] 表单模式正常显示
- [ ] topology 切换正常
- [ ] 表单校验正常
- [ ] YAML 模式切换正常
- [ ] preview 功能正常

---

## 六、完整验证

如需完整验证所有功能，请参考：
- `docs/setup-wizard-manual-verification.md`：详细验证清单
- `docs/setup-wizard-form-implementation-summary.md`：实现总结

---

## 七、下一步

完成基础验证后，可以：
1. 尝试完整的部署流程（需要完整环境）
2. 测试失败场景（如不可达的 URL）
3. 测试重试功能
4. 测试 split 拓扑的 YAML 模式

---

## 八、反馈与改进

如在验证过程中发现问题，请记录：
- 问题现象
- 复现步骤
- 浏览器控制台错误信息
- controller 日志

这些信息将帮助快速定位和修复问题。
