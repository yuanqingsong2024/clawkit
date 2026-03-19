# ClawKit Manifest 文档

## 1. 文档目标

manifest 是 clawkit 的统一输入模型，CLI、controller、worker 与部署文件生成都围绕它展开。

## 2. 顶层结构

```yaml
profile:
nodes:
services:
workers:
runtime:
notify:
deploy:
```

## 3. 核心字段

### 3.1 profile

```yaml
profile:
  name: "local-studio"
  version: "1.0.0"
  topology: "all-in-one"
  description: "单机开发与联调示例"
```

### 3.2 nodes

支持两类节点：

- `local`
- `ssh`

`ssh` 节点至少需要 `keyPath` 或 `password` 之一。

### 3.3 services

```yaml
services:
  controller:
    node: "local-dev"
    port: 8787
    apiPrefix: "/api"
  openClaw:
    node: "local-dev"
    publicUrl: "http://127.0.0.1:8787"
    apiKey: "replace-me"
```

### 3.4 workers

每个 worker 至少包含：

- `id`
- `node`
- `connectMode`
- `projects`

每个项目至少包含：

- `key`
- `repoPath`
- `baseBranch`
- `openCode.port`
- `openCode.agent`

### 3.5 runtime

当前首版推荐：

```yaml
runtime:
  promptEngine:
    mode: "template"
  memory:
    enabled: true
    provider: "local"
    path: "./data/memory"
```

说明：

- `promptEngine.mode` 当前可取 `template | llm | hybrid`
- 首个 MVP 推荐使用 `template`
- examples 与 `init` 默认也使用 `template`

### 3.6 notify

`notify` 为可选项；启用后至少需要一个渠道。

### 3.7 deploy

`deploy` 用于表达部署超时、重试和健康检查间隔等策略。

## 4. 拓扑约束

### all-in-one

- controller、OpenClaw、全部 worker 必须在同一个节点

### hybrid

- controller 与 OpenClaw 必须在同一个 SSH 节点
- worker 必须位于本地节点

### split

- controller 与 OpenClaw 必须在同一个控制面节点
- 至少一个 worker 位于独立执行节点

## 5. 当前实现关系

manifest 当前会被这些能力直接消费：

- `init` 生成
- `doctor` 校验
- `plan` 预览
- `apply` 生成部署文件
- `heal` 识别修复问题
- controller / worker 运行时加载

## 6. 当前边界

manifest 负责描述“声明式配置”，但不直接等于最终系统文件。

例如：

- `controller.env`、`worker.env` 由 `apply` 生成
- systemd 文件由 `apply` 生成
- OpenClaw 配置由 `apply` 生成

## 7. 结论

当前 manifest 已经不是单纯的“模型设计产物”，而是首个 MVP 的真实运行输入。
