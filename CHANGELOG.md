# 变更记录

本文档记录 clawkit 项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-08-28

正式版发布！经过 v0.x 系列的迭代，核心能力已稳定。

### 🎉 核心能力

- ✅ **一键部署**：自动部署 Claude Code（Docker）和 OpenCode（本地安装）
- ✅ **任务主链路**：webhook → 草稿 → 审批 → 派发 → 执行 → 结果回传
- ✅ **CLI 工具**：`init / doctor / plan / apply / heal / onboard / verify`
- ✅ **Web Console**：总览、配置、部署、修复、状态、任务中心
- ✅ **插件系统**：ExecutorPlugin / TriggerPlugin / NotifierPlugin
- ✅ **流水线编排**：DAG 执行引擎，支持拓扑排序与并行执行
- ✅ **三种部署拓扑**：all-in-one / hybrid / split

### 🛠️ 改进

- 优化 Worker 配置防护，支持 optional executors
- 修复烟雾测试脚本 bash 语法问题（`((VAR++))` 在 `set -e` 下提前退出）
- 更新 README 为 v1.0.0 正式版格式
- Controller 版本标识更新为 v1.0.0

### 🔧 修复

- 修复 Worker 在 executors 未配置时崩溃的问题
- 修复 smoke-test.sh 脚本计数器在 `set -euo pipefail` 下提前退出

### 📝 文档

- 更新 README.md 版本标题和功能列表
- 补充 v1.0.0 发布说明
- 完善核心链路描述

---

## [0.2.0] - 2026-07-11

### 🎉 新增功能

#### 插件系统（@clawkit/plugin-core）

- **执行器插件接口**（ExecutorPlugin）：支持自定义任务执行逻辑
- **触发器插件接口**（TriggerPlugin）：支持自定义触发条件
  - 手动触发、定时触发（基于 cron 表达式）、事件触发、Webhook 触发
- **通知器插件接口**（NotifierPlugin）：支持任务状态变更通知
  - 支持的通知类型：`task_created`、`task_completed`、`task_failed`、`task_cancelled`、`system_alert`
  - 支持的优先级：`low`、`normal`、`high`、`urgent`
- **插件生命周期管理**：安装、启用、禁用、卸载
- **插件沙箱隔离配置**：安全执行第三方插件

#### 插件市场（@clawkit/market）

- **插件市场服务**（MarketService）：集中管理插件市场功能
- **插件安装/卸载/更新服务**：完整的插件生命周期管理
- **插件搜索与浏览 API**：支持按类型、名称、标签搜索
- **插件详情 API**：获取插件完整信息
- **插件注册表管理**：本地已安装插件的管理

#### 流水线编排（@clawkit/pipeline）

- **DAG 执行引擎**：基于有向无环图的任务编排
  - 拓扑排序（Kahn 算法）、并行执行支持、条件执行、重试机制和超时控制、事件驱动架构
- **流水线数据模型**：Pipeline、PipelineStage 定义与验证、循环依赖检测
- **流水线服务**：CRUD 操作、执行控制（启动/暂停/恢复/取消）、执行历史和统计信息
- **REST API**：完整的流水线管理接口（创建/更新/删除/执行/暂停/恢复/取消）

### 🛠️ 改进

- 更新文档结构，添加 v0.2.0 功能说明
- 完善 README.md 功能描述
- 补充 pipeline 包单元测试（13 个测试用例）
- 优化 .gitignore 配置

### 🔧 修复

- 修复 market 包中的 `handleError` 函数重复定义
- 修复 `plugin-registry.service.ts` 中 `updateConfig` 方法签名

---

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
