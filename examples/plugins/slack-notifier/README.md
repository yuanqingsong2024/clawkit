# Slack 通知器插件

Slack Webhook 通知器插件，支持发送精美的 Block Kit UI 消息。

## 功能特性

- ✅ 支持 Block Kit UI 组件
- ✅ 支持交互式消息（按钮等）
- ✅ 支持 emoji 表情
- ✅ 自定义机器名称和图标
- ✅ 支持多种通知类型

## 安装

```bash
# 复制到插件目录
cp -r examples/plugins/slack-notifier plugins/notifier/
```

## 配置

在 `manifest.yaml` 中配置插件：

```yaml
plugins:
  notifiers:
    - name: slack-notifier
      enabled: true
      config:
        webhookUrl: "https://hooks.slack.com/services/xxxxx/xxxxx/xxxxx"
        channel: "#clawkit"  # 可选，覆盖 Webhook 的默认频道
        botName: "ClawKit"
        botIcon: ":robot_face:"  # emoji 格式
```

## 获取 Webhook URL

1. 在 Slack 工作空间创建 App
2. 进入 App 设置 → Incoming Webhooks
3. 启用 Webhooks 并添加新 Webhook 到频道
4. 复制 Webhook URL

## 使用示例

### 基本使用

```javascript
const plugin = require('./slack-notifier');

// 初始化
plugin.initialize({
  webhookUrl: 'https://hooks.slack.com/services/xxxxx/xxxxx/xxxxx',
  botName: 'ClawKit Bot',
  botIcon: ':robot_face:',
});

// 发送通知
const result = await plugin.send({
  id: 'task-001',
  type: 'task_completed',
  priority: 'normal',
  content: {
    title: '任务完成通知',
    body: '任务「优化数据库查询」已成功完成\n\n执行时间: 2分30秒',
  },
  target: { type: 'webhook', id: 'default', name: '#dev-team' },
  timestamp: Date.now(),
});
```

### 发送文本消息

```javascript
await plugin.sendText('这是一条简单的 Slack 消息');
```

### 发送交互式消息（带按钮）

```javascript
await plugin.sendInteractiveMessage(
  '部署确认',
  '是否确认部署到生产环境？',
  [
    { text: '确认部署', value: 'confirm', style: 'primary' },
    { text: '取消', value: 'cancel', style: 'danger' },
  ]
);
```

### 发送测试

```javascript
const result = await plugin.sendTest();
```

## Block Kit 消息示例

```javascript
const blocks = [
  {
    type: 'header',
    text: {
      type: 'plain_text',
      text: '🚀 部署完成',
      emoji: true,
    },
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*环境:* 生产环境\n*版本:* v1.2.3\n*耗时:* 3分20秒',
    },
  },
  {
    type: 'divider',
  },
  {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: '由 ClawKit 自动发送',
      },
    ],
  },
];

await plugin.sendBlockKitMessage(blocks);
```

## 通知类型

| 类型 | 说明 |
|-----|------|
| `task_created` | 任务创建 |
| `task_approved` | 任务审批通过 |
| `task_rejected` | 任务被拒绝 |
| `task_started` | 任务开始执行 |
| `task_completed` | 任务完成 |
| `task_failed` | 任务失败 |
| `task_cancelled` | 任务取消 |
| `task_progress` | 任务进度更新 |
| `system_alert` | 系统告警 |
| `custom` | 自定义消息 |

## API 参考

### initialize(config, context)

初始化插件。

### send(notification)

发送通知消息。

### sendText(text, channel?)

发送简单文本消息。

### sendBlockKitMessage(blocks, options?)

发送 Block Kit 消息。

### sendInteractiveMessage(title, message, actions)

发送带按钮的交互式消息。

### sendTest(target?)

发送测试消息。

### healthCheck()

检查插件健康状态。

### validateConfig(config)

验证配置是否有效。

## 常用 Emoji

| Emoji | 含义 |
|-------|------|
| :bell: | 通知 |
| :white_check_mark: | 成功 |
| :x: | 失败 |
| :hourglass_flowing_sand: | 进行中 |
| :warning: | 警告 |
| :robot_face: | 机器人 |
| :rocket: | 部署 |
| :fire: | 紧急 |
| :red_circle: | 紧急优先级 |
| :orange_circle: | 高优先级 |
| :large_blue_circle: | 普通优先级 |
| :white_circle: | 低优先级 |

## 相关链接

- [Slack Block Kit Builder](https://app.slack.com/block-kit-builder/)
- [Slack Messaging API 文档](https://api.slack.com/messaging)
- [Block Kit 组件参考](https://api.slack.com/reference/block-kit)
