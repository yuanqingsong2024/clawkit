# OpenClaw webhook 接入说明

## 1. 本阶段目标

本阶段的目标不是做复杂插件系统，而是把 **OpenClaw -> controller -> worker -> OpenCodeExecutor** 串成最小可运行链路。

当前阶段结论：

- **以 webhook 为主入口**
- **hook 只负责在 OpenClaw 内部触发 webhook 调用**
- controller 负责 token 鉴权、协议识别、草稿摘要回传、确认后自动派发、结果摘要回传

---

## 2. hook 与 webhook 的角色

### 2.1 hook

hook 是 OpenClaw 内部的触发点。

当前阶段推荐做法：

1. 用户在 OpenClaw 中输入消息
2. OpenClaw 的 hook 捕获该消息
3. hook 将原始文本转发给 clawkit controller 的 webhook

hook 本阶段只做触发说明，不在 clawkit 内实现复杂 hook 插件。

### 2.2 webhook

webhook 是 OpenClaw 调用 clawkit controller 的 HTTP 入口。

当前主入口：

```text
POST /api/openclaw/webhook
```

兼容旧入口：

```text
POST /api/tasks/from-openclaw
```

但当前阶段建议 OpenClaw 直接接入 `/api/openclaw/webhook`。

---

## 3. 最小请求结构

当前阶段推荐 OpenClaw 发给 controller 的最小请求结构如下：

```json
{
  "requestId": "oc-req-001",
  "source": "openclaw",
  "message": "#研发任务\n项目: clawkit\n目标: 接入 webhook\n约束: 全部中文\n验收: 可返回草稿摘要",
  "operator": {
    "id": "user-001",
    "name": "张三"
  },
  "metadata": {
    "channel": "chat"
  },
  "sessionKey": "openclaw-session-001"
}
```

字段说明：

| 字段 | 必填 | 说明 |
|---|---|---|
| `requestId` | 否 | 建议传，用于链路追踪；不传时 controller 会自动生成 |
| `source` | 是 | 固定为 `openclaw` |
| `message` | 是 | 原始用户消息，controller 会直接按协议文本识别 |
| `operator` | 是 | 操作者信息，至少要有 `id` |
| `metadata` | 否 | 透传附加上下文，当前阶段不做复杂解析 |
| `sessionKey` | 否 | 会话标识，建议传，便于串联同一轮任务 |

### 3.1 message 支持的最小协议

#### 创建研发任务

```text
#研发任务
项目: clawkit
目标: 接入 webhook
约束: 全部中文
验收: 可返回草稿摘要
```

#### 确认派发

```text
#确认派发 <taskId>
```

#### 修改草案

```text
#修改草案 <taskId>
修改: 请补充失败场景说明
```

#### 取消任务

```text
#取消任务 <taskId>
```

#### 查询状态

```text
#任务状态 <taskId>
```

---

## 4. 最小响应结构

controller 返回给 OpenClaw 的最小结构如下：

