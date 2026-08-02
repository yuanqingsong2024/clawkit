# Sentry 触发器插件

Sentry Webhook 触发器插件，支持监听 Error、Issue、Performance 等事件来触发 ClawKit 任务。

## 功能特性

- ✅ 监听 Error 事件
- ✅ 监听 Issue 事件
- ✅ 监听 Performance 事件
- ✅ 项目和级别过滤
- ✅ 用户数和发生次数阈值
- ✅ Webhook 签名验证

## 安装

```bash
# 复制到插件目录
cp -r examples/plugins/sentry-trigger plugins/trigger/
```

## 配置

在 `manifest.yaml` 中配置插件：

```yaml
plugins:
  triggers:
    - name: sentry-trigger
      enabled: true
      config:
        # Webhook 密钥（与 Sentry 配置一致）
        secretToken: "your-sentry-webhook-secret"
        
        # 监听的事件类型
        allowedEvents:
          - error
          - issue
          - performance
        
        # 限制特定项目（空表示所有）
        allowedProjects:
          - "my-project"
          - "frontend-app"
        
        # 排除的项目
        excludeProjects:
          - "test-project"
        
        # 限制特定级别（空表示所有）
        allowedLevels:
          - error
          - fatal
        
        # 排除的级别（默认）
        excludeLevels:
          - info
          - debug
        
        # 最小影响用户数
        minUserCount: 5
        
        # 最小发生次数
        minOccurrence: 10
```

## Sentry Webhook 配置

1. 登录 Sentry
2. 进入 Settings → Projects → [Your Project] → Alerts → Webhooks
3. 启用 Webhooks
4. 设置 Endpoint URL: `https://your-controller-url/webhook/sentry`
5. 设置 Secret: 与配置文件中的 `secretToken` 一致
6. 选择要监听的事件类型

## 使用示例

### 基本使用

```javascript
const plugin = require('./sentry-trigger');

// 初始化
plugin.initialize({
  secretToken: 'your-sentry-webhook-secret',
  allowedEvents: ['error', 'issue'],
  excludeLevels: ['debug'],
});

// 注册事件处理器
plugin.onTrigger(async (event) => {
  console.log('收到 Sentry 事件:', event.eventType);
  
  if (event.eventType === 'error') {
    console.log(`错误: ${event.error.message}`);
    console.log(`项目: ${event.project.slug}`);
    console.log(`用户数: ${event.user.count}`);
  }
});
```

### 处理错误事件

```javascript
plugin.onTrigger(async (event) => {
  if (event.eventType !== 'error') return;
  
  const error = event.error;
  
  // 创建分析任务
  const task = await context.createTask({
    text: `分析 Sentry 错误: ${error.message || error.culprit}`,
    prompt: `请分析以下 Sentry 错误报告:\n\n错误信息: ${error.message}\n\n位置: ${error.culprit}\n平台: ${error.platform}\n环境: ${error.environment}\n级别: ${error.level}\n\n影响用户数: ${event.user.count || 0}\n\n上下文:\n${JSON.stringify(event.contexts, null, 2)}\n\n标签:\n${JSON.stringify(event.tags, null, 2)}\n\n请分析可能的原因并提供修复建议。`,
    metadata: {
      source: 'sentry',
      eventType: 'error',
      projectSlug: event.project.slug,
      errorId: error.id,
      level: error.level,
    },
  });
});
```

### 处理 Issue 事件

```javascript
plugin.onTrigger(async (event) => {
  if (event.eventType !== 'issue') return;
  
  const issue = event.issue;
  
  // 只处理新问题
  if (event.action !== 'created') return;
  
  const task = await context.createTask({
    text: `调查 Sentry 问题: ${issue.title}`,
    prompt: `Sentry 检测到新的应用问题:\n\n标题: ${issue.title}\n状态: ${issue.status}\n级别: ${issue.level}\n累计次数: ${issue.count}\n影响用户: ${issue.userCount}\n\n首次出现: ${issue.firstSeen}\n最后出现: ${issue.lastSeen}\n\n请调查这个问题，找出根本原因并提供解决方案。`,
    metadata: {
      source: 'sentry',
      eventType: 'issue',
      issueId: issue.id,
      shortId: issue.shortId,
    },
  });
});
```

