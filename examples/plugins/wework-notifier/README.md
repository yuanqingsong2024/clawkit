# 企业微信通知器插件

企业微信（WeCom）Webhook 通知器插件，支持发送 Markdown、文本、图文等消息类型。

## 功能特性

- ✅ **多种消息类型**：Markdown、文本、图文、模板卡片
- ✅ **@ 成员**：支持 @ 指定成员和 @所有人
- ✅ **安全模式**：支持签名验证
- ✅ **富文本通知**：支持优先级、执行者、耗时等详细信息
- ✅ **批量发送**：支持一次性发送多条通知

## 安装

```bash
# 复制到插件目录
cp -r examples/plugins/wework-notifier plugins/notifier/
```

## 配置

在 `clawkit.yaml` 中配置插件：

```yaml
plugins:
  notifiers:
    - name: wework-notifier
      enabled: true
      config:
        # 企业微信 Webhook 地址
        webhookUrl: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxx"
        
        # 安全模式（可选）
        enableSecurity: true
        secret: "your-signing-secret"
        
        # 默认 @ 手机号列表
        atMobiles:
          - "13800138000"
        
        # 是否 @所有人
        isAtAll: false
        
        # 消息类型: markdown | text | news | template_card
        msgType: markdown
```

## 获取 Webhook 地址

### 方式一：通过群机器人

1. 打开企业微信「工作台」→「自建应用」
2. 创建应用或在已有应用中添加「机器人」功能
3. 在群聊中添加机器人
4. 复制 Webhook 地址

### 方式二：通过应用消息

1. 打开企业微信管理后台
2. 创建自建应用
3. 在「接收消息」中设置「企业可信 IP」
4. 获取 `corp_id` 和 `agent_id`
5. 使用「发送应用消息」API

## 使用示例

### 基本使用

```javascript
const WeWorkNotifier = require('./wework-notifier');

// 初始化
WeWorkNotifier.initialize({
  webhookUrl: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxx',
  msgType: 'markdown',
});

// 发送通知
await WeWorkNotifier.send({
  type: 'task_completed',
  content: {
    title: '任务完成',
    body: '代码审查任务已成功完成',
  },
});
```

### 完整示例

```javascript
await WeWorkNotifier.send({
  type: 'task_completed',
  priority: 'medium',
  content: {
    title: 'PR #123 代码审查完成',
    body: '代码审查任务已成功完成',
    subtitle: '建议合并到 main 分支',
    details: {
      '任务名称': 'PR #123 代码审查',
      '执行者': 'Claude Code',
      '耗时': '2分30秒',
      '变更文件': '5 个',
    },
    url: 'https://github.com/org/repo/pull/123',
  },
});
```

### 发送测试

```javascript
const result = await WeWorkNotifier.sendTest();
console.log(result.errcode === 0 ? '配置正确' : '配置错误');
```

### 批量发送

```javascript
const notifications = [
  { type: 'task_completed', content: { body: '任务1完成' } },
  { type: 'task_failed', content: { body: '任务2失败' } },
];

const results = await WeWorkNotifier.sendBatch(notifications);
```

## 通知类型

| 类型 | 说明 |
|------|------|
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

## 消息类型

### Markdown 消息

支持企业微信 Markdown 语法：

```javascript
await WeWorkNotifier.send({
  type: 'custom',
  content: {
    body: '支持 **加粗**、*斜体*、`代码` 等格式',
  },
});
```

### 文本消息

```javascript
WeWorkNotifier.initialize({ msgType: 'text' });
await WeWorkNotifier.send({
  content: {
    body: '这是一条纯文本通知',
  },
});
```

### 图文消息

```javascript
WeWorkNotifier.initialize({ msgType: 'news' });
await WeWorkNotifier.send({
  content: {
    title: '发布公告',
    body: 'ClawKit v0.2.0 正式发布',
    url: 'https://github.com/clawkit/clawkit/releases',
    image: 'https://example.com/cover.png',
  },
});
```

## 安全模式

启用签名验证可以防止恶意请求：

```yaml
plugins:
  notifiers:
    - name: wework-notifier
      config:
        webhookUrl: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxx"
        enableSecurity: true
        secret: "your-encryption-secret"
```

签名算法：
1. 把 `timestamp + "\n" + secret` 作为签名字符串
2. 使用 SHA256 加密
3. Base64 编码
4. 附加到 URL 参数

## API 参考

### initialize(config, context)

初始化插件。

### send(notification)

发送单条通知。

### sendBatch(notifications)

批量发送通知。

### sendTest()

发送测试消息验证配置。

### supportsType(type)

检查是否支持特定通知类型。

### healthCheck()

健康检查。

### validatePluginConfig(config)

验证配置。

## 限制说明

- Markdown 消息字数限制：2048 字符
- 文本消息字数限制：2048 字符
- 群机器人每分钟最多 20 条
- 应用消息无频率限制（但有总量限制）

## 相关链接

- [企业微信开发文档](https://developer.work.weixin.qq.com/document/)
- [群机器人配置指南](https://developer.work.weixin.qq.com/document/path/91770)
- [应用消息接口](https://developer.work.weixin.qq.com/document/path/90236)
