# GitHub 触发器插件

GitHub Webhook 触发器插件，支持监听 GitHub 各种事件并触发 ClawKit 任务。

## 功能特性

- ✅ **多种事件支持**：Push、Pull Request、Issue、Release、Check Run、Workflow 等
- ✅ **签名验证**：支持 HMAC-SHA256 签名验证，确保 Webhook 安全
- ✅ **事件过滤**：支持仓库、分支、Action 级别的精细过滤
- ✅ **完整解析**：每个事件类型都有完整的字段解析
- ✅ **GitHub API 集成**：提供常用 GitHub API 端点信息

## 支持的事件类型

| 事件 | 触发时机 | 典型用例 |
|------|----------|----------|
| `push` | 代码推送 | 自动构建、代码检查 |
| `pull_request` | PR 创建/更新/合并 | PR 审查、自动化测试 |
| `issues` | Issue 创建/更新/关闭 | Issue 追踪、任务分配 |
| `release` | Release 发布 | 发布通知、部署触发 |
| `check_run` | Check Run 状态变化 | CI 状态集成 |
| `check_suite` | Check Suite 状态变化 | CI 套件集成 |
| `workflow_run` | Workflow 运行状态 | GitHub Actions 集成 |
| `repository` | 仓库事件 | 仓库配置变更通知 |

## 安装

```bash
# 复制到插件目录
cp -r examples/plugins/github-trigger plugins/trigger/
```

## 配置

在 `clawkit.yaml` 中配置插件：

```yaml
plugins:
  triggers:
    - name: github-trigger
      enabled: true
      config:
        # Webhook 密钥（必须与 GitHub Webhook 设置一致）
        secretToken: "your-webhook-secret-at-least-20-chars"
        
        # 允许的事件类型
        allowedEvents:
          - push
          - pull_request
          - release
          - workflow_run
        
        # 允许的仓库（空表示所有仓库）
        allowedRepositories:
          - "owner/repo-name"
          - "owner/another-repo"
        
        # 允许的分支（空表示所有分支）
        allowedBranches:
          - main
          - develop
          - feature/*
        
        # 排除的分支
        deniedBranches:
          - gh-pages
        
        # 分支正则匹配（与 allowedBranches 互斥）
        branchPattern: "^(main|develop|feature/.*)$"
        
        # Action 过滤
        allowedActions:
          - opened
          - synchronize
          - closed
        
        # 排除的 Action
        deniedActions:
          - labeled
          - unlabeled
```

## GitHub Webhook 配置

### 1. 创建 Webhook

1. 进入仓库 → Settings → Webhooks
2. 点击 "Add webhook"
3. 配置以下内容：
   - **Payload URL**: `http://your-domain.com/api/triggers/github`
   - **Content type**: `application/json`
   - **Secret**: 与配置文件中的 `secretToken` 一致
   - **Events**: 选择要监听的事件

### 2. 生成 Webhook 密钥

```bash
# 使用 openssl 生成随机密钥
openssl rand -hex 20
```

### 3. 本地开发测试

使用 [smee.io](https://smee.io/) 进行本地开发测试：

```bash
# 1. 在 smee.io 创建通道，获取 Webhook Proxy URL
# 2. 将该 URL 作为 GitHub Webhook 的 Payload URL
# 3. 启动本地服务
npx smee -u https://smee.io/your-channel-id
```

## 使用示例

### 基本使用

```javascript
const GitHubTrigger = require('./github-trigger');

// 初始化
GitHubTrigger.initialize({
  secretToken: 'your-webhook-secret',
  allowedEvents: ['push', 'pull_request'],
  allowedRepositories: ['my-org/my-repo'],
  allowedBranches: ['main', 'develop'],
}, {});

// 注册事件处理器
GitHubTrigger.onTrigger((event) => {
  console.log('收到 GitHub 事件:', event.eventType);
  
  switch (event.eventType) {
    case 'push':
      console.log(`推送到 ${event.branch}`);
      console.log(`提交数: ${event.commits?.length || 0}`);
      break;
      
    case 'pull_request':
      console.log(`PR #${event.pullRequest.number}: ${event.pullRequest.title}`);
      console.log(`Action: ${event.pullRequest.action}`);
      break;
  }
});
```

### 签名验证

```javascript
// 在 Express 中处理 Webhook
const express = require('express');
const GitHubTrigger = require('./github-trigger');

const app = express();

