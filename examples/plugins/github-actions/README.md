# GitHub Actions 集成插件

GitHub Actions 集成插件，支持触发、监控和管理 GitHub Actions workflow，实现 CI/CD 自动化。

## 功能特性

- ✅ **Workflow 触发**：通过 API 触发 workflow 运行
- ✅ **运行监控**：实时监控 workflow 运行状态
- ✅ **日志获取**：获取完整的运行日志
- ✅ **运行管理**：取消、重新运行 workflow
- ✅ **Check Runs**：创建和管理 Check Runs
- ✅ **Webhook 集成**：处理 workflow_run、check_run 等事件

## 安装

```bash
# 复制到插件目录
cp -r examples/plugins/github-actions plugins/executor/
```

## 配置

在 `clawkit.yaml` 中配置插件：

```yaml
plugins:
  executors:
    - name: github-actions
      enabled: true
      config:
        # GitHub Token (或设置环境变量 GITHUB_TOKEN)
        token: "ghp_xxxxx"
        
        # 默认仓库
        owner: "my-org"
        repo: "my-repo"
        
        # 触发配置
        trigger:
          autoTrigger: false
          events: ["push", "pull_request"]
          branches: ["main", "develop"]
          excludeBranches: ["gh-pages"]
        
        # 通知配置
        notify:
          enabled: true
          onEvents: ["workflow_run", "check_run"]
```

## 获取 GitHub Token

### 方式一：Personal Access Token

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 勾选权限：
   - `repo` (完整仓库访问)
   - `workflow` (GitHub Actions)
   - `read:user` (用户信息)
4. 创建并复制 Token

### 方式二：GitHub App Token

需要创建一个 GitHub App 并配置私钥。

## 使用示例

### 基本使用

```javascript
const GitHubActions = require('./github-actions');

// 初始化
GitHubActions.initialize({
  token: process.env.GITHUB_TOKEN,
  owner: 'my-org',
  repo: 'my-repo',
});

// 触发 workflow
const result = await GitHubActions.triggerWorkflow({
  workflowId: 'ci.yml',
  ref: 'main',
  inputs: {
    environment: 'production',
  },
});
```

### 监控 Workflow 状态

```javascript
// 列出最近的 workflow runs
const runs = await GitHubActions.listWorkflowRuns({
  workflowId: 'ci.yml',
  status: 'completed',
});

console.log('最近完成的 runs:');
runs.runs.forEach(run => {
  console.log(`- ${run.name} (#${run.runNumber}): ${run.conclusion}`);
});
```

### 获取 Run 详情

```javascript
const run = await GitHubActions.getWorkflowRun({
  runId: 12345678,
});

console.log(`Run #${run.runNumber}: ${run.status} - ${run.conclusion}`);
console.log(`触发者: ${run.actor}`);
console.log(`分支: ${run.headBranch}`);
```

### 获取运行日志

```javascript
const { logs } = await GitHubActions.getRunLogs({
  runId: 12345678,
});

console.log(logs);
```

### 获取 Jobs 和 Steps

```javascript
const { jobs } = await GitHubActions.getRunJobs({
  runId: 12345678,
});

jobs.forEach(job => {
  console.log(`Job: ${job.name} - ${job.conclusion}`);
  job.steps?.forEach(step => {
    console.log(`  - ${step.number}. ${step.name}: ${step.conclusion}`);
  });
});
```

### 管理 Workflow Runs

```javascript
// 取消运行
await GitHubActions.cancelRun({ runId: 12345678 });

// 重新运行
await GitHubActions.rerunRun({ runId: 12345678 });
```

### Webhook 事件处理

```javascript
GitHubActions.onTrigger((event) => {
  if (event.eventType === 'workflow_run') {
    const { action, run } = event;
    
    console.log(`Workflow ${action}: ${run.name}`);
    
    if (action === 'completed') {
      if (run.conclusion === 'success') {
        console.log('✅ CI 通过，准备部署');
        // triggerDeploy();
      } else {
        console.log('❌ CI 失败，发送告警');
        // sendAlert(run);
      }
    }
  }
});

