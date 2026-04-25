# 变更记录

本文档记录 clawkit 项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增
- 新增 CI 流水线（`.github/workflows/ci.yml`），自动验证构建、测试与示例配置
- 新增严格模式 E2E 验证脚本（`scripts/e2e-local-strict.sh`），验证真实 OpenCode 执行能力
- 补充双机模式（Split）联调文档（`docs/e2e.md` 第 5 节）

### 变更
- 更新 `AGENTS.md`，明确项目已进入 MVP 主链路阶段，不再停留在初始化阶段
- 更新 `CHANGELOG.md`，采用标准 Keep a Changelog 格式

### 修复
- 修正项目阶段文档与代码现状的口径冲突
- 清理 `examples/.clawkit/local-dev/` 下的 160 个历史备份文件
- 在 `.gitignore` 中补充 `*.bak` 规则

## [0.1.0] - 2026-03-11

首个可发布 MVP 版本，包含完整的任务接入、草稿审批、派发执行、结果回传链路。

### 新增

#### 核心功能

- **CLI 工具**：`init / doctor / plan / apply / heal` 五个主命令
- **Controller 服务**：
  - OpenClaw webhook 接入与任务协议解析
  - TaskDraft / TaskMemory / PromptDraft 草稿与审批流
  - HTTP API 与 SQLite 持久化
  - 任务派发与 worker 选择
- **Worker 服务**：
  - 注册、心跳、拉取任务、结果回传
  - OpenCodeExecutor 真实执行路径
  - PlaceholderExecutor 回退路径
- **Web Console**：
  - 总览、配置、部署、修复、状态、任务中心
  - Setup 向导（预设选择 + YAML 编辑 + 编排执行）

#### 配置与示例
- Manifest schema 与三种拓扑示例（all-in-one / hybrid / split）
- 本地 E2E 联调脚本（`scripts/e2e-local-demo.js`）
- 一键部署脚本（`scripts/quick-start.sh`）
- 烟雾测试脚本（`scripts/smoke-test.sh`）

#### 文档
- 完整的中文文档体系（`docs/`）
- 项目范围说明（`docs/project-scope.md`）
- E2E 联调说明（`docs/e2e.md`）
- CLI 使用文档（`docs/cli.md`）
- Manifest 配置文档（`docs/manifest.md`）
- Web Console 使用文档（`docs/web-console.md`）
- Controller API 文档（`docs/controller-api.md`）
- Worker 设计文档（`docs/worker.md`）

### 已知限制
- E2E demo 默认允许 placeholder fallback，仅用于链路验证
- 不包含复杂 Web 管理后台能力
- 不支持自动 PR 或自动部署生产业务代码
- Controller 侧不包含真实大模型生成 Prompt
- 缺少 CI 自动化流水线（已在 Unreleased 中补充）

---

## 版本说明

### [0.1.0] - MVP 主链路版本
这是第一个可用的 MVP 版本，包含完整的任务接入、草稿审批、派发执行、结果回传链路。

**主要能力**：
- ✅ OpenClaw webhook 接入
- ✅ Controller / Worker 任务派发链路
- ✅ Web Console 轻量控制台
- ✅ 三种拓扑示例配置
- ✅ 本地 E2E 联调能力

**明确不做**（不是缺陷）：
- ❌ 复杂 Web 管理后台
- ❌ 自动 PR 或生产代码部署
- ❌ 复杂远程环境编排
- ❌ Controller 侧真实大模型推理
