# 钉钉通知器插件

钉钉（DingTalk）Webhook 通知器插件，支持发送 Markdown 消息到钉钉群。

## 功能特性

- ✅ 支持 Markdown 消息格式
- ✅ 支持 @ 成员和 @所有人
- ✅ 支持签名验证（v2 版本）
- ✅ 支持多种通知类型
- ✅ 美观的默认样式

## 安装

```bash
# 复制到插件目录
cp -r examples/plugins/dingtalk-notifier plugins/notifier/
```

## 配置

在 `manifest.yaml` 中配置插件：

```yaml
plugins:
  notifiers:
    - name: dingtalk-notifier
      enabled: true
      config:
        # Webhook 地址
        webhookUrl: "https://oapi.dingtalk.com/robot/send?access_token=xxxxx"
        
        # 签名密钥（可选）
        secret: "your-signing-secret"
        
        # 默认 @ 手机号列表
        atMobiles:
          - "13800138000"
        
        # 是否 @所有人
        isAtAll: false
```

## 获取 Webhook URL

1. 打开钉钉群
2. 点击群设置 → 智能群助手 → 添加机器人
3. 选择「自定义机器人」
4. 设置机器人名称和安全设置（加签或 IP 白名单）
5. 复制 Webhook 地址和签名密钥

## 使用示例

### 基本使用

```javascript
const plugin = require('./dingtalk-notifier');

// 初始化
plugin.initialize({
  webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=xxxxx',
  secret: 'your-signing-secret',
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
  target: { type: 'group', id: 'dev-team', name: '开发群' },
  timestamp: Date.now(),
});
```

### 发送测试

```javascript
const result = await plugin.sendTest();
console.log(result.success ? '配置正确' : '配置错误');
```

### 批量发送

```javascript
const notifications = [
  { type: 'task_completed', content: { title: '任务1完成', body: '...' } },
  { type: 'task_failed', content: { title: '任务2失败', body: '...' } },
];

const results = await plugin.sendBatch(notifications);
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

## 签名验证

钉钉支持加签方式验证：

```javascript
plugin.initialize({
  webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=xxxxx',
  secret: 'SECxxxxxxxx',  // 机器人安全设置中的密钥
});
```

签名算法：
1. 把 `timestamp + "\n" + secret` 作为签名字符串
2. 使用 HMAC-SHA256 对签名字符串进行加密
3. 将加密后的字符串进行 Base64 编码
4. 在 URL 中添加 `&sign=编码后的签名`

## API 参考

### initialize(config, context)

初始化插件。

### send(notification)

发送通知消息。

### sendBatch(notifications)

批量发送通知。

### sendTest(target?)

发送测试消息。

### supportsType(type)

检查是否支持特定通知类型。

### healthCheck()

检查插件健康状态。

### validateConfig(config)

验证配置是否有效。

## 限制说明

- 消息内容长度限制: 4000 字符
- Webhook 调用频率限制: 每分钟最多 20 次
- @ 手机号数量限制: 100 个
- 图片大小限制: 2MB

## 相关链接

- [钉钉开放平台文档](https://open.dingtalk.com/document/)
- [自定义机器人接入指南](https://open.dingtalk.com/document/org/custom-robot-access)
