# HTTP Webhook 触发器插件

通用 HTTP Webhook 触发器插件，支持接收和处理任意 HTTP Webhook 请求。

## 功能特性

- ✅ 支持多种 HTTP 方法（GET、POST、PUT 等）
- ✅ 支持 JSON 和表单数据
- ✅ 支持签名验证（SHA256、SHA1、MD5）
- ✅ 支持路径和方法过滤
- ✅ 支持必需头部检查
- ✅ 支持自定义事件解析器
- ✅ 支持发送 Webhook 请求

## 安装

```bash
# 复制到插件目录
cp -r examples/plugins/http-webhook-trigger plugins/trigger/
```

## 配置

在 `manifest.yaml` 中配置插件：

```yaml
plugins:
  triggers:
    - name: http-webhook-trigger
      enabled: true
      config:
        # 签名验证
        secretToken: "your-webhook-secret"
        signatureHeader: "x-signature"
        signatureAlgorithm: "sha256"
        
        # 允许的 HTTP 方法
        allowedMethods:
          - "POST"
          - "PUT"
        
        # 允许的内容类型（空表示所有）
        allowedContentTypes:
          - "application/json"
        
        # 允许的路径（空表示所有）
        allowedPaths:
          - "/webhook/*"
          - "/api/hooks"
        
        # 必须包含的头部
        requiredHeaders:
          x-source: "my-app"
        
        # 默认事件类型
        defaultEventType: "custom_webhook"
```

## 自定义解析器

```yaml
plugins:
  triggers:
    - name: http-webhook-trigger
      config:
        eventParser: |
          function(event, headers, queryParams) {
            return {
              eventId: 'custom-' + Date.now(),
              eventType: event.type || 'custom',
              source: 'my-app',
              timestamp: new Date().toISOString(),
              data: event.data,
              headers: headers,
            };
          }
```

## 使用示例

### 基本使用

```javascript
const plugin = require('./http-webhook-trigger');

// 初始化
plugin.initialize({
  secretToken: 'my-secret',
  allowedMethods: ['POST'],
});

// 注册事件处理器
plugin.onTrigger(async (event) => {
  console.log('收到 Webhook:', event.eventType);
  
  const task = await context.createTask({
    text: `处理 ${event.eventType} 事件`,
    prompt: `请处理以下 Webhook 事件:\n\n${JSON.stringify(event, null, 2)}`,
    metadata: {
      source: 'http_webhook',
      eventType: event.eventType,
    },
  });
});
```

### 自定义解析器

```javascript
plugin.initialize({
  secretToken: 'my-secret',
  eventParser: (event, headers, queryParams) => {
    return {
      eventId: event.id || `evt-${Date.now()}`,
      eventType: event.action || event.type || 'custom',
      source: 'my-system',
      timestamp: event.timestamp || new Date().toISOString(),
      resource: {
        type: event.resource_type,
        id: event.resource_id,
        name: event.resource_name,
        data: event,
      },
      headers: headers,
      queryParams: queryParams,
      raw: event,
    };
  },
});
```

### 处理特定来源

```javascript
plugin.initialize({
  requiredHeaders: {
    'x-source': 'my-app',
  },
  allowedPaths: ['/api/webhooks/orders'],
});

plugin.onTrigger(async (event) => {
  if (event.resource.type === 'order') {
    // 处理订单事件
    console.log('新订单:', event.resource.id);
  }
});
```

### 发送 Webhook

```javascript
// 发送 Webhook 请求
const result = await plugin.sendWebhook(
  'https://example.com/webhook',
  {
    event: 'task_completed',
    taskId: 'task-001',
    result: 'success',
  },
  {
    secretToken: 'my-secret',
  }
);

if (result.success) {
  console.log('Webhook 发送成功');
}
```

## 事件格式

解析后的事件对象：

```javascript
{
  eventId: 'http-123456789-abc123',
  eventType: 'custom_webhook',
  source: 'http_webhook',
  timestamp: '2026-07-31T10:00:00.000Z',
  resource: {
    type: 'Order',
    id: '12345',
    name: '新订单',
    data: { /* 原始数据 */ },
  },
  action: 'created',
  headers: {
    'content-type': 'application/json',
    'x-source': 'my-app',
  },
  queryParams: {
    action: 'create',
  },
  raw: { /* 原始 payload */ },
}
```

## 签名验证

### 发送方配置签名

```javascript
const crypto = require('crypto');

const secret = 'your-secret';
const payload = JSON.stringify({ event: 'test' });
const signature = 'sha256=' + crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

// 发送请求
fetch('https://your-controller/webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Signature': signature,
  },
  body: payload,
});
```

### 接收方验证签名

```javascript
plugin.initialize({
  secretToken: 'your-secret',
  signatureHeader: 'x-signature',
  signatureAlgorithm: 'sha256',
});
```

## API 参考

### initialize(config, context)

初始化插件。

### handleWebhook(payload, headers, method, path)

处理 Webhook 请求。

- `payload`: 请求体
- `headers`: 请求头部
- `method`: HTTP 方法
- `path`: 请求路径

### verifySignature(payload, signature)

验证签名。

### sendWebhook(url, data, options)

发送 Webhook 请求。

### onTrigger(handler)

注册事件处理器。

### onCancel(taskId)

取消特定任务。

### healthCheck()

检查插件健康状态。

### validateConfig(config)

验证配置是否有效。

## 过滤规则

### 方法过滤

```javascript
config.allowedMethods = ['POST', 'PUT'];
```

### 路径过滤

```javascript
// 精确匹配
config.allowedPaths = ['/webhook/orders', '/webhook/users'];

// 通配符匹配
config.allowedPaths = ['/webhook/*', '/api/hooks/*'];
```

### Content-Type 过滤

```javascript
config.allowedContentTypes = ['application/json'];
```

### 必需头部

```javascript
config.requiredHeaders = {
  'x-source': '',  // 只要有这个头部即可
  'x-api-key': 'my-key',  // 必须包含特定值
};
```

## 最佳实践

1. **始终配置签名验证**
   - 防止恶意请求
   - 确保请求来源可靠

2. **使用路径过滤**
   - 限制可接收的端点
   - 结合白名单机制

3. **添加必需头部**
   - 双重验证请求来源
   - 便于追踪和日志

4. **使用自定义解析器**
   - 统一不同来源的数据格式
   - 提取关键字段

## 完整示例

### 接收第三方 API Webhook

```javascript
const plugin = require('./http-webhook-trigger');

plugin.initialize({
  secretToken: process.env.WEBHOOK_SECRET,
  signatureHeader: 'x-signature-256',
  allowedMethods: ['POST'],
  allowedPaths: ['/webhooks/third-party'],
  requiredHeaders: {
    'x-webhook-source': 'partner-api',
  },
  eventParser: (event, headers) => ({
    eventId: event.id,
    eventType: event.type,
    source: 'partner-api',
    timestamp: event.created_at,
    resource: {
      type: event.entity_type,
      id: event.entity_id,
      data: event.payload,
    },
    headers: headers,
    raw: event,
  }),
});

plugin.onTrigger(async (event) => {
  console.log(`处理 ${event.eventType} 事件`);
  
  // 创建任务处理
  await context.createTask({
    text: `处理 ${event.resource.type} #${event.resource.id}`,
    prompt: JSON.stringify(event.resource.data, null, 2),
    metadata: event,
  });
});
```

## 相关链接

- [Webhook 最佳实践](https://webhooks.gdocs.cn/)
- [Webhook 安全指南](https://owasp.org/www-project-api-security/)
