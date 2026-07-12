# Clawkit 简化版快速开始

## 🎯 核心理念

Clawkit 的初衷很简单：**通过手机发消息 → OpenClaw → OpenCode 自动干活**

为了实现这个目标，我们提供了两种配置方式：

1. **简化配置**（推荐）：只需配置项目和 webhook token，3 分钟上手
2. **完整配置**（高级）：支持复杂部署拓扑，适合生产环境

## 🚀 5 分钟快速开始

### 1. 安装依赖并构建

```bash
pnpm install
pnpm build
```

### 2. 创建配置文件

创建 `clawkit.yaml`：

```yaml
# 项目列表
projects:
  - key: my-app
    path: /path/to/my/app
    autoExecute: false  # 需要确认后执行

# OpenClaw 配置
openClaw:
  webhookToken: your-webhook-token-here
```

就这么简单！其他配置全部使用默认值。

### 3. 启动服务

```bash
clawkit start
```

一条命令启动所有服务：
- ✅ Controller (http://127.0.0.1:8787)
- ✅ Worker (自动连接)
- ✅ Webhook 接收器

### 4. 配置 OpenClaw

在 OpenClaw 中配置 webhook：
- URL: `http://127.0.0.1:8787/api/openclaw/webhook`
- Token: `your-webhook-token-here`

### 5. 开始使用

在 OpenClaw 中发送消息：

```
#研发任务
项目: my-app
目标: 修复登录页面的样式问题
约束: 只修改 CSS，不改 JS
验收: 样式正常显示
```

Clawkit 会：
1. 接收任务
2. 生成执行计划
3. 等待你确认（因为 `autoExecute: false`）
4. 确认后自动执行
5. 返回执行结果

## 📋 常用命令

```bash
# 启动服务
clawkit start

# 查看状态
clawkit status

# 查看日志
clawkit logs

# 管理项目
clawkit project list
clawkit project add --key=my-app --path=/path/to/app
clawkit project remove my-app
```

## ⚙️ 配置说明

### 最小配置（只有必填项）

```yaml
projects:
  - key: my-app
    path: /path/to/my/app

openClaw:
  webhookToken: your-token
```

### 完整配置（所有选项）

```yaml
version: "2.0"

projects:
  # 生产项目 - 需要确认
  - key: production-app
    path: /path/to/production
    baseBranch: main
    autoExecute: false  # 需要确认
    dangerousOps:       # 危险操作强制审批
      - delete
      - drop
      - rm -rf
    openCodePort: 4096

  # 测试项目 - 自动执行
  - key: test-app
    path: /path/to/test
    baseBranch: develop
    autoExecute: true   # 自动执行
    dangerousOps: []
    openCodePort: 4097

openClaw:
  url: http://127.0.0.1:18000  # 可选
  webhookToken: your-token

# 可选的高级配置
controllerPort: 8787
openCodeBaseUrl: http://127.0.0.1:4096
dataDir: ./data
```

## 🔧 配置字段说明

### 项目配置

| 字段 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `key` | ✅ | - | 项目唯一标识 |
| `path` | ✅ | - | 项目路径 |
| `baseBranch` | ❌ | `main` | 基础分支 |
| `autoExecute` | ❌ | `false` | 是否自动执行 |
| `dangerousOps` | ❌ | `[]` | 危险操作关键词 |
| `openCodePort` | ❌ | `4096` | OpenCode 端口 |

### OpenClaw 配置

| 字段 | 必填 | 说明 |
|------|------|------|
| `webhookToken` | ✅ | Webhook 鉴权 Token |
| `url` | ❌ | OpenClaw 地址（用于健康检查） |

### 高级配置

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `controllerPort` | `8787` | Controller 端口 |
| `openCodeBaseUrl` | `http://127.0.0.1:4096` | OpenCode 地址 |
| `dataDir` | `./data` | 数据目录 |

## 🎨 审批策略

### 自动执行 vs 需要确认

**自动执行** (`autoExecute: true`)：
- 适合：测试项目、个人项目
- 行为：收到任务后立即执行
- 风险：误操作无法拦截

**需要确认** (`autoExecute: false`)：
- 适合：生产项目、重要项目
- 行为：生成执行计划，等待确认
- 优点：可以审查计划，避免误操作

### 危险操作检测

即使配置了 `autoExecute: true`，如果任务包含危险操作关键词，也会强制等待确认：

```yaml
projects:
  - key: my-app
    autoExecute: true
    dangerousOps:
      - delete
      - drop
      - rm -rf
      - truncate
```

示例：
```
#研发任务
项目: my-app
目标: 删除旧的日志文件  # 包含 "删除"，触发强制审批
```

## 🔄 从完整配置迁移

如果你已经有完整配置（`all-in-one.yaml`），可以继续使用，Clawkit 会自动识别。

但我们推荐迁移到简化配置：

**完整配置** (55 行)：
```yaml
profile:
  name: local-studio
  version: 1.0.0
  topology: all-in-one
nodes:
  local-dev:
    type: local
    workDir: ./.clawkit/local-dev
services:
  controller:
    node: local-dev
    port: 8787
    # ... 更多配置
```

**简化配置** (10 行)：
```yaml
projects:
  - key: my-app
    path: /path/to/app

openClaw:
  webhookToken: your-token
```

## 📊 多项目管理

### 场景：一个人管理多个项目

```yaml
projects:
  - key: project-a
    path: /path/to/project-a
    autoExecute: false

  - key: project-b
    path: /path/to/project-b
    autoExecute: true

  - key: project-c
    path: /path/to/project-c
    autoExecute: false
```

在 OpenClaw 中指定项目：

```
#研发任务
项目: project-a
目标: 修复 bug
```

### 动态添加项目

```bash
# 添加项目
clawkit project add \
  --key=new-project \
  --path=/path/to/new-project \
  --auto-execute \
  --dangerous-ops=delete,drop

# 查看项目列表
clawkit project list

# 删除项目
clawkit project remove new-project
```

## 🆚 简化配置 vs 完整配置

| 维度 | 简化配置 | 完整配置 |
|------|----------|----------|
| **配置行数** | 10 行 | 55 行 |
| **必填字段** | 2 个 | 10+ 个 |
| **学习成本** | 5 分钟 | 30 分钟 |
| **适用场景** | 本地开发、单机部署 | 生产环境、多节点部署 |
| **支持拓扑** | all-in-one | all-in-one / hybrid / split |
| **自动转换** | ✅ 自动转换为完整配置 | - |

## 💡 最佳实践

### 1. 开发环境

```yaml
projects:
  - key: my-app
    path: .
    autoExecute: true  # 开发环境自动执行
    dangerousOps: []   # 不限制
```

### 2. 生产环境

```yaml
projects:
  - key: production-app
    path: /var/www/app
    autoExecute: false  # 生产环境必须确认
    dangerousOps:
      - delete
      - drop
      - rm -rf
      - truncate
      - ALTER TABLE
      - DROP TABLE
```

### 3. 混合环境

```yaml
projects:
  # 生产项目
  - key: prod-api
    path: /var/www/api
    autoExecute: false
    dangerousOps: [delete, drop, rm -rf]

  # 测试项目
  - key: test-api
    path: /var/www/test-api
    autoExecute: true
    dangerousOps: []

  # 个人项目
  - key: my-tool
    path: ~/projects/my-tool
    autoExecute: true
    dangerousOps: []
```

## 🐛 常见问题

### Q: 如何知道使用的是哪种配置？

启动时会显示：

```
📄 加载配置: ./clawkit.yaml
   配置类型: 简化配置
```

### Q: 简化配置支持所有功能吗？

支持核心功能：
- ✅ 多项目管理
- ✅ 自动执行 / 需要确认
- ✅ 危险操作检测
- ✅ Webhook 接入
- ✅ 任务派发与执行

不支持高级功能：
- ❌ 多节点部署（hybrid / split）
- ❌ SSH 远程部署
- ❌ 自定义 Worker 配置

### Q: 可以混用两种配置吗？

不建议。选择一种配置方式并坚持使用。

### Q: 如何从简化配置切换到完整配置？

简化配置会自动转换为完整配置，你可以：

1. 运行 `clawkit start` 查看转换后的配置
2. 手动创建完整配置文件
3. 使用 `clawkit setup` 生成完整配置

## 📚 下一步

- [完整 CLI 命令参考](./cli.md)
- [审批流详解](./approval-flow.md)
- [多项目管理](./multi-project.md)
- [故障排查](./troubleshooting.md)
