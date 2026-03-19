# 部署示例

## 1. 单机模式（最小可用）

### manifest

可直接参考：

```text
examples/all-in-one.yaml
```

### apply

```bash
clawkit apply -f ./examples/all-in-one.yaml
```

### 典型生成结果

```text
./.clawkit/local-dev/controller.env
./.clawkit/local-dev/worker-local-worker.env
./.clawkit/local-dev/systemd/clawkit-controller.service
./.clawkit/local-dev/systemd/clawkit-worker-local-worker.service
./.clawkit/local-dev/scripts/start-controller.sh
./.clawkit/local-dev/scripts/start-worker-local-worker.sh
~/.openclaw/openclaw.json
```

### 最小启动顺序

1. `opencode serve`
2. `bash start-controller.sh`
3. `bash start-worker-local-worker.sh`
4. 发送 webhook 创建任务

---

## 2. 混合模式（控制面在云端，执行面在本地）

### manifest

可直接参考：

```text
examples/hybrid.yaml
```

### apply

```bash
clawkit apply -f ./examples/hybrid.yaml
```

### 当前阶段建议部署方式

#### 云端节点

- 写入 controller env
- 写入 OpenClaw 配置
- 写入 controller systemd 文件
- 手工同步 clawkit 代码并手工安装 systemd

#### 本地节点

- 写入 worker env
- 写入 OpenCode launch 配置
- 启动本地 `opencode serve`
- 启动本地 worker

---

## 3. OpenClaw 侧配置示例

```json
{
  "name": "clawkit-local",
  "controller": {
    "endpoint": "http://127.0.0.1:8787/api/openclaw/webhook",
    "token": "replace-me"
  },
  "webhook": {
    "enabled": true,
    "source": "openclaw"
  }
}
```

---

## 4. Worker / OpenCode 启动示例

### OpenCode

```bash
opencode serve --hostname 127.0.0.1 --port 4096
```

### Worker

```bash
export CONTROLLER_URL=http://127.0.0.1:8787
export WORKER_ID=local-worker
export WORKER_SUPPORTED_PROJECTS=site-web
node ./packages/worker/dist/index.js
```

---

## 5. 端到端请求示例

### 创建任务

```json
{
  "source": "openclaw",
  "message": "#研发任务\n项目: site-web\n目标: 修复首页按钮样式\n约束: 全部中文\n验收: 修改完成并通过测试",
  "operator": {
    "id": "demo-user",
    "name": "演示用户"
  },
  "sessionKey": "demo-1"
}
```

### 返回草稿摘要

```json
{
  "success": true,
  "code": "controller.openclaw.webhook.draft_ready",
  "message": "研发任务已创建，已生成草稿摘要",
  "data": {
    "taskId": "site-web-xxx",
    "status": "waiting_approval",
    "userMessage": "研发任务已创建，已生成草稿摘要。..."
  }
}
```

### 查询完成结果

```json
{
  "success": true,
  "code": "controller.openclaw.webhook.status_result",
  "message": "任务状态查询成功",
  "data": {
    "taskId": "site-web-xxx",
    "status": "done",
    "userMessage": "任务执行完成。...",
    "latestSummary": "已完成首页按钮样式修复"
  }
}
```
