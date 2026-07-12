# 历史文档索引

本文档用于区分**当前仍推荐阅读的现行文档**与**主要用于回溯、验收、试运行复盘的历史资料**。

## 1. 当前推荐阅读

新用户或日常使用，优先阅读下面这些文档：

- `README.md`：项目总览与常用入口
- `docs/simplified-quick-start.md`：简化配置快速开始
- `docs/quick-start.md`：一键部署与启动说明
- `docs/cli.md`：CLI 命令说明
- `docs/manifest.md`：manifest 结构说明
- `docs/minimal-user-guide.md`：最小使用手册

## 2. 历史资料

下面这些文档主要用于保留阶段性背景、实现过程、发布验收与试运行记录：

### 2.1 Setup 向导相关

- `docs/archive/setup-wizard.md`
- `docs/archive/setup-wizard-quick-start.md`
- `docs/archive/setup-wizard-manual-verification.md`
- `docs/archive/setup-wizard-verification-report.md`
- `docs/archive/setup-wizard-form-implementation-plan.md`
- `docs/archive/setup-wizard-form-implementation-summary.md`
- `docs/archive/setup-wizard-delivery-checklist.md`
- `docs/archive/setup-wizard-sse-deployment.md`
- `docs/archive/setup-wizard-all-in-one-test-guide.md`

### 2.2 发布与验收相关

- `docs/archive/release-acceptance.md`
- `docs/archive/release-closeout-plan.md`
- `docs/archive/release-execution-summary.md`
- `docs/archive/release-notes-v0.1.0-draft.md`
- `docs/archive/release-notes-v0.1.1-draft.md`

### 2.3 内部试运行相关

- `docs/archive/internal-trial-checklist.md`
- `docs/archive/internal-trial-metrics.md`
- `docs/archive/internal-trial-scenarios.md`
- `docs/archive/trial-summary-template.md`
- `docs/archive/trial-issue-template.md`

### 2.4 阶段总结与问题记录

- `docs/archive/stage-1-summary.md`
- `docs/archive/stage-2-summary.md`
- `docs/archive/ssh-remote-write-issue-resolution.md`
- `docs/archive/fix-openclaw-deploy-button.md`
- `docs/archive/fix-openclaw-healthcheck-summary.md`
- `docs/archive/troubleshooting-openclaw-healthcheck.md`

## 3. 已废弃功能说明

### 3.1 Setup 命令与向导（已移除）

**废弃时间**：v0.2.0

**原功能**：
- CLI 命令：`clawkit setup`
- Web 向导：Setup Wizard 页面
- Controller API：`/api/setup/*` 端点

**废弃原因**：
- 与简化配置方案存在功能重叠
- 增加学习成本和维护负担
- 用户容易混淆两套配置方式

**迁移指南**：

旧方式（已废弃）：
```bash
clawkit setup --mode all-in-one --output config.yaml
```

新方式（推荐）：
```bash
# 1. 生成简化配置
clawkit init

# 2. 编辑 clawkit.yaml 添加项目
# projects:
#   - key: my-project
#     repoPath: /path/to/repo

# 3. 一键启动
clawkit start
```

或使用快速启动脚本：
```bash
pnpm quickstart
```

**相关文档**：
- 当前推荐：`docs/simplified-quick-start.md`
- 历史资料：`docs/archive/setup-wizard.md`

## 4. 使用建议

1. 想快速上手：优先看"当前推荐阅读"。
2. 想理解历史演进：再看"历史资料"。
3. 想排查某个旧问题：优先在历史资料里按关键词搜索。
4. 遇到已废弃功能：查看"已废弃功能说明"中的迁移指南。

## 5. 说明

这些历史文档目前**不删除**，原因是：

- 仍有回溯价值
- 有助于理解设计演进
- 某些问题排查需要参考旧记录

但它们不应再作为默认上手入口。
