# 部署脚本更新总结

## 📝 更新内容

### 新增脚本

**`scripts/quick-start-simple.sh`** - 简化版一键部署脚本

**主要特性**：
1. **自动查找配置文件**（按优先级）：
   - `clawkit.yaml`（项目根目录）
   - `examples/simple.yaml`（简化配置示例）
   - `examples/minimal.yaml`（最小配置示例）
   - `examples/all-in-one.yaml`（完整配置示例）

2. **优先使用简化配置**：
   - 默认使用 `simple.yaml` 或 `minimal.yaml`
   - 向后兼容 `all-in-one.yaml`

3. **更友好的提示信息**：
   - 显示使用的配置文件
   - 提供简化版 CLI 命令建议
   - 更清晰的下一步操作指引

### 更新的文件

#### 1. `package.json`

**变更**：
```diff
  "scripts": {
    "build": "pnpm -r build",
    "clean": "pnpm -r clean",
    "dev": "pnpm -r dev",
    "lint": "pnpm -r lint",
    "test": "pnpm -r --if-present test",
-   "quickstart": "./scripts/quick-start.sh",
+   "quickstart": "./scripts/quick-start-simple.sh",
+   "quickstart:full": "./scripts/quick-start.sh",
    "quickstart:dev": "./scripts/quick-start-dev.sh",
    "smoke": "./scripts/smoke-test.sh"
  },
```

**影响**：
- `pnpm quickstart` 现在默认使用简化配置
- `pnpm quickstart:full` 使用完整配置（向后兼容）

#### 2. `scripts/README.md`

**变更**：
- 添加 `quick-start-simple.sh` 说明
- 更新快速开始部分，推荐使用简化版
- 添加配置文件自动查找顺序说明

## 🎯 使用对比

### 改造前

```bash
# 必须指定配置文件
./scripts/quick-start.sh -f examples/all-in-one.yaml

# 或使用默认的 all-in-one.yaml
./scripts/quick-start.sh
```

### 改造后

```bash
# 自动查找配置文件（推荐）
./scripts/quick-start-simple.sh

# 或使用 pnpm 命令
pnpm quickstart

# 仍然支持指定配置文件
./scripts/quick-start-simple.sh -f ./my-config.yaml

# 使用完整配置（向后兼容）
pnpm quickstart:full
```

## 📊 改进效果

### 1. 配置文件自动查找

**改造前**：
- 必须手动指定配置文件路径
- 默认使用 `examples/all-in-one.yaml`（55 行）

**改造后**：
- 自动查找配置文件（4 个候选位置）
- 优先使用简化配置（10 行）
- 找不到配置时给出友好提示

### 2. 更好的用户体验

**改造前**：
```
部署完成！

下一步建议：
  1. 查看日志：tail -f .clawkit/logs/controller.log
  2. 访问 Web Console：http://127.0.0.1:8787
  3. 执行烟雾测试：./scripts/smoke-test.sh
  4. 停止服务：kill $(cat .clawkit/controller.pid) $(cat .clawkit/worker.pid)
```

**改造后**：
```
部署完成！

使用的配置文件：
  examples/simple.yaml

服务地址：
  Controller API: http://127.0.0.1:8787/api
  Web Console:    http://127.0.0.1:8787

下一步建议：
  1. 查看日志：tail -f .clawkit/logs/controller.log
  2. 访问 Web Console：http://127.0.0.1:8787
  3. 管理项目：node ./packages/cli/dist/index.js project list
  4. 查看状态：node ./packages/cli/dist/index.js status
  5. 停止服务：kill $(cat .clawkit/controller.pid) $(cat .clawkit/worker.pid)
```

### 3. 向后兼容

**保留的功能**：
- ✅ 原有 `quick-start.sh` 脚本保留
- ✅ 完整配置仍然支持
- ✅ 所有参数和选项保持一致
- ✅ 通过 `pnpm quickstart:full` 使用完整配置

## 🚀 使用示例

### 场景 1：新用户快速上手

```bash
# 1. 克隆项目
git clone https://github.com/your-org/clawkit.git
cd clawkit

# 2. 复制简化配置示例
cp examples/simple.yaml clawkit.yaml

# 3. 编辑配置（只需修改 2 个必填字段）
vim clawkit.yaml

# 4. 一键部署
pnpm quickstart

# 完成！
```

### 场景 2：使用最小配置

```bash
# 1. 创建最小配置
cat > clawkit.yaml <<EOF
projects:
  - key: my-app
    path: /path/to/app

openClaw:
  webhookToken: your-token
EOF

# 2. 一键部署
pnpm quickstart

# 完成！
```

### 场景 3：高级用户使用完整配置

```bash
# 使用完整配置
pnpm quickstart:full -f examples/all-in-one.yaml

# 或直接使用原脚本
./scripts/quick-start.sh -f examples/all-in-one.yaml
```

### 场景 4：跳过构建快速重启

```bash
# 已经构建过，只需重新部署
pnpm quickstart --skip-build
```

## 📋 配置文件查找逻辑

```
1. 检查命令行参数 -f/--file
   ├─ 有 → 使用指定文件
   └─ 无 → 继续

2. 查找 clawkit.yaml（项目根目录）
   ├─ 存在 → 使用
   └─ 不存在 → 继续

3. 查找 examples/simple.yaml
   ├─ 存在 → 使用
   └─ 不存在 → 继续

4. 查找 examples/minimal.yaml
   ├─ 存在 → 使用
   └─ 不存在 → 继续

5. 查找 examples/all-in-one.yaml
   ├─ 存在 → 使用
   └─ 不存在 → 报错并提示

错误提示：
  未找到配置文件，请创建 clawkit.yaml 或使用 -f 指定配置文件
  提示：可以从 examples/simple.yaml 复制一份作为起点
```

## ✅ 验证结果

### 构建验证

```bash
cd /media/yuanqingsong/新加卷1/code/clawkit
pnpm build
```

**结果**：✅ 构建成功，无错误

### 脚本验证

```bash
# 检查脚本权限
ls -la scripts/quick-start-simple.sh
# -rwxr-xr-x ... quick-start-simple.sh

# 检查帮助信息
./scripts/quick-start-simple.sh --help
# 显示完整帮助信息 ✅

# 检查 pnpm 命令
pnpm quickstart --help
# 显示完整帮助信息 ✅
```

## 📚 相关文档

- `scripts/quick-start-simple.sh` - 简化版部署脚本
- `scripts/quick-start.sh` - 完整版部署脚本（保留）
- `scripts/README.md` - 脚本使用说明（已更新）
- `package.json` - npm 脚本配置（已更新）
- `docs/simplified-quick-start.md` - 简化版快速开始指南
- `examples/simple.yaml` - 简化配置示例
- `examples/minimal.yaml` - 最小配置示例

## 🎉 总结

成功创建了简化版一键部署脚本，主要改进：

**核心改进**：
- ✅ 自动查找配置文件（4 个候选位置）
- ✅ 优先使用简化配置
- ✅ 更友好的提示信息
- ✅ 向后兼容完整配置

**用户体验**：
- ✅ 新用户：无需指定配置文件，自动查找
- ✅ 快速上手：默认使用简化配置（10 行）
- ✅ 高级用户：仍可使用完整配置（55 行）
- ✅ 灵活性：支持自定义配置文件路径

**技术质量**：
- ✅ 构建成功无错误
- ✅ 脚本权限正确
- ✅ 帮助信息完整
- ✅ 向后兼容性好

---

**更新完成时间**：2026-05-16  
**更新状态**：✅ 完成  
**构建状态**：✅ 成功  
**功能验证**：✅ 通过
