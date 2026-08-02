# 飞书通知器插件

飞书（Lark）Webhook 通知器插件，支持发送文本、富文本和卡片消息到飞书群。

## 功能特性

- ✅ 发送文本消息
- ✅ 发送富文本消息（支持标题、列表等）
- ✅ 发送卡片消息
- ✅ 支持 @ 成员和 @所有人
- ✅ 支持签名验证（v2 版本）
- ✅ 支持多种通知类型

## 安装

```bash
# 复制到插件目录
cp -r examples/plugins/feishu-notifier plugins/notifier/

# 或通过插件市场安装
```

## 配置

在 `manifest.yaml` 中配置插件：

```yaml
plugins:
  notifiers:
    - name: feishu-notifier
      enabled: true
      config:
        webhookUrl: "https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx"
        secret: "your-webhook-secret"  # 可选，启用签名验证
        botName: "ClawKit Bot"
        atMobiles: ["13800138000"]  # 可选，@ 的手机号
        isAtAll: false  # 可选，是否 @所有人
```

## 获取 Webhook URL

1. 打开飞书群
2. 点击群设置 → 群机器人 → 添加机器人
3. 选择「自定义机器人」
4. 设置机器人名称，复制 Webhook 地址

## 使用示例

### 基本使用

```javascript
const plugin = require('./feishu-notifier');

// 初始化
plugin.initialize({
  webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx',
  secret: 'your-secret',
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
  target: { type: 'webhook', id: 'default', name: '开发群' },
  timestamp: Date.now(),
});
```

### 发送文本消息

```javascript
await plugin.sendText('这是一条简单的文本消息');
```

### 发送卡片消息

```javascript
await plugin.sendCard({
  title: '部署通知',
  color: 'red',
  elements: [
    {
      tag: 'div',
      text: '生产环境部署完成',
    },
    {
      tag: 'hr',
    },
    {
      tag: 'note',
      elements: [
        { tag: 'plain_text', content: '部署人: 张三' },
        { tag: 'plain_text', content: '时间: 2026-07-31' },
      ],
    },
  ],
});
```

### 发送测试

```javascript
const result = await plugin.sendTest();
console.log(result.success ? '配置正确' : '配置错误');
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

### sendText(text)

发送简单文本消息。

### sendCard(card)

发送卡片消息。

### sendTest(target?)

发送测试消息。

### healthCheck()

检查插件健康状态。

### validateConfig(config)

验证配置是否有效。

## 错误处理

```javascript
const result = await plugin.send(notification);

if (!result.success) {
  console.error('发送失败:', result.error);
  // 处理错误
}
```

## 限制说明

- 消息内容长度限制: 4000 字符
- Webhook 调用频率限制: 每分钟最多 20 次
- 卡片元素数量限制: 最多 20 个

## 相关链接

- [飞书开放平台文档](https://open.feishu.cn/document/ukTMukTMukTM/ucTM5YjL3ETO24yNxkjN)
- [自定义机器人接入指南](https://open.feishu.cn/document/ukTMukTMukTM/ucTM5YjL3ETO24yNxkjN)