app.post('/api/webhooks/github', express.json(), (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  
  // 手动验证签名
  const payload = JSON.stringify(req.body);
  const isValid = GitHubTrigger.verifySignature(payload, signature);
  
  if (!isValid) {
    return res.status(401).json({ error: '签名验证失败' });
  }
  
  // 处理事件
  GitHubTrigger.handleWebhook(req.body, req.headers)
    .then(result => {
      if (result.processed) {
        console.log('事件已处理:', result.event);
      }
      res.json({ success: true });
    })
    .catch(err => {
      console.error('处理失败:', err);
      res.status(500).json({ error: err.message });
    });
});
```

### 条件触发

```javascript
GitHubTrigger.onTrigger((event) => {
  // 只处理 main 分支的 push
  if (event.eventType === 'push' && event.branch === 'main') {
    // 触发构建任务
    triggerBuild(event);
  }
  
  // 只处理打开的 PR
  if (event.eventType === 'pull_request' && 
      event.pullRequest.action === 'opened') {
    // 触发代码审查
    triggerCodeReview(event);
  }
  
  // 只处理特定标签的 Issue
  if (event.eventType === 'issues' && 
      event.issue.labels.includes('bug')) {
    // 触发 Bug 修复工作流
    triggerBugFix(event);
  }
});
```

## 事件数据结构

### Push 事件

```javascript
{
  eventId: 'github-push-abc123...',
  eventType: 'push',
  source: 'github',
  timestamp: '2026-08-01T12:00:00.000Z',
  repository: {
    id: 123456,
    name: 'my-repo',
    fullName: 'my-org/my-repo',
    url: 'https://github.com/my-org/my-repo',
    private: true,
    defaultBranch: 'main'
  },
  branch: 'main',
  ref: 'refs/heads/main',
  before: 'abc123...',
  after: 'def456...',
  commits: [
    {
      sha: 'def456...',
      message: 'feat: add new feature',
      author: { name: 'John', email: 'john@example.com' },
      timestamp: '2026-08-01T12:00:00.000Z'
    }
  ],
  pusher: {
    name: 'john',
    email: 'john@example.com'
  },
  sender: {
    login: 'john',
    avatarUrl: 'https://avatars.githubusercontent.com/u/123',
    type: 'User'
  }
}
```

### Pull Request 事件

```javascript
{
  eventId: 'github-pr-123',
  eventType: 'pull_request',
  source: 'github',
  repository: {
    id: 123456,
    name: 'my-repo',
    fullName: 'my-org/my-repo'
  },
  pullRequest: {
    id: 123,
    number: 42,
    title: 'feat: add awesome feature',
    body: 'This PR adds...',
    state: 'open',
    action: 'opened',
    sourceBranch: 'feature/awesome',
    targetBranch: 'main',
    author: {
      login: 'john',
      avatarUrl: 'https://...'
    },
    labels: ['enhancement', 'needs-review'],
    reviewers: ['alice', 'bob'],
    additions: 150,
    deletions: 20,
    changedFiles: 5,
    merged: false
  },
  branch: 'feature/awesome'
}
```

### Workflow Run 事件

```javascript
{
  eventId: 'github-workflow-run-456',
  eventType: 'workflow_run',
  source: 'github',
  repository: {
    id: 123456,
    name: 'my-repo',
    fullName: 'my-org/my-repo'
  },
  workflow: {
    id: 123456,
    name: 'CI',
    path: '.github/workflows/ci.yml'
  },
  workflowRun: {
    id: 789,
    name: 'CI',
    headBranch: 'main',
    headSha: 'abc123...',
    status: 'completed',
    conclusion: 'success',
    action: 'completed',
    event: 'push'
  },
  branch: 'main'
}
```

## API 参考

### initialize(config, context)

初始化插件。

### handleWebhook(payload, headers)

处理传入的 Webhook 请求。

### verifySignature(payload, signature)

验证 GitHub Webhook 签名。

### onTrigger(handler)

注册事件处理器，返回取消订阅函数。

### healthCheck()

检查插件健康状态。

### validatePluginConfig(config)

验证插件配置是否有效。

### getMeta()

获取插件元信息。

## 安全说明

1. **始终验证签名**：生产环境必须配置 `secretToken` 并验证签名
2. **使用 HTTPS**：确保 Webhook 端点使用 HTTPS
3. **密钥长度**：GitHub 要求 Webhook 密钥至少 20 字符
4. **限制 IP**：可在 GitHub Webhook 设置中限制来源 IP

## 限制说明

- Webhook 超时：GitHub Webhook 超时时间为 30 秒
- 事件限制：每个仓库每小时最多 5000 个 Webhook
- 重试机制：GitHub 会自动重试失败的 Webhook 最多 72 小时

## 相关链接

- [GitHub Webhooks 文档](https://docs.github.com/en/developers/webhooks-and-events/webhooks)
- [GitHub Events 文档](https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads)
- [smee.io 本地开发](https://smee.io/)
- [ClawKit 文档](https://github.com/clawkit/clawkit)
