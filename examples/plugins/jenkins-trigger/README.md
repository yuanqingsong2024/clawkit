# Jenkins 触发器插件

Jenkins Webhook 触发器插件，支持监听 Jenkins 构建事件和 GitHub PR 评论来触发 ClawKit 任务。

## 功能特性

- ✅ 监听 Jenkins Generic Webhook 事件
- ✅ 监听 GitHub Pull Request 评论触发
- ✅ Job 和构建结果过滤
- ✅ 触发 Jenkins 构建
- ✅ 获取构建状态详情
- ✅ Webhook 签名验证

## 安装

```bash
# 复制到插件目录
cp -r examples/plugins/jenkins-trigger plugins/trigger/
```

## 配置

在 `manifest.yaml` 中配置插件：

```yaml
plugins:
  triggers:
    - name: jenkins-trigger
      enabled: true
      config:
        # Webhook 密钥
        secretToken: "your-webhook-secret"
        
        # Jenkins 连接配置
        jenkinsUrl: "https://jenkins.example.com"
        jenkinsUser: "your-username"
        jenkinsToken: "your-api-token"
        
        # 监听的事件类型
        allowedEvents:
          - build
          - pipeline
        
        # 限制特定 Job（空表示所有）
        allowedJobs:
          - "my-project-*"
          - "deploy-*"
        
        # 排除的 Job
        excludeJobs:
          - "wip-*"
        
        # 限制特定结果（空表示所有）
        allowedResults:
          - "FAILURE"
          - "UNSTABLE"
        
        # 只触发失败构建
        includeOnlyFailure: true
```

## Jenkins Webhook 配置

### Generic Webhook Plugin

1. 安装 Generic Webhook Plugin
2. 在 Job 配置中添加 Webhook Trigger
3. 设置 Token（用于触发 URL）
4. 可选：配置 Post content parameters

### GitHub Pull Request Commenter Plugin

1. 安装 GitHub Pull Request Commenter Plugin
2. 配置 GitHub 凭证
3. 在 Job 中添加 Trigger

## 使用示例

### 基本使用

```javascript
const plugin = require('./jenkins-trigger');

// 初始化
plugin.initialize({
  jenkinsUrl: 'https://jenkins.example.com',
  jenkinsUser: 'admin',
  jenkinsToken: 'your-api-token',
  allowedJobs: ['deploy-*'],
  includeOnlyFailure: true,
});

// 注册事件处理器
plugin.onTrigger(async (event) => {
  console.log('收到 Jenkins 事件:', event.eventType);
  
  if (event.eventType === 'build') {
    console.log(`构建 #${event.build.number} - ${event.build.status}`);
    console.log(`Job: ${event.project.name}`);
  }
});
```

### 处理构建失败

```javascript
plugin.onTrigger(async (event) => {
  if (event.eventType !== 'build') return;
  
  const build = event.build;
  
  // 只处理失败的构建
  if (!['FAILURE', 'UNSTABLE', 'FAILED', 'ERROR'].includes(build.status)) {
    return;
  }
  
  const task = await context.createTask({
    text: `Jenkins 构建失败: ${event.project.name} #${build.number}`,
    prompt: `Jenkins 构建失败，需要人工介入分析。\n\nJob: ${event.project.name}\n构建号: ${build.number}\n状态: ${build.status}\n链接: ${build.url}\n\n请分析构建日志，找出失败原因并给出修复建议。`,
    metadata: {
      source: 'jenkins',
      eventType: 'build',
      jobName: event.project.name,
      buildNumber: build.number,
      buildUrl: build.url,
    },
  });
});
```

### 触发 Jenkins 构建

```javascript
// 触发无参数构建
const result = await plugin.triggerBuild('my-job');

// 带参数构建
const result = await plugin.triggerBuild('deploy-job', {
  ENVIRONMENT: 'staging',
  VERSION: '1.2.3',
});
```

### 获取构建状态

```javascript
const status = await plugin.getBuildStatus('my-job', 42);
if (status) {
  console.log(`构建状态: ${status.result}`);
  console.log(`耗时: ${status.duration}ms`);
  console.log(`阶段: ${status.stages.map(s => s.name).join(', ')}`);
}
```

## 事件类型

### Build 事件

```javascript
{
  eventId: 'jenkins-my-project-42',
  eventType: 'build',
  source: 'jenkins',
  project: {
    name: 'my-project',
    url: 'https://jenkins.example.com/job/my-project',
  },
  build: {
    number: 42,
    phase: 'COMPLETED',
    status: 'FAILURE',
    url: 'https://jenkins.example.com/job/my-project/42/',
    scm: {
      branch: 'main',
      commit: 'abc123...',
    },
  },
  buildDetails: {
    // 详细构建信息（如果可用）
    duration: 120000,
    building: false,
    stages: [...],
  },
}
```

### GitHub Comment 事件

```javascript
{
  eventId: 'jenkins-gh-comment-123',
  eventType: 'github_comment',
  source: 'jenkins',
  github: {
    action: 'created', // created, edited, deleted
    comment: {
      id: 123,
      body: '/jenkins test',
      author: 'octocat',
    },
    issue: {
      number: 42,
      title: 'Add new feature',
      url: 'https://github.com/user/repo/issues/42',
    },
    pullRequest: {
      number: 42,
      title: 'Add new feature',
      head: 'feature-branch',
      base: 'main',
    },
    repository: 'user/repo',
  },
}
```

## API 参考

### initialize(config, context)

初始化插件。

### handleWebhook(payload, headers)

处理 Webhook 请求。

### verifySignature(payload, signature)

验证 Webhook 签名。

### triggerBuild(jobName, parameters?)

触发 Jenkins 构建。

### getBuildStatus(jobName, buildNumber)

获取构建状态详情。

### onTrigger(handler)

注册事件处理器。

### onCancel(taskId)

取消特定任务。

### healthCheck()

检查插件健康状态。

### validateConfig(config)

验证配置是否有效。

## Job 过滤规则

### 精确匹配

```javascript
config.allowedJobs = ['my-job', 'deploy-job'];
```

### 通配符匹配

```javascript
config.allowedJobs = ['*-ci', 'deploy-*', 'release/*'];
```

## Jenkins API Token

获取 Jenkins API Token:
1. 登录 Jenkins
2. 点击右上角用户名 → Configure
3. 在 API Token 部分点击 "Add new Token"
4. 复制生成的 Token

## 相关链接

- [Generic Webhook Plugin](https://plugins.jenkins.io/generic-webhook-trigger/)
- [GitHub Pull Request Commenter](https://plugins.jenkins.io/ghprb/)
- [Jenkins API 文档](https://www.jenkins.io/doc/book/using/remote-access-api/)