### 只处理高影响错误

```javascript
plugin.initialize({
  secretToken: 'your-secret',
  minUserCount: 10,      // 至少影响 10 个用户
  minOccurrence: 50,     // 至少发生 50 次
  excludeLevels: ['warning', 'info', 'debug'],
});

plugin.onTrigger(async (event) => {
  // 这个处理器只会在高影响错误时触发
  const task = await context.createTask({
    text: `紧急: 高影响错误 - ${event.error.message}`,
    priority: 'urgent',
    prompt: `严重错误需要立即处理:\n\n${JSON.stringify(event, null, 2)}`,
  });
});
```

## 事件类型

### Error 事件

```javascript
{
  eventId: 'sentry-abc123',
  eventType: 'error',
  source: 'sentry',
  project: {
    id: '1',
    slug: 'my-project',
  },
  organization: {
    slug: 'my-org',
  },
  error: {
    id: 'abc123',
    level: 'error',
    culprit: 'processOrder in Checkout.js',
    message: 'TypeError: Cannot read property "price"',
    platform: 'javascript',
    environment: 'production',
  },
  issue: {
    id: '456',
    shortId: 'SENTRY-A',
  },
  user: {
    id: 'user-123',
    email: 'user@example.com',
    count: 15,
  },
  contexts: {
    // 错误上下文
  },
  tags: {
    os: 'Windows 10',
    browser: 'Chrome 91',
  },
}
```

### Issue 事件

```javascript
{
  eventId: 'sentry-issue-789',
  eventType: 'issue',
  action: 'created',  // created, resolved, ignored, escalated
  project: {
    id: '1',
    slug: 'my-project',
  },
  issue: {
    id: '789',
    shortId: 'SENTRY-B',
    title: 'TypeError: Cannot read property',
    level: 'error',
    status: 'unresolved',
    count: 42,
    userCount: 10,
    firstSeen: '2026-07-01T00:00:00Z',
    lastSeen: '2026-07-31T12:00:00Z',
  },
}
```

### Performance 事件

```javascript
{
  eventId: 'sentry-perf-xyz',
  eventType: 'performance',
  transaction: {
    name: '/api/users',
    duration: 2500,  // 毫秒
    op: 'http.server',
    status: 'ok',
  },
  spans: [...],
}
```

## API 参考

### initialize(config, context)

初始化插件。

### handleWebhook(payload, headers)

处理 Webhook 请求。

### verifySignature(payload, signature, timestamp)

验证 Sentry 签名。

### getIssues(projectSlug)

获取项目的 Issues 列表。

### getIssueDetails(issueId)

获取 Issue 详情。

### onTrigger(handler)

注册事件处理器。

### onCancel(taskId)

取消特定任务。

### healthCheck()

检查插件健康状态。

### validateConfig(config)

验证配置。

## 过滤规则

### 项目过滤

```javascript
// 白名单
config.allowedProjects = ['production-app', 'api'];

// 黑名单
config.excludeProjects = ['test-app', 'staging-app'];
```

### 级别过滤

```javascript
// 只处理严重错误
config.allowedLevels = ['fatal', 'error'];

// 排除低级别
config.excludeLevels = ['debug', 'info'];
```

### 阈值过滤

```javascript
// 影响用户数 >= 10
config.minUserCount = 10;

// 发生次数 >= 50
config.minOccurrence = 50;
```

## 最佳实践

1. **设置合理的过滤规则**
   - 避免过多无意义的告警
   - 专注于需要人工处理的问题

2. **使用优先级**
   - fatal/error 设置高优先级
   - warning/info 设置普通优先级

3. **添加上下文信息**
   - 在 metadata 中添加项目、错误 ID 等
   - 方便后续关联和追踪

4. **设置阈值**
   - 新项目可以放宽阈值
   - 稳定项目可以收紧阈值

## Sentry 事件类型

| Sentry 类型 | ClawKit 类型 | 说明 |
|------------|-------------|------|
| Event | error | 错误事件 |
| Issue | issue | 问题事件 |
| Transaction | performance | 性能事件 |

## 相关链接

- [Sentry Webhooks 文档](https://docs.sentry.io/product/integrations/integration-platform/webhooks/)
- [Sentry SDK 文档](https://docs.sentry.io/platforms/)
