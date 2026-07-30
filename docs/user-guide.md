# ClawKit 使用指南

> AI 代码助手的任务编排与自动化工作台

## 📋 目录

- [项目概述](#项目概述)
- [系统架构](#系统架构)
- [快速开始](#快速开始)
- [使用流程](#使用流程)
- [使用场景](#使用场景)
- [AI 执行器集成](#ai-执行器集成)
- [插件系统](#插件系统)
- [流水线编排](#流水线编排)
- [价值评估](#价值评估)
- [常见问题](#常见问题)

---

## 项目概述

### ClawKit 是什么？

ClawKit 是一个轻量级的 **AI 代码助手任务编排系统**，用于串联多种 AI 编程工具（Claude Code、OpenAI Codex、Google Gemini CLI 等），提供统一的任务派发、草稿审批、执行监控和结果管理能力。

### 核心特性

| 特性 | 说明 |
|------|------|
| 🤖 多执行器支持 | 支持 OpenCode、Claude Code、Codex CLI、Gemini CLI 等 |
| 📋 任务审批流 | 任务草稿 → 审批 → 执行 → 结果回传 |
| 🔌 插件市场 | 丰富的执行器、触发器、通知器插件 |
| ⚡ 流水线编排 | DAG 可视化编排，自动拓扑排序执行 |
| 📊 Web 控制台 | 轻量级 Web UI，实时监控任务状态 |
| 🔧 一键部署 | 自动部署所有组件，开箱即用 |

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         ClawKit 架构                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐    ┌──────────────┐    ┌──────────────────┐     │
│   │ Claude Code │───▶│  Controller  │───▶│     Worker        │     │
│   │ (触发源)  │    │  (调度中枢)   │    │  (任务执行器)     │     │
│   └──────────┘    └──────────────┘    └──────────────────┘     │
│                          │                      │               │
│                          ▼                      ▼               │
│                   ┌──────────────┐    ┌──────────────────┐     │
│                   │  Web Console │    │   AI 执行器       │     │
│                   │  (控制台)    │    │ OpenCode/Codex  │     │
│                   └──────────────┘    │ /Gemini/Claude   │     │
│                                         └──────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 组件说明

| 组件 | 说明 |
|------|------|
| **Controller** | 控制器核心，处理 webhook 接入、任务调度、审批流 |
| **Worker** | 执行节点，拉取任务并调用 AI 执行器 |
| **Web Console** | Web 控制台，监控和管理任务 |
| **OpenCode** | Anthropic Claude Code 服务 |
| **Codex CLI** | OpenAI Codex CLI |
| **Gemini CLI** | Google Gemini CLI |

---

## 快速开始

### 1. 一键启动（推荐）

```bash
cd /path/to/clawkit
./scripts/start-all.sh
```

这会自动：
- ✅ 清理旧进程
- ✅ 重新构建
- ✅ 启动 Controller (端口 8787)
- ✅ 启动 Desktop 客户端

### 2. 手动启动

```bash
# 启动 Controller
cd packages/controller
pnpm start

# 启动 Desktop 客户端（在新终端）
cd packages/desktop
pnpm start
```

### 3. 访问控制台

- **Desktop 客户端**: 自动打开桌面应用
- **Web 浏览器**: http://localhost:8787

---

## 使用流程

### 完整任务执行流程

```
1️⃣ 创建任务
   │
   ▼
2️⃣ Claude Code webhook 触发任务
   │
   ▼
3️⃣ Controller 接收并创建 TaskDraft
   │
   ▼
4️⃣ 草稿审批（Web Console）
   │
   ▼
5️⃣ 任务派发到 Worker
   │
   ▼
6️⃣ Worker 调用 AI 执行器
   │
   ▼
7️⃣ 执行结果回传
   │
   ▼
8️⃣ 查看执行结果
```

### 详细步骤

#### 步骤 1：配置 manifest

编辑 `clawkit.yaml`：

```yaml
version: "2.0"
openClaw:
  url: http://127.0.0.1:18000
  webhookToken: "your-token"
controllerPort: 8787

executors:
  my-opencode:
    type: opencode
    node: local
    port: 4096
  my-codex:
    type: codex
    node: local
    binaryPath: /usr/local/bin/codex
  my-gemini:
    type: gemini
    node: local
    binaryPath: /usr/local/bin/gemini

projects:
  - key: my-project
    path: /path/to/project
    baseBranch: master
    executors:
      - my-opencode
```

#### 步骤 2：部署服务

```bash
# 一键部署
pnpm quickstart

# 或分步执行
clawkit apply -f examples/simple.yaml --deploy
```

#### 步骤 3：提交任务

```bash
# 通过 Claude Code 提交任务
curl -X POST http://127.0.0.1:18000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"intent": "重构用户认证模块"}'
```

#### 步骤 4：审批草稿

1. 打开 Web 控制台
2. 进入「任务中心」
3. 查看待审批任务
4. 点击「确认」或「修改」

#### 步骤 5：监控执行

- 实时日志查看
- 执行进度追踪
- 状态变更通知

---

## 使用场景

### 场景 1：代码审查自动化

**需求**：PR 提交后自动触发 AI 代码审查

**配置**：
```yaml
# 配置 GitHub webhook 触发器
triggers:
  github-pr:
    type: github
    events: [pull_request]

# 配置代码审查执行器
executors:
  review-agent:
    type: opencode
    workspace: /tmp/review

# 配置通知器
notifiers:
  slack-alert:
    type: slack
    webhookUrl: https://hooks.slack.com/...
```

**效果**：PR 提交 → 自动审查 → 结果通知

---

### 场景 2：多语言项目文档生成

**需求**：为不同语言的代码库生成文档

**配置**：
```yaml
executors:
  chinese-doc:
    type: codex
    env:
      CODEX_LANGUAGE: zh-CN
  english-doc:
    type: gemini
    env:
      GEMINI_LANGUAGE: en-US

pipelines:
  doc-generation:
    stages:
      - name: generate-chinese
        executor: chinese-doc
        command: "生成中文文档"
      - name: generate-english
        executor: english-doc
        command: "生成英文文档"
```

---

### 场景 3：自动化测试流水线

**需求**：代码变更后自动运行测试并报告

**配置**：
```yaml
pipelines:
  ci-pipeline:
    stages:
      - name: lint
        type: executor
        config:
          command: npm run lint
      - name: test
        type: executor
        config:
          command: npm run test
      - name: build
        type: executor
        config:
          command: npm run build
      - name: notify
        type: notifier
        config:
          channels: [slack, dingtalk]
```

---

### 场景 4：智能代码补全助手

**需求**：IDE 中集成 AI 代码补全

**集成方式**：
```yaml
executors:
  ide-assistant:
    type: opencode
    mode: completions
    workspace: /path/to/project

workers:
  - node: local
    maxConcurrency: 3
    capabilities: [completions]
```

---

## AI 执行器集成

### 支持的执行器类型

| 执行器 | 类型 | 说明 | 安装方式 |
|--------|------|------|----------|
| **OpenCode** | Claude Code | Anthropic Claude Code 服务 | 自动安装 / Docker |
| **Claude Code CLI** | CLI | Claude Code 命令行工具 | npm install -g @anthropic/claude-code |
| **Codex CLI** | CLI | OpenAI Codex CLI | 官方安装脚本 |
| **Gemini CLI** | CLI | Google Gemini CLI | pip install google-generativeai |
| **Placeholder** | 测试 | 仅用于本地开发测试 | 内置 |

### 1. OpenCode 集成

```bash
# 方式一：使用 Docker（推荐）
docker run -d -p 4096:4096 \
  -e OPENCODE_PASSWORD=your-password \
  opencode:latest

# 方式二：npm 安装
npm install -g opencode
opencode serve --port 4096
```

**配置**：
```yaml
executors:
  opencode:
    type: opencode
    node: local
    port: 4096
    publicUrl: http://your-server:4096
    passwordEnv: OPENCODE_PASSWORD
```

### 2. Claude Code CLI 集成

```bash
# 安装
npm install -g @anthropic/claude-code

# 配置
export ANTHROPIC_API_KEY=your-api-key
```

**配置**：
```yaml
executors:
  claude:
    type: claude-code
    node: local
    binaryPath: /usr/local/bin/claude
    env:
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
```

### 3. Codex CLI 集成

```bash
# 安装 OpenAI Codex CLI
# 访问 https://platform.openai.com/docs/codex 获取访问权限

# 配置 API Key
export OPENAI_API_KEY=your-api-key
```

**配置**：
```yaml
executors:
  codex:
    type: codex
    node: local
    binaryPath: /usr/local/bin/codex
    env:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    workspace: /path/to/code
```

### 4. Gemini CLI 集成

```bash
# 安装 Gemini CLI
pip install google-generativeai

# 或使用官方 CLI
# 参考 https://ai.google.dev/docs/gemini_api_overview
```

**配置**：
```yaml
executors:
  gemini:
    type: gemini
    node: local
    binaryPath: /usr/local/bin/gemini
    env:
      GOOGLE_API_KEY: ${GOOGLE_API_KEY}
    mode: interactive
```

### 5. 多执行器组合使用

```yaml
executors:
  primary:
    type: opencode
    node: local
    port: 4096
  secondary:
    type: codex
    node: local
    binaryPath: /usr/local/bin/codex
  tertiary:
    type: gemini
    node: local
    binaryPath: /usr/local/bin/gemini

workers:
  - node: local
    executors: [primary, secondary, tertiary]
    maxConcurrency: 3

projects:
  - key: my-app
    executors: [primary, secondary]
```

---

## 插件系统

### 插件类型

| 类型 | 图标 | 说明 | 示例 |
|------|------|------|------|
| **执行器** | ⚡ | 执行具体任务 | 代码审查、单元测试生成 |
| **触发器** | 🎯 | 触发流水线执行 | Webhook、定时器、Git 事件 |
| **通知器** | 🔔 | 发送状态通知 | 钉钉、飞书、邮件、Slack |

### 可用插件

#### 执行器插件

| 插件 | 说明 |
|------|------|
| simple-executor | 简单命令执行器 |
| code-review | 代码审查 |
| git-commit | 智能 Git 提交 |
| unit-test-generator | 单元测试生成 |
| doc-generator | 文档生成 |
| docker-deploy | Docker 部署 |

#### 触发器插件

| 插件 | 说明 |
|------|------|
| webhook-trigger | HTTP Webhook |
| schedule-trigger | Cron 定时触发 |
| git-trigger | Git 事件触发 |
| file-watch-trigger | 文件监控触发 |

#### 通知器插件

| 插件 | 说明 |
|------|------|
| dingtalk-notifier | 钉钉通知 |
| feishu-notifier | 飞书通知 |
| email-notifier | 邮件通知 |
| slack-notifier | Slack 通知 |
| wecom-notifier | 企业微信通知 |

### 安装插件

1. 打开 Web 控制台 → 「插件市场」
2. 浏览可用插件
3. 点击「安装」按钮
4. 配置插件参数

---

## 流水线编排

### 创建流水线

1. 进入「流水线」页面
2. 点击「创建流水线」
3. 填写名称和描述
4. 添加执行节点
5. 设置节点依赖关系
6. 保存并执行

### 流水线示例

```yaml
pipeline:
  name: 代码发布流水线
  stages:
    - name: 代码检查
      type: executor
      config:
        command: npm run lint
      dependsOn: []

    - name: 运行测试
      type: executor
      config:
        command: npm run test
      dependsOn: [代码检查]

    - name: 构建镜像
      type: executor
      config:
        command: docker build -t myapp:latest .
      dependsOn: [运行测试]

    - name: 部署通知
      type: notifier
      config:
        channel: dingtalk
      dependsOn: [构建镜像]
```

---

## 价值评估

### 🎯 核心价值

| 价值点 | 说明 |
|--------|------|
| **效率提升** | 自动化审批流程，减少人工干预 |
| **质量保证** | 标准化执行流程，统一的代码审查 |
| **可追溯性** | 完整的任务执行日志和结果存档 |
| **灵活性** | 支持多种 AI 执行器，按需选择 |
| **可扩展性** | 插件系统支持自定义功能 |

### 📊 量化收益

| 指标 | 预期改善 |
|------|----------|
| 任务响应时间 | 减少 60% |
| 代码审查覆盖率 | 从 20% → 100% |
| 文档更新及时性 | 从周级 → 实时 |
| 部署错误率 | 减少 80% |

### 🏆 适用团队

| 团队规模 | 推荐场景 |
|----------|----------|
| 小团队 (1-5人) | 快速上手，本地开发辅助 |
| 中型团队 (5-20人) | 代码审查自动化，CI/CD 集成 |
| 大型团队 (20+人) | 多项目统一管理，跨团队协作 |

---

## 常见问题

### Q1: Controller 启动失败？

```bash
# 检查端口占用
lsof -i :8787

# 清理并重新启动
./scripts/start-all.sh
```

### Q2: AI 执行器连接失败？

```bash
# 检查 OpenCode 状态
curl http://127.0.0.1:4096/health

# 检查环境变量
echo $OPENCODE_PASSWORD
```

### Q3: 任务卡在待执行状态？

1. 检查 Worker 是否在线
2. 检查执行器是否可用
3. 查看 Controller 日志

### Q4: 如何添加新的 AI 执行器？

1. 在 `clawkit.yaml` 中添加执行器配置
2. 重启 Controller
3. 在 Web 控制台验证

---

## 附录

### 相关资源

- 📖 [架构文档](./architecture.md)
- 📖 [部署指南](./one-click-deployment.md)
- 📖 [API 文档](./controller-api.md)
- 📖 [CLI 命令](./cli.md)

### 版本信息

- 当前版本: v0.2.0
- 更新日期: 2026-07-14

---

*Made with ❤️ by ClawKit Team*