// 在 Express 中处理 webhook
app.post('/api/webhooks/github-actions', express.json(), async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  
  // 验证签名（如果配置了 secret）
  // if (!verifySignature(req.body, signature)) {
  //   return res.status(401).send('Invalid signature');
  // }
  
  const result = await GitHubActions.handleWebhook(req.body, req.headers);
  res.json(result);
});
```

### Check Runs 集成

```javascript
// 创建 Check Run
const checkRun = await GitHubActions.createCheckRun({
  name: 'clawkit-check',
  headSha: 'abc123...',
  detailsUrl: 'https://my-ci.example.com/run/123',
  status: 'in_progress',
  output: {
    title: 'ClawKit 检查中',
    summary: '正在进行代码检查...',
  },
});

// 更新 Check Run 状态
await GitHubActions.updateCheckRun({
  checkRunId: checkRun.id,
  status: 'completed',
  conclusion: 'success',
  output: {
    title: '检查完成',
    summary: '✅ 所有检查通过',
  },
});
```

## API 参考

### Workflow 操作

| 方法 | 说明 |
|------|------|
| `triggerWorkflow(options)` | 触发 workflow |
| `listWorkflows(options)` | 列出所有 workflows |
| `getWorkflow(options)` | 获取 workflow 详情 |
| `listWorkflowRuns(options)` | 列出 workflow runs |
| `getWorkflowRun(options)` | 获取 run 详情 |
| `cancelRun(options)` | 取消 run |
| `rerunRun(options)` | 重新运行 run |
| `getRunLogs(options)` | 获取运行日志 |
| `getRunJobs(options)` | 获取 run 的 jobs |

### Check Runs

| 方法 | 说明 |
|------|------|
| `getCheckRuns(options)` | 获取 check runs |
| `createCheckRun(options)` | 创建 check run |
| `updateCheckRun(options)` | 更新 check run |

### Webhook

| 方法 | 说明 |
|------|------|
| `handleWebhook(payload, headers)` | 处理 webhook 事件 |
| `onTrigger(handler)` | 注册事件处理器 |

### 工具

| 方法 | 说明 |
|------|------|
| `healthCheck()` | 健康检查 |
| `validatePluginConfig(config)` | 验证配置 |
| `getMeta()` | 获取插件元信息 |

## 事件数据结构

### workflow_run 事件

```javascript
{
  eventId: 'github-actions-12345678',
  eventType: 'workflow_run',
  source: 'github-actions',
  action: 'completed',
  repository: {
    id: 123456,
    name: 'my-repo',
    fullName: 'my-org/my-repo'
  },
  run: {
    id: 12345678,
    name: 'CI',
    headBranch: 'feature/new-feature',
    headSha: 'abc123...',
    status: 'completed',
    conclusion: 'success',
    event: 'push',
    runNumber: 42,
    createdAt: '2026-08-03T10:00:00Z',
    htmlUrl: 'https://github.com/my-org/my-repo/actions/runs/12345678'
  }
}
```

## 常见问题

### Q1: Token 权限不足？

确保 Token 具有以下权限：
- `repo` - 仓库访问
- `workflow` - GitHub Actions

### Q2: workflow 没有触发？

1. 检查 workflow 是否配置了 `workflow_dispatch` 触发器
2. 检查 Token 是否有仓库访问权限
3. 检查 ref 分支是否存在

### Q3: 如何获取 workflow ID？

```javascript
const { workflows } = await GitHubActions.listWorkflows();
workflows.forEach(w => {
  console.log(`${w.name}: ${w.id}`);
});
```

## 安全说明

1. **Token 安全**：不要将 Token 提交到代码仓库，使用环境变量
2. **权限最小化**：只申请必要的 Token 权限
3. **日志处理**：运行日志可能包含敏感信息，注意保护

## 相关链接

- [GitHub Actions API 文档](https://docs.github.com/en/rest/actions)
- [GitHub API 概览](https://docs.github.com/en/rest/overview)
- [Personal Access Tokens](https://github.com/settings/tokens)
