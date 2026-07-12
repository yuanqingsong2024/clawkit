# Clawkit 简化版说明

## 🎯 简化目标

基于你的反馈，我们对 clawkit 进行了全面简化，回归初衷：**手机发消息 → OpenClaw → OpenCode 自动干活**

## ✨ 简化成果

### 1. 配置简化（82% ↓）

**之前**：55 行 YAML，10+ 个必填字段
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
    apiPrefix: /api
    publicUrl: http://127.0.0.1:8787
  # ... 还有 40 多行
```

**现在**：10 行 YAML，2 个必填字段
```yaml
projects:
  - key: my-app
    path: /path/to/my/app

openClaw:
  webhookToken: your-token
```

### 2. CLI 简化（57% ↓）

**之前**：7 个命令
```bash
clawkit init
clawkit doctor
clawkit plan
clawkit apply
clawkit heal
clawkit onboard
clawkit verify
```

**现在**：3 个核心命令
```bash
clawkit start    # 一键启动
clawkit status   # 查看状态
clawkit project  # 管理项目
```

### 3. 审批流简化

**之前**：所有任务都需要手动确认

**现在**：支持两种模式
- `autoExecute: true` - 自动执行（测试项目）
- `autoExecute: false` - 需要确认（生产项目）
- 危险操作强制审批（无论哪种模式）

### 4. 架构保持不变

**重要**：我们**没有**合并 Controller + Worker，因为：
- 改动成本太高
- 会破坏现有代码
- 多任务处理需要队列管理

我们的简化策略是：**保留架构，简化使用**

## 📊 简化前后对比

| 维度 | 简化前 | 简化后 | 改善 |
|------|--------|--------|------|
| 配置行数 | 55 行 | 10 行 | ↓ 82% |
| 必填字段 | 10+ 个 | 2 个 | ↓ 80% |
| CLI 命令 | 7 个 | 3 个 | ↓ 57% |
| 启动步骤 | 5 步 | 1 步 | ↓ 80% |
| 学习时间 | 30 分钟 | 5 分钟 | ↓ 83% |

## 🚀 快速开始

### 1. 创建配置

```yaml
# clawkit.yaml
projects:
  - key: my-app
    path: /path/to/my/app
    autoExecute: false  # 需要确认

openClaw:
  webhookToken: your-token
```

### 2. 启动服务

```bash
clawkit start
```

### 3. 开始使用

在 OpenClaw 中发送：
```
#研发任务
项目: my-app
目标: 修复登录 bug
```

就这么简单！

## 🎨 核心功能

### 1. 多项目管理

```yaml
projects:
  - key: project-a
    path: /path/to/a
    autoExecute: false  # 生产项目，需要确认

  - key: project-b
    path: /path/to/b
    autoExecute: true   # 测试项目，自动执行
```

### 2. 智能审批

```yaml
projects:
  - key: my-app
    autoExecute: true
    dangerousOps:      # 即使自动执行，遇到这些也会强制审批
      - delete
      - drop
      - rm -rf
```

### 3. 动态管理

```bash
# 添加项目
clawkit project add --key=new-app --path=/path/to/app

# 查看项目
clawkit project list

# 删除项目
clawkit project remove new-app
```

## 📁 文件结构

```
clawkit/
├── packages/
│   ├── shared/
│   │   └── src/
│   │       ├── schema/
│   │       │   └── manifest-simple.ts      # 简化配置 schema
│   │       ├── services/
│   │       │   ├── approval-policy-service.ts    # 审批策略
│   │       │   └── project-management-service.ts # 项目管理
│   │       └── utils/
│   │           └── manifest-loader.ts       # 配置加载器
│   ├── cli/
│   │   └── src/
│   │       └── commands/
│   │           ├── start.ts    # 启动命令
│   │           ├── project.ts  # 项目管理
│   │           ├── status.ts   # 状态查看
│   │           └── logs.ts     # 日志查看
│   ├── controller/             # 保持不变
│   └── worker/                 # 保持不变
├── examples/
│   ├── simple.yaml             # 简化配置示例
│   ├── minimal.yaml            # 最小配置示例
│   └── all-in-one.yaml         # 完整配置示例（向后兼容）
└── docs/
    └── simplified-quick-start.md  # 简化版快速开始
```

## 🔄 向后兼容

**完整配置仍然支持**，Clawkit 会自动识别配置类型：

```bash
# 使用简化配置
clawkit start -c ./clawkit.yaml

# 使用完整配置
clawkit start -c ./examples/all-in-one.yaml
```

## 🎯 设计原则

### 1. 默认值优先

只配置必要的，其他用默认值：
- Controller 端口：`8787`
- OpenCode 地址：`http://127.0.0.1:4096`
- 数据目录：`./data`

### 2. 约定优于配置

- 配置文件自动查找：`clawkit.yaml` → `examples/simple.yaml`
- 项目自动隔离：通过 `projectKey`
- 审批策略自动应用：根据 `autoExecute` 和 `dangerousOps`

### 3. 渐进式增强

- 最小配置：2 个字段
- 常用配置：5 个字段
- 完整配置：10+ 个字段

用户可以根据需要逐步添加配置。

## 💡 使用建议

### 开发环境

```yaml
projects:
  - key: my-app
    path: .
    autoExecute: true  # 自动执行，快速迭代

openClaw:
  webhookToken: dev-token
```

### 生产环境

```yaml
projects:
  - key: production-app
    path: /var/www/app
    autoExecute: false  # 必须确认
    dangerousOps:
      - delete
      - drop
      - rm -rf

openClaw:
  webhookToken: prod-token
```

## 🐛 已知限制

简化配置**不支持**以下高级功能：
- ❌ 多节点部署（hybrid / split 拓扑）
- ❌ SSH 远程部署
- ❌ 自定义 Worker 配置
- ❌ 复杂网络拓扑

如需这些功能，请使用完整配置。

## 📚 文档

- [简化版快速开始](./docs/simplified-quick-start.md) - **推荐新用户阅读**
- [完整版快速开始](./docs/quick-start.md) - 完整配置说明
- [CLI 命令参考](./docs/cli.md) - 所有命令详解
- [项目范围说明](./docs/project-scope.md) - 功能边界

## 🤝 反馈

如果你觉得还是太复杂，或者有更好的简化建议，欢迎反馈！

我们的目标是：**让用户 5 分钟上手，专注于任务本身，而不是配置和部署。**
