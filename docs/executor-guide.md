# Codex CLI 与 Gemini CLI 配置指南

> ClawKit 支持的第三方 AI 执行器配置详解

## 目录

- [Codex CLI](#codex-cli)
- [Gemini CLI](#gemini-cli)
- [多执行器配置示例](#多执行器配置示例)
- [常见问题](#常见问题)

---

## Codex CLI

### 概述

OpenAI Codex 是 OpenAI 开发的 AI 代码助手，基于 GPT-4 模型，专门优化用于代码生成和解释。

### 安装

#### macOS / Linux

```bash
# 方法一：使用 curl 安装
curl -fsSL https://openai.github.io/codex/install.sh | sh

# 方法二：使用 pip 安装
pip install openai-codex

# 方法三：使用 npm 安装（如果有 Node.js）
npm install -g @openai/codex
```

#### Windows

```powershell
# 使用 PowerShell 安装
irm https://openai.github.io/codex/install.ps1 | iex
```

### 配置 API Key

```bash
# 设置 OpenAI API Key
export OPENAI_API_KEY=sk-your-api-key-here

# 或使用环境变量文件
echo "OPENAI_API_KEY=sk-your-api-key-here" > .env
```

### 基本使用

```bash
# 启动交互式会话
codex

# 执行单个命令
codex "解释这段代码的作用"

# 指定项目目录
codex --project /path/to/project "审查代码质量"
```

### ClawKit 配置

在 `clawkit.yaml` 中配置 Codex：

```yaml
version: "2.0"

executors:
  codex-primary:
    type: codex
    node: local
    binaryPath: /usr/local/bin/codex  # 替换为实际路径
    workspace: /path/to/project
    env:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    mode: interactive
    fallbackToPlaceholder: false

workers:
  - node: local
    maxConcurrency: 2
    tags: [codex]

projects:
  - key: my-project
    path: /path/to/project
    executors:
      - codex-primary
```

### 配置参数说明

| 参数 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `type` | string | 执行器类型 | `codex` |
| `node` | string | 执行节点 | `local` |
| `binaryPath` | string | Codex CLI 路径 | `/usr/local/bin/codex` |
| `workspace` | string | 工作目录 | `/path/to/project` |
| `env.OPENAI_API_KEY` | string | API Key 环境变量 | `${OPENAI_API_KEY}` |
| `mode` | string | 运行模式 | `interactive` / `batch` |
| `maxConcurrency` | number | 最大并发数 | `2` |

---

## Gemini CLI

### 概述

Google Gemini CLI 是 Google 开发的 AI 编程助手，基于 Gemini 模型，支持代码生成、解释、调试等多种功能。

### 安装

#### 通过 pip 安装

```bash
# 安装 Gemini API Python 库
pip install google-generativeai

# 安装 Gemini CLI（如果有独立 CLI）
pip install google-gemini-cli
```

#### 通过 npm 安装

```bash
npm install -g @google/gemini-cli
```

#### 使用 Google AI Studio

如果你使用 Google AI Studio 的 API：

1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 创建 API Key
3. 配置环境变量

### 配置 API Key

```bash
# 设置 Google AI API Key
export GOOGLE_API_KEY=your-google-api-key-here

# 或使用 gemini 配置命令
gemini config set api_key your-api-key
```

### 基本使用

```bash
# 启动交互式会话
gemini

# 执行代码解释
gemini explain "path/to/file.py"

# 代码审查
gemini review "path/to/file.py"

# 生成测试
gemini test "path/to/file.py"
```

### ClawKit 配置

在 `clawkit.yaml` 中配置 Gemini：

```yaml
version: "2.0"

executors:
  gemini-primary:
    type: gemini
    node: local
    binaryPath: /usr/local/bin/gemini  # 替换为实际路径
    workspace: /path/to/project
    env:
      GOOGLE_API_KEY: ${GOOGLE_API_KEY}
    mode: interactive
    fallbackToPlaceholder: false

workers:
  - node: local
    maxConcurrency: 2
    tags: [gemini]

projects:
  - key: my-project
    path: /path/to/project
    executors:
      - gemini-primary
```

### 配置参数说明

| 参数 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `type` | string | 执行器类型 | `gemini` |
| `node` | string | 执行节点 | `local` |
| `binaryPath` | string | Gemini CLI 路径 | `/usr/local/bin/gemini` |
| `workspace` | string | 工作目录 | `/path/to/project` |
| `env.GOOGLE_API_KEY` | string | API Key 环境变量 | `${GOOGLE_API_KEY}` |
| `mode` | string | 运行模式 | `interactive` / `batch` |

---

## 多执行器配置示例

### 同时使用 OpenCode、Codex 和 Gemini

```yaml
version: "2.0"
openClaw:
  url: http://127.0.0.1:18000
  webhookToken: your-token
controllerPort: 8787

executors:
  # OpenCode - Claude Code 服务
  opencode:
    type: opencode
    node: local
    port: 4096
    passwordEnv: OPENCODE_PASSWORD
    publicUrl: http://127.0.0.1:4096

  # Codex - OpenAI Codex
  codex:
    type: codex
    node: local
    binaryPath: /usr/local/bin/codex
    workspace: /workspace/codex-projects
    env:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    mode: interactive

  # Gemini - Google Gemini
  gemini:
    type: gemini
    node: local
    binaryPath: /usr/local/bin/gemini
    workspace: /workspace/gemini-projects
    env:
      GOOGLE_API_KEY: ${GOOGLE_API_KEY}
    mode: interactive

workers:
  - node: local
    maxConcurrency: 3
    executors: [opencode, codex, gemini]
    riskPolicy:
      allowedRiskLevels: [low, medium]
      blockedRiskLevels: [high, urgent, critical]

projects:
  - key: web-app
    path: /workspace/web-app
    baseBranch: main
    executors:
      - opencode  # 默认使用 OpenCode
      - codex     # 备用 Codex
      - gemini    # 备用 Gemini

  - key: data-pipeline
    path: /workspace/data-pipeline
    baseBranch: develop
    executors:
      - gemini    # 偏好 Gemini

  - key: ml-models
    path: /workspace/ml-models
    baseBranch: main
    executors:
      - codex     # 偏好 Codex
```

### 环境变量配置

创建 `.env` 文件（不要提交到 Git）：

```bash
# OpenCode
OPENCODE_PASSWORD=your-opencode-password

# OpenAI Codex
OPENAI_API_KEY=sk-your-openai-key

# Google Gemini
GOOGLE_API_KEY=your-google-api-key

# Controller
CONTROLLER_PORT=8787
CLAWKIT_MANIFEST_PATH=./clawkit.yaml
```

### 本地开发配置

对于本地开发环境，可以使用 Placeholder 执行器进行测试：

```yaml
version: "2.0"

executors:
  # 开发环境使用 Placeholder
  dev-placeholder:
    type: placeholder
    node: local
    fallbackToPlaceholder: true

workers:
  - node: local
    maxConcurrency: 1
    executors: [dev-placeholder]

projects:
  - key: my-app
    path: /path/to/app
    executors: [dev-placeholder]
```

---

## 常见问题

### Q1: Codex/Gemini API Key 如何获取？

**OpenAI Codex:**
1. 访问 [OpenAI Platform](https://platform.openai.com/)
2. 登录账号
3. 进入 API Keys 页面
4. 创建新的 API Key

**Google Gemini:**
1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 登录 Google 账号
3. 点击 "Create API Key"
4. 复制生成的 Key

### Q2: 执行器启动失败？

```bash
# 检查 CLI 是否正确安装
which codex    # Linux/macOS
where codex     # Windows

# 检查版本
codex --version
gemini --version

# 检查 API Key
echo $OPENAI_API_KEY
echo $GOOGLE_API_KEY
```

### Q3: 如何切换执行器？

在 `clawkit.yaml` 中为不同项目指定不同的执行器：

```yaml
projects:
  - key: project-a
    executors: [opencode]
  - key: project-b
    executors: [codex]
  - key: project-c
    executors: [gemini]
```

### Q4: 执行器并发限制？

```yaml
workers:
  - node: local
    maxConcurrency: 3  # 全局限流
    executors:
      - type: opencode
        maxConcurrency: 2  # 单执行器限流
      - type: codex
        maxConcurrency: 1
```

### Q5: 如何查看执行器日志？

```bash
# 查看 Controller 日志
tail -f /tmp/controller.log

# 查看 Worker 日志
tail -f /tmp/worker.log

# 实时监控所有日志
tail -f /tmp/*.log
```

---

## 资源链接

| 资源 | 链接 |
|------|------|
| OpenAI Codex 文档 | https://platform.openai.com/docs/codex |
| Google Gemini 文档 | https://ai.google.dev/docs/gemini_api_overview |
| ClawKit 插件市场 | 打开 Web 控制台 → 插件市场 |

---

*更新日期: 2026-07-14*
