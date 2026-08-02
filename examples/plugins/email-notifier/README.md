# 邮件通知器插件

SMTP 邮件通知器插件，支持发送精美的 HTML 邮件通知。

## 功能特性

- ✅ 支持 HTML 邮件和纯文本邮件
- ✅ 美观的邮件模板
- ✅ 支持抄送和密送
- ✅ SMTP 连接池
- ✅ 支持多种通知类型
- ✅ 健康检查

## 安装

```bash
# 需要安装 nodemailer 依赖
npm install nodemailer

# 复制到插件目录
cp -r examples/plugins/email-notifier plugins/notifier/
```

## 配置

在 `manifest.yaml` 中配置插件：

```yaml
plugins:
  notifiers:
    - name: email-notifier
      enabled: true
      config:
        # SMTP 服务器配置
        host: "smtp.exmail.qq.com"
        port: 465
        secure: true  # true for 465, false for other ports
        user: "notifications@example.com"
        pass: "your-password"
        
        # 发件人配置
        from: "ClawKit <notifications@example.com>"
        fromName: "ClawKit"
        
        # 默认收件人
        to:
          - "team@example.com"
        cc:
          - "manager@example.com"
```

## 使用示例

### 基本使用

```javascript
const plugin = require('./email-notifier');

// 初始化
plugin.initialize({
  host: 'smtp.exmail.qq.com',
  port: 465,
  secure: true,
  user: 'notifications@example.com',
  pass: 'your-password',
  to: ['team@example.com'],
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
  target: { type: 'email', name: '开发团队', email: 'team@example.com' },
  timestamp: Date.now(),
});
```

### 发送简单邮件

```javascript
await plugin.sendEmail(
  ['user1@example.com', 'user2@example.com'],
  '测试主题',
  '这是一封测试邮件'
);
```

### 发送测试

```javascript
const result = await plugin.sendTest();
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

## 常见邮件服务配置

### QQ 企业邮箱

```yaml
config:
  host: "smtp.exmail.qq.com"
  port: 465
  secure: true
  user: "your-email@company.com"
  pass: "your-password"
```

### 网易企业邮箱

```yaml
config:
  host: "smtp.qiye.163.com"
  port: 465
  secure: true
  user: "your-email@company.com"
  pass: "your-password"
```

### Gmail

```yaml
config:
  host: "smtp.gmail.com"
  port: 465
  secure: true
  user: "your-email@gmail.com"
  pass: "your-app-password"
```

### 阿里云邮件推送

```yaml
config:
  host: "smtp.mxhichina.com"
  port: 465
  secure: true
  user: "your-email@domain.com"
  pass: "your-password"
```

## API 参考

### initialize(config, context)

初始化插件并创建 SMTP 连接。

### send(notification)

发送邮件通知。

### sendEmail(to, subject, body)

发送简单邮件。

- `to`: 收件人，可以是字符串或数组
- `subject`: 邮件主题
- `body`: 邮件正文

### healthCheck()

验证 SMTP 连接是否正常。

### validateConfig(config)

验证配置是否有效。

## 错误处理

```javascript
const result = await plugin.send(notification);

if (!result.success) {
  console.error('发送失败:', result.error);
}
```

## 限制说明

- 邮件大小限制: 通常 25MB
- 收件人数量限制: 取决于邮件服务商
- 发送频率限制: 取决于邮件服务商

## 相关链接

- [nodemailer 官方文档](https://nodemailer.com/)
- [常见邮箱 SMTP 配置](https://help.aliyun.com/document_detail/29444.html)
