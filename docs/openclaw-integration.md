# OpenClaw 接入说明

## 1. 文档目标

本文档说明 OpenClaw 在当前 MVP 中如何调用 controller，以及 controller 如何返回可直接回复用户的中文结果。

## 2. 推荐入口

当前推荐入口：

```text
POST /api/openclaw/webhook
```

兼容旧入口：

```text
POST /api/tasks/from-openclaw
```

## 3. 请求约束

最小请求体：

```json
{
  "source": "openclaw",
  "message": "#研发任务\n项目: clawkit\n目标: 验收 MVP\n约束: 全部中文\n验收: 链路可运行",
  "operator": { "id": "user-001", "name": "张三" },
  "sessionKey": "session-001"
}
```

请求头：

```http
Authorization: Bearer <OPENCLAW_WEBHOOK_TOKEN>
```

## 4. 支持的动作

OpenClaw 当前通过消息协议触发以下动作：

- `#研发任务`
- `#确认派发 <taskId>`
- `#修改草案 <taskId>`
- `#取消任务 <taskId>`
- `#任务状态 <taskId>`

## 5. 返回结构

controller 会返回统一响应壳，`data` 中重点字段包括：

- `taskId`
- `projectKey`
- `status`
- `userMessage`
- `suggestedReplies`
- `latestSummary`
- `latestDraftSummary`
- `executionSummary`
- `metadata.phase`

其中 `userMessage` 是面向终端用户的中文文本，OpenClaw 可直接转发，不需要再自行拼接。

## 6. 草稿阶段示例

当任务刚创建或被修改后，返回会类似：

```json
{
  "success": true,
  "code": "controller.openclaw.webhook.draft_ready",
  "message": "研发任务已创建，已生成草稿摘要",
  "data": {
    "taskId": "clawkit-xxx",
    "status": "waiting_approval",
    "userMessage": "研发任务已创建，已生成草稿摘要。\n项目：clawkit\n任务：验收 MVP\n...",
    "suggestedReplies": [
      "#确认派发 clawkit-xxx",
      "#修改草案 clawkit-xxx",
      "#取消任务 clawkit-xxx",
      "#任务状态 clawkit-xxx"
    ]
  }
}
```

## 7. 确认后的语义

`#确认派发 <taskId>` 触发后：

1. controller 先确认草稿
2. 然后尝试派发到可用 worker
3. 若派发成功，状态可能进入 `dispatched` 或 `running`
4. 若没有可用 worker，则停留在 `approved`，并给出清晰中文提示

## 8. 状态查询语义

`#任务状态 <taskId>` 会根据当前阶段返回两类结果：

- 草稿态：返回草稿摘要与下一步建议
- 执行态 / 完成态：返回执行摘要、测试结果、风险与建议下一步

## 9. 当前边界

当前接入已经覆盖 MVP 主链路，但仍明确不做：

- OpenClaw 内部插件实现
- 复杂签名算法
- 回调重试机制
- 多轮复杂上下文编排
