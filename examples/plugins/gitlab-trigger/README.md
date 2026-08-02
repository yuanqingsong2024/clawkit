# GitLab 触发器插件

GitLab Webhook 触发器插件，支持监听 Push、Merge Request、Pipeline 等事件来触发 ClawKit 任务。

## 功能特性

- ✅ 监听 Push 事件（代码推送）
- ✅ 监听 Merge Request 事件（PR/MR）
- ✅ 监听 Pipeline 事件（CI/CD 流水线）
- ✅ 监听 Tag Push 事件（标签发布）
- ✅ 项目和分支过滤
- ✅ Webhook 签名验证
- ✅ 正则表达式匹配分支

## 安装

```bash
# 复制到插件目录
cp -r examples/plugins/gitlab-trigger plugins/trigger/
```

## 配置

在 `manifest.yaml` 中配置插件：

```yaml
plugins:
  triggers:
    - name: gitlab-trigger
      enabled: true
      config:
        # Webhook 密钥（与 GitLab 配置一致）
        secretToken: "your-webhook-secret"
        
        # 监听的事件类型
        allowedEvents:
          - push
          - merge_request
          - pipeline
        
        # 限制特定项目（空表示所有项目）
        allowedProjects:
          - "my-group/my-project"
        
        # 限制特定分支（空表示所有分支）
        allowedBranches:
          - main
          - develop
        
        # 正则表达式匹配分支（优先级高于 allowedBranches）
        branchPattern: "^(main|develop|feature/.*)$"
        
        # 排除的分支
        excludeBranches:
          - "wip/*"
```

## GitLab Webhook 配置

1. 进入 GitLab 项目 → Settings → Webhooks
2. 添加 Webhook：
   - URL: `http://your-controller-url/webhook/gitlab`
   - Secret token: 与配置文件中的 `secretToken` 一致
   - Trigger: 选择要触发的事件
3. 点击 "Add webhook" 保存

## 使用示例

### 基本使用

```javascript
const plugin = require('./gitlab-trigger');

// 初始化
plugin.initialize({
  secretToken: 'your-webhook-secret',
  allowedEvents: ['push', 'merge_request'],
  branchPattern: '^(main|develop|feature/.*)$',
});

// 注册事件处理器
plugin.onTrigger(async (event) => {
  console.log('收到 GitLab 事件:', event.eventType);
  
  // 根据事件类型处理
  if (event.eventType === 'push') {
    // 处理 Push 事件
    console.log(`代码推送: ${event.project.name}/${event.branch}`);
    console.log(`提交数: ${event.commit.count}`);
  } else if (event.eventType === 'merge_request') {
    // 处理 MR 事件
    console.log(`MR #${event.mergeRequest.id}: ${event.mergeRequest.title}`);
    console.log(`${event.mergeRequest.author} 请求合并 ${event.mergeRequest.sourceBranch} -> ${event.mergeRequest.targetBranch}`);
  }
});
```

### 处理 Push 事件

```javascript
plugin.onTrigger(async (event) => {
  if (event.eventType !== 'push') return;
  
  const task = await context.createTask({
    text: `代码审查: ${event.project.name}/${event.branch}`,
    prompt: `请审查以下代码变更:\n\n项目: ${event.project.name}\n分支: ${event.branch}\n提交信息: ${event.commit.message}\n作者: ${event.commit.author}\n提交数: ${event.commit.count}`,
    metadata: {
      source: 'gitlab',
      eventType: 'push',
      projectPath: event.project.path,
      branch: event.branch,
      commitSha: event.commit.sha,
    },
  });
});
```

### 处理 Merge Request 事件

```javascript
plugin.onTrigger(async (event) => {
  if (event.eventType !== 'merge_request') return;
  
  const mr = event.mergeRequest;
  
  // 只处理新打开的 MR
  if (mr.action !== 'open') return;
  
  const task = await context.createTask({
    text: `Code Review: ${mr.title}`,
    prompt: `请审查以下 Merge Request:\n\n标题: ${mr.title}\n描述: ${mr.description}\n源分支: ${mr.sourceBranch}\n目标分支: ${mr.targetBranch}\n作者: ${mr.author}\n链接: ${mr.url}`,
    metadata: {
      source: 'gitlab',
      eventType: 'merge_request',
      mrId: mr.id,
      mrUrl: mr.url,
    },
  });
});
```

## 事件类型

### Push 事件

```javascript
{
  eventId: 'gitlab-abc123',
  eventType: 'push',
  source: 'gitlab',
  project: {
    id: 123,
    name: 'my-project',
    path: 'group/my-project',
    url: 'https://gitlab.com/group/my-project',
  },
  branch: 'main',
  commit: {
    sha: 'abc123...',
    message: 'fix: 修复登录问题',
    author: '张三',
    count: 3,
  },
  pusher: {
    name: '张三',
    email: 'zhangsan@example.com',
  },
}
```

### Merge Request 事件

```javascript
{
  eventId: 'gitlab-mr-42',
  eventType: 'merge_request',
  project: {
    id: 123,
    name: 'my-project',
    path: 'group/my-project',
  },
  mergeRequest: {
    id: 42,
    title: 'feat: 添加新功能',
    description: '实现了 XXX 功能',
    sourceBranch: 'feature/new-feature',
    targetBranch: 'main',
    state: 'opened',
    action: 'open',
    url: 'https://gitlab.com/group/my-project/-/merge_requests/42',
    author: '张三',
  },
  branch: 'feature/new-feature',
}
```

### Pipeline 事件

```javascript
{
  eventId: 'gitlab-pipeline-1234',
  eventType: 'pipeline',
  project: {
    id: 123,
    name: 'my-project',
    path: 'group/my-project',
  },
  pipeline: {
    id: 1234,
    status: 'success', // success, failed, running, pending
    ref: 'main',
    stages: ['build', 'test', 'deploy'],
  },
  branch: 'main',
}
```

## API 参考

### initialize(config, context)

初始化插件。

### handleWebhook(payload, headers)

处理 Webhook 请求，返回事件解析结果。

### verifySignature(payload, signature)

验证 Webhook 签名。

### onTrigger(handler)

注册事件处理器，返回取消函数。

### onCancel(taskId)

取消特定任务。

### healthCheck()

检查插件健康状态。

### validateConfig(config)

验证配置是否有效。

## 分支匹配规则

### 精确匹配

```javascript
config.allowedBranches = ['main', 'develop', 'release/*'];
```

### 正则表达式

```javascript
// 匹配 main、develop 和所有 feature 分支
config.branchPattern = '^(main|develop|feature/.*)$';

// 匹配所有 release 分支
config.branchPattern = '^release/\\d+\\.\\d+\\.\\d+$';

// 匹配除 wip 开头的所有分支
config.branchPattern = '^(?!wip/).*$';
```

## 相关链接

- [GitLab Webhooks 文档](https://docs.gitlab.com/ee/user/project/integrations/webhooks.html)
- [GitLab Webhook 事件](https://docs.gitlab.com/ee/user/project/integrations/webhook_events.html)