```json
{
  "success": true,
  "code": "controller.openclaw.webhook.draft_ready",
  "message": "研发任务已创建，已生成草稿摘要",
  "data": {
    "taskId": "clawkit-xxx",
    "projectKey": "clawkit",
    "status": "waiting_approval",
    "userMessage": "研发任务已创建，已生成草稿摘要。...",
    "suggestedReplies": [
      "#确认派发 clawkit-xxx",
      "#修改草案 clawkit-xxx",
      "#取消任务 clawkit-xxx",
      "#任务状态 clawkit-xxx"
    ],
    "latestSummary": "目标：...｜范围：...｜约束：...｜验收：..."
  }
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `taskId` | 当前任务 ID |
| `projectKey` | 项目标识 |
| `status` | 当前任务状态 |
| `userMessage` | 直接适合回给用户的中文消息 |
| `suggestedReplies` | 建议回复，适合渲染成快捷按钮 |
| `latestSummary` | 当前最新摘要，适合程序消费或列表展示 |

---

## 5. 用户可读输出设计

### 5.1 研发任务已创建，返回草稿摘要

```text
研发任务已创建，已生成草稿摘要。
项目：clawkit
任务：接入 webhook
目标：接入 webhook
范围：controller webhook；草稿回传
约束：全部中文
验收：可返回草稿摘要
确认清单：确认任务目标；确认范围
```

### 5.2 草稿已修改，返回新草稿摘要

```text
草稿已修改，以下是新的草稿摘要。
项目：clawkit
任务：接入 webhook
目标：接入 webhook
范围：controller webhook；失败场景说明
约束：全部中文
验收：可返回草稿摘要
```

### 5.3 草稿已确认，返回“已确认，开始执行”

```text
草稿已确认，开始执行。任务已派发给 worker。
派发：worker-1 / dispatched
摘要：项目 clawkit 当前状态为 dispatched
```

若当前没有可用 worker：

```text
草稿已确认，但暂时无法开始执行：controller.no_available_worker：没有可用的 worker 处理项目 clawkit
```

### 5.4 执行完成，返回结果摘要

```text
任务执行完成。
派发：worker-1 / accepted
执行节点：Worker 1（idle）
摘要：已完成 OpenClaw webhook 真接入
测试：控制器测试通过
```

### 5.5 执行失败，返回失败摘要与建议下一步

```text
任务执行失败。
摘要：OpenCode server 不可达
测试：未执行
建议下一步：请先启动 opencode serve，再重新发起任务
```

---

## 6. webhook token 鉴权

当前阶段强制要求 webhook token。

controller 从以下环境变量读取 token：

```bash
OPENCLAW_WEBHOOK_TOKEN=your-token
```

OpenClaw 发请求时需要带：

```http
Authorization: Bearer your-token
```

### 当前阶段建议的最小安全配置

1. 单机模式也保留 token，不因为本机联调而跳过
2. 混合模式必须通过 HTTPS 暴露 controller/OpenClaw 公网入口
3. token 不要写死在 shell 历史中，优先写入 env 文件或安全存储
4. 当前阶段不做复杂签名算法，先用 Bearer token 即可

---

## 7. openclaw.json 最小示例

文件位置：

```text
~/.openclaw/openclaw.json
```

最小示例：

```json
{
  "name": "clawkit-local",
  "topology": "all-in-one",
  "controller": {
    "endpoint": "http://127.0.0.1:8787/api/openclaw/webhook",
    "token": "replace-me"
  },
  "runtime": {
    "promptEngine": {
      "mode": "template"
    },
    "memory": {
      "enabled": true,
      "provider": "local",
      "path": "./data/memory"
    }
  },
  "webhook": {
    "enabled": true,
    "source": "openclaw"
  }
}
```

---

## 8. curl 联调示例

### 8.1 创建任务

```bash
curl -X POST http://127.0.0.1:8787/api/openclaw/webhook \
  -H "Authorization: Bearer replace-me" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "openclaw",
    "message": "#研发任务\n项目: clawkit\n目标: 打通 webhook\n约束: 全部中文\n验收: 返回草稿摘要",
    "operator": {"id": "user-1", "name": "张三"},
    "sessionKey": "demo-1"
  }'
```

### 8.2 确认派发

```bash
curl -X POST http://127.0.0.1:8787/api/openclaw/webhook \
  -H "Authorization: Bearer replace-me" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "openclaw",
    "message": "#确认派发 <taskId>",
    "operator": {"id": "user-1", "name": "张三"},
    "sessionKey": "demo-1"
  }'
```

### 8.3 查询状态

```bash
curl -X POST http://127.0.0.1:8787/api/openclaw/webhook \
  -H "Authorization: Bearer replace-me" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "openclaw",
    "message": "#任务状态 <taskId>",
    "operator": {"id": "user-1", "name": "张三"},
    "sessionKey": "demo-1"
  }'
```
