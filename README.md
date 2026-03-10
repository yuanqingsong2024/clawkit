# clawkit

一键部署、配置并串联 OpenClaw 与 OpenCode 的轻量工具。

## 项目状态

**当前阶段：项目初始化**

本项目目前处于初始化阶段，仅搭建了基础工程结构，尚未实现业务逻辑。

## 项目简介

clawkit 旨在简化 OpenClaw 与 OpenCode 的部署与配置流程，支持三种部署拓扑：

1. **单机模式**：OpenClaw、controller、worker、OpenCode 在同一台机器
2. **混合模式**：OpenClaw + controller 在云端，worker + OpenCode 在本地
3. **双机模式**：OpenClaw + controller 在 A 机器，worker + OpenCode 在 B 机器

## 技术栈

- TypeScript
- Node.js 20+
- pnpm workspace (monorepo)

## 目录结构

```
clawkit/
├── packages/
│   ├── cli/                 # 命令行工具（未实现）
│   ├── controller/          # 控制器服务（未实现）
│   ├── worker/              # 工作节点（未实现）
│   ├── shared/              # 共享代码（未实现）
│   └── templates/           # 配置模板（未实现）
├── docs/                    # 项目文档
│   ├── architecture.md      # 架构设计
│   ├── roadmap.md           # 开发路线图
│   └── project-scope.md     # 项目范围
├── examples/                # 示例配置
│   ├── all-in-one.yaml      # 单机模式示例
│   ├── hybrid.yaml          # 混合模式示例
│   └── split.yaml           # 双机模式示例
├── scripts/                 # 构建脚本
└── AGENTS.md                # AI 协作规则
```

## 本地开发

### 环境要求

- Node.js >= 20.0.0
- pnpm >= 8.0.0

### 安装依赖

```bash
pnpm install
```

### 构建

```bash
pnpm build
```

### 清理

```bash
pnpm clean
```

## 后续开发计划

详见 [docs/roadmap.md](./docs/roadmap.md)

### 第一阶段：核心功能

- [ ] 实现 CLI 基础命令
- [ ] 实现配置文件解析
- [ ] 实现单机模式部署
- [ ] 实现基础健康检查

### 第二阶段：拓扑支持

- [ ] 实现混合模式部署
- [ ] 实现双机模式部署
- [ ] 实现节点间通信

### 第三阶段：增强功能

- [ ] 实现 Web UI
- [ ] 实现自动化 PR
- [ ] 实现权限系统

## 许可证

待定

## 贡献

欢迎贡献！请先阅读 [AGENTS.md](./AGENTS.md) 了解协作规则。
