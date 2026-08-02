/**
 * GitHub 触发器插件
 * 
 * 支持监听 GitHub Webhook 事件触发任务
 * 支持 Push、Pull Request、Release、Check Run、Workflow 等事件
 */

const crypto = require('crypto');

/**
 * 插件元信息
 */
const meta = {
  name: 'github-trigger',
  version: '1.0.0',
  type: 'trigger',
  description: 'GitHub Webhook 触发器，支持 Push、PR、Release、Workflow 等事件',
  author: 'ClawKit Team',
  homepage: 'https://github.com/clawkit/clawkit',
  keywords: ['github', 'trigger', 'webhook', 'ci', 'cd', 'actions'],
};

/**
 * 插件配置
 */
let config = {
  // Webhook 密钥
  secretToken: '',
  
  // 事件过滤
  allowedEvents: ['push', 'pull_request', 'release', 'check_run', 'workflow_run', 'issues'],
  allowedRepositories: [], // 空表示所有仓库，如: ['owner/repo', 'owner/repo2']
  allowedBranches: [], // 空表示所有分支
  deniedBranches: [], // 排除的分支
  
  // 自定义规则（正则表达式）
  branchPattern: '', // 如: ^(main|develop|feature/.*)$
  
  // 高级过滤
  allowedActions: [], // 特定 action，如 ['opened', 'synchronize']
  deniedActions: [], // 排除的 action
  
  // GitHub App 配置（可选）
  appId: '',
  appPrivateKey: '',
  webhooksSecret: '',
};

/**
 * 上下文
 */
let context = {};
let eventHandlers = [];

/**
 * 支持的事件类型
 */
const SUPPORTED_EVENTS = [
  'push',
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment',
  'issues',
  'issue_comment',
  'release',
  'check_run',
  'check_suite',
  'workflow_run',
  'workflow_dispatch',
  'repository',
  'create',
  'delete',
  'fork',
  'star',
];

/**
 * 初始化插件
 * @param {Object} pluginConfig - 插件配置
 * @param {Object} pluginContext - 插件上下文
 */
function initialize(pluginConfig, pluginContext) {
  config = {
    secretToken: pluginConfig.secretToken || '',
    allowedEvents: pluginConfig.allowedEvents || ['push', 'pull_request', 'release'],
    allowedRepositories: pluginConfig.allowedRepositories || [],
    allowedBranches: pluginConfig.allowedBranches || [],
    deniedBranches: pluginConfig.deniedBranches || [],
    branchPattern: pluginConfig.branchPattern || '',
    allowedActions: pluginConfig.allowedActions || [],
    deniedActions: pluginConfig.deniedActions || [],
    appId: pluginConfig.appId || '',
    appPrivateKey: pluginConfig.appPrivateKey || '',
    webhooksSecret: pluginConfig.webhooksSecret || pluginConfig.secretToken || '',
    ...pluginConfig,
  };
  context = pluginContext || {};
  eventHandlers = [];
  
  console.log('[GitHubTrigger] 插件初始化完成');
  console.log(`[GitHubTrigger] 监听事件: ${config.allowedEvents.join(', ')}`);
}

/**
 * 验证 Webhook 签名
 * GitHub 使用 HMAC-SHA256 签名
 * @param {string|Buffer} payload - 请求体
 * @param {string} signature - 签名头（sha256=xxx）
 * @returns {boolean}
 */
function verifySignature(payload, signature) {
  if (!config.secretToken && !config.webhooksSecret) {
    return true; // 没有配置密钥时不验证
  }
  
  const secret = config.secretToken || config.webhooksSecret;
  
  if (!signature) {
    return false;
  }
  
  const payloadBuffer = typeof payload === 'string' ? Buffer.from(payload) : payload;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadBuffer);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;
  
  try {
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    console.error('[GitHubTrigger] 签名验证失败:', error.message);
    return false;
  }
}

/**
 * 解析 Push 事件
 * @param {Object} event - 事件数据
 * @param {Object} headers - 请求头
 */
function parsePushEvent(event, headers) {
  const repository = event.repository || {};
  const ref = event.ref || '';
  const branch = ref.replace('refs/heads/', '');
  
  return {
    eventId: `github-push-${event.after || Date.now()}`,
    eventType: 'push',
    source: 'github',
    timestamp: new Date(event.head_commit?.timestamp || Date.now()).toISOString(),
    repository: {
      id: repository.id,
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
      private: repository.private,
      defaultBranch: repository.default_branch,
    },
    branch,
    ref,
    before: event.before,
    after: event.after,
    commits: (event.commits || []).map(c => ({
      sha: c.id,
      message: c.message,
      author: c.author?.name || c.author?.username || '',
      email: c.author?.email || '',
      timestamp: c.timestamp,
      url: c.url,
    })),
    pusher: {
      name: event.pusher?.name || '',
      email: event.pusher?.email || '',
    },
    sender: {
      login: event.sender?.login || '',
      avatarUrl: event.sender?.avatar_url || '',
      type: event.sender?.type || '',
    },
    action: event.created || event.deleted ? (event.created ? 'created' : 'deleted') : 'push',
    raw: event,
  };
}

/**
 * 解析 Pull Request 事件
 * @param {Object} event - 事件数据
 * @param {Object} headers - 请求头
 */
function parsePullRequestEvent(event, headers) {
  const repository = event.repository || {};
  const pullRequest = event.pull_request || {};
  
  return {
    eventId: `github-pr-${pullRequest.id || Date.now()}`,
    eventType: 'pull_request',
    source: 'github',
    timestamp: new Date(event.updated_at || Date.now()).toISOString(),
    repository: {
      id: repository.id,
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
      private: repository.private,
    },
    pullRequest: {
      id: pullRequest.id,
      number: pullRequest.number,
      title: pullRequest.title,
      body: pullRequest.body,
      state: pullRequest.state,
      action: event.action,
      htmlUrl: pullRequest.html_url,
      diffUrl: pullRequest.diff_url,
      patchUrl: pullRequest.patch_url,
      sourceBranch: pullRequest.head?.ref || '',
      targetBranch: pullRequest.base?.ref || '',
      author: {
        login: pullRequest.user?.login || '',
        avatarUrl: pullRequest.user?.avatar_url || '',
      },
      labels: (pullRequest.labels || []).map(l => l.name),
      reviewers: (pullRequest.requested_reviewers || []).map(r => r.login),
      reviewTeams: (pullRequest.requested_teams || []).map(t => t.name),
      additions: pullRequest.additions || 0,
      deletions: pullRequest.deletions || 0,
      changedFiles: pullRequest.changed_files || 0,
      merged: pullRequest.merged || false,
      mergeable: pullRequest.mergeable,
      rebaseable: pullRequest.rebaseable,
      mergeableState: pullRequest.mergeable_state,
    },
    branch: pullRequest.head?.ref || '',
    sender: {
      login: event.sender?.login || '',
      avatarUrl: event.sender?.avatar_url || '',
      type: event.sender?.type || '',
    },
    raw: event,
  };
}

/**
 * 解析 Issues 事件
 * @param {Object} event - 事件数据
 * @param {Object} headers - 请求头
 */
function parseIssuesEvent(event, headers) {
  const repository = event.repository || {};
  const issue = event.issue || {};
  
  return {
    eventId: `github-issue-${issue.id || Date.now()}`,
    eventType: 'issues',
    source: 'github',
    timestamp: new Date(issue.updated_at || Date.now()).toISOString(),
    repository: {
      id: repository.id,
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
      private: repository.private,
    },
    issue: {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      action: event.action,
      htmlUrl: issue.html_url,
      author: {
        login: issue.user?.login || '',
        avatarUrl: issue.user?.avatar_url || '',
      },
      labels: (issue.labels || []).map(l => l.name),
      assignees: (issue.assignees || []).map(a => a.login),
      milestone: issue.milestone?.title || null,
      comments: issue.comments || 0,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      closedAt: issue.closed_at,
    },
    sender: {
      login: event.sender?.login || '',
      avatarUrl: event.sender?.avatar_url || '',
      type: event.sender?.type || '',
    },
    raw: event,
  };
}

/**
 * 解析 Release 事件
 * @param {Object} event - 事件数据
 * @param {Object} headers - 请求头
 */
function parseReleaseEvent(event, headers) {
  const repository = event.repository || {};
  const release = event.release || {};
  
  return {
    eventId: `github-release-${release.id || Date.now()}`,
    eventType: 'release',
    source: 'github',
    timestamp: new Date(release.published_at || Date.now()).toISOString(),
    repository: {
      id: repository.id,
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
      private: repository.private,
    },
    release: {
      id: release.id,
      tagName: release.tag_name,
      targetCommitish: release.target_commitish,
      name: release.name || release.tag_name,
      body: release.body,
      draft: release.draft || false,
      prerelease: release.prerelease || false,
      action: event.action,
      htmlUrl: release.html_url,
      tarballUrl: release.tarball_url,
      zipballUrl: release.zipball_url,
      author: {
        login: release.author?.login || '',
        avatarUrl: release.author?.avatar_url || '',
      },
    },
    sender: {
      login: event.sender?.login || '',
      avatarUrl: event.sender?.avatar_url || '',
      type: event.sender?.type || '',
    },
    raw: event,
  };
}

/**
 * 解析 Check Run 事件
 * @param {Object} event - 事件数据
 * @param {Object} headers - 请求头
 */
function parseCheckRunEvent(event, headers) {
  const repository = event.repository || {};
  const checkRun = event.check_run || {};
  
  return {
    eventId: `github-check-run-${checkRun.id || Date.now()}`,
    eventType: 'check_run',
    source: 'github',
    timestamp: new Date(checkRun.started_at || Date.now()).toISOString(),
    repository: {
      id: repository.id,
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
      private: repository.private,
    },
    checkRun: {
      id: checkRun.id,
      name: checkRun.name,
      headSha: checkRun.head_sha,
      status: checkRun.status,
      conclusion: checkRun.conclusion,
      action: event.action,
      htmlUrl: checkRun.html_url,
      externalId: checkRun.external_id,
      checkSuiteId: checkRun.check_suite?.id,
    },
    branch: checkRun.check_suite?.head_branch || '',
    sender: {
      login: event.sender?.login || '',
      avatarUrl: event.sender?.avatar_url || '',
      type: event.sender?.type || '',
    },
    raw: event,
  };
}

/**
 * 解析 Workflow Run 事件
 * @param {Object} event - 事件数据
 * @param {Object} headers - 请求头
 */
function parseWorkflowRunEvent(event, headers) {
  const repository = event.repository || {};
  const workflowRun = event.workflow_run || {};
  const workflow = event.workflow || {};
  
  return {
    eventId: `github-workflow-run-${workflowRun.id || Date.now()}`,
    eventType: 'workflow_run',
    source: 'github',
    timestamp: new Date(workflowRun.created_at || Date.now()).toISOString(),
    repository: {
      id: repository.id,
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
      private: repository.private,
    },
    workflow: {
      id: workflow.id || workflowRun.workflow_id,
      name: workflow.name || workflowRun.name,
      path: workflow.path,
      htmlUrl: workflow.html_url,
    },
    workflowRun: {
      id: workflowRun.id,
      name: workflowRun.name,
      headBranch: workflowRun.head_branch,
      headSha: workflowRun.head_sha,
      status: workflowRun.status,
      conclusion: workflowRun.conclusion,
      action: event.action,
      htmlUrl: workflowRun.html_url,
      jobsUrl: workflowRun.jobs_url,
      event: workflowRun.event,
    },
    branch: workflowRun.head_branch || '',
    sender: {
      login: event.sender?.login || '',
      avatarUrl: event.sender?.avatar_url || '',
      type: event.sender?.type || '',
    },
    raw: event,
  };
}

/**
 * 解析 Check Suite 事件
 * @param {Object} event - 事件数据
 * @param {Object} headers - 请求头
 */
function parseCheckSuiteEvent(event, headers) {
  const repository = event.repository || {};
  const checkSuite = event.check_suite || {};
  
  return {
    eventId: `github-check-suite-${checkSuite.id || Date.now()}`,
    eventType: 'check_suite',
    source: 'github',
    timestamp: new Date(checkSuite.updated_at || Date.now()).toISOString(),
    repository: {
      id: repository.id,
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
      private: repository.private,
    },
    checkSuite: {
      id: checkSuite.id,
      headSha: checkSuite.head_sha,
      status: checkSuite.status,
      conclusion: checkSuite.conclusion,
      action: event.action,
      appId: checkSuite.app?.id,
      appName: checkSuite.app?.name || checkSuite.app?.slug,
      createdAt: checkSuite.created_at,
    },
    branch: checkSuite.head_branch || '',
    sender: {
      login: event.sender?.login || '',
      avatarUrl: event.sender?.avatar_url || '',
      type: event.sender?.type || '',
    },
    raw: event,
  };
}

/**
 * 解析 Repository 事件
 * @param {Object} event - 事件数据
 * @param {Object} headers - 请求头
 */
function parseRepositoryEvent(event, headers) {
  const repository = event.repository || {};
  
  return {
    eventId: `github-repo-${repository.id || Date.now()}`,
    eventType: 'repository',
    source: 'github',
    timestamp: new Date(event.updated_at || Date.now()).toISOString(),
    repository: {
      id: repository.id,
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
      private: repository.private,
      description: repository.description,
      fork: repository.fork,
      action: event.action,
    },
    sender: {
      login: event.sender?.login || '',
      avatarUrl: event.sender?.avatar_url || '',
      type: event.sender?.type || '',
    },
    raw: event,
  };
}

/**
 * 解析事件
 * @param {string} eventType - 事件类型
 * @param {Object} event - 事件数据
 * @param {Object} headers - 请求头
 */
function parseEvent(eventType, event, headers) {
  switch (eventType) {
    case 'push':
      return parsePushEvent(event, headers);
    case 'pull_request':
      return parsePullRequestEvent(event, headers);
    case 'issues':
      return parseIssuesEvent(event, headers);
    case 'release':
      return parseReleaseEvent(event, headers);
    case 'check_run':
      return parseCheckRunEvent(event, headers);
    case 'workflow_run':
      return parseWorkflowRunEvent(event, headers);
    case 'check_suite':
      return parseCheckSuiteEvent(event, headers);
    case 'repository':
      return parseRepositoryEvent(event, headers);
    default:
      return {
        eventId: `github-${eventType}-${Date.now()}`,
        eventType,
        source: 'github',
        timestamp: new Date().toISOString(),
        repository: {
          id: event.repository?.id,
          name: event.repository?.name,
          fullName: event.repository?.full_name,
          url: event.repository?.html_url,
        },
        sender: {
          login: event.sender?.login || '',
          avatarUrl: event.sender?.avatar_url || '',
        },
        raw: event,
      };
  }
}

/**
 * 过滤事件
 * @param {Object} parsedEvent - 解析后的事件
 * @returns {Object} { allowed: boolean, reason?: string }
 */
function shouldProcessEvent(parsedEvent) {
  // 检查事件类型
  if (!config.allowedEvents.includes(parsedEvent.eventType)) {
    return { allowed: false, reason: `事件类型 ${parsedEvent.eventType} 不在允许列表中` };
  }
  
  // 检查仓库
  if (config.allowedRepositories.length > 0) {
    const repoFullName = parsedEvent.repository?.fullName || '';
    if (!config.allowedRepositories.some(r => repoFullName === r || repoFullName.endsWith('/' + r))) {
      return { allowed: false, reason: `仓库 ${repoFullName} 不在允许列表中` };
    }
  }
  
  // 获取分支
  const branch = parsedEvent.branch || 
                 parsedEvent.pullRequest?.sourceBranch || 
                 parsedEvent.workflowRun?.headBranch || '';
  
  if (branch) {
    // 排除分支
    if (config.deniedBranches.includes(branch)) {
      return { allowed: false, reason: `分支 ${branch} 在排除列表中` };
    }
    
    // 白名单分支
    if (config.allowedBranches.length > 0 && !config.allowedBranches.includes(branch)) {
      return { allowed: false, reason: `分支 ${branch} 不在允许列表中` };
    }
    
    // 正则匹配
    if (config.branchPattern) {
      try {
        const regex = new RegExp(config.branchPattern);
        if (!regex.test(branch)) {
          return { allowed: false, reason: `分支 ${branch} 不符合模式 ${config.branchPattern}` };
        }
      } catch (e) {
        console.warn('[GitHubTrigger] 无效的正则表达式:', config.branchPattern);
      }
    }
  }
  
  // 检查 action
  const action = parsedEvent.action || 
                parsedEvent.pullRequest?.action || 
                parsedEvent.issue?.action || 
                parsedEvent.checkRun?.action || 
                parsedEvent.checkSuite?.action ||
                parsedEvent.workflowRun?.action;
  
  if (action) {
    // 排除的 action
    if (config.deniedActions.length > 0 && config.deniedActions.includes(action)) {
      return { allowed: false, reason: `Action ${action} 在排除列表中` };
    }
    
    // 白名单 action
    if (config.allowedActions.length > 0 && !config.allowedActions.includes(action)) {
      return { allowed: false, reason: `Action ${action} 不在允许列表中` };
    }
  }
  
  return { allowed: true };
}

/**
 * 处理 Webhook 事件
 * @param {string|Object} payload - 请求体
 * @param {Object} headers - 请求头
 * @returns {Promise<Object>}
 */
async function handleWebhook(payload, headers) {
  // 获取事件类型
  const githubEvent = headers['x-github-event'] || headers['x-github-event-type'];
  
  if (!githubEvent) {
    return {
      success: false,
      error: '缺少 GitHub 事件类型头 (x-github-event)',
    };
  }
  
  // 验证签名
  const signature = headers['x-hub-signature-256'] || headers['x-hub-signature'];
  const rawPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
  
  if (!verifySignature(rawPayload, signature)) {
    console.warn('[GitHubTrigger] Webhook 签名验证失败');
    return {
      success: false,
      error: '签名验证失败',
    };
  }
  
  // 解析 payload
  let event;
  try {
    event = typeof payload === 'string' ? JSON.parse(payload) : payload;
  } catch (error) {
    return {
      success: false,
      error: '无效的 JSON payload',
    };
  }
  
  // 跳过 ping 事件
  if (githubEvent === 'ping') {
    return {
      success: true,
      processed: false,
      message: 'Pong! GitHub Webhook 连接成功',
      zen: event.zen || '',
      hookId: event.hook_id || '',
    };
  }
  
  // 跳过删除事件（可选）
  if (githubEvent === 'delete' && !config.allowedEvents.includes('delete')) {
    return {
      success: true,
      processed: false,
      reason: '跳过 delete 事件',
    };
  }
  
  // 解析事件
  let parsedEvent;
  try {
    parsedEvent = parseEvent(githubEvent, event, headers);
  } catch (error) {
    console.error('[GitHubTrigger] 解析事件失败:', error);
    return {
      success: false,
      error: `解析事件失败: ${error.message}`,
    };
  }
  
  // 过滤事件
  const filterResult = shouldProcessEvent(parsedEvent);
  if (!filterResult.allowed) {
    return {
      success: true,
      processed: false,
      reason: filterResult.reason,
    };
  }
  
  // 触发处理器
  for (const handler of eventHandlers) {
    try {
      await handler(parsedEvent);
    } catch (error) {
      console.error('[GitHubTrigger] 处理器执行失败:', error);
    }
  }
  
  return {
    success: true,
    processed: true,
    event: parsedEvent,
  };
}

/**
 * 注册事件处理器
 * @param {Function} handler - 事件处理器
 * @returns {Function} 取消订阅函数
 */
function onTrigger(handler) {
  eventHandlers.push(handler);
  return () => {
    const index = eventHandlers.indexOf(handler);
    if (index > -1) {
      eventHandlers.splice(index, 1);
    }
  };
}

/**
 * 取消特定任务
 * @param {string} taskId - 任务 ID
 */
function onCancel(taskId) {
  console.log(`[GitHubTrigger] 取消任务: ${taskId}`);
  // 可以实现取消逻辑，如终止 GitHub Actions workflow
}

/**
 * 健康检查
 * @returns {Promise<Object>}
 */
async function healthCheck() {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config: {
      hasSecretToken: !!(config.secretToken || config.webhooksSecret),
      allowedEvents: config.allowedEvents,
      hasRepositoryFilter: config.allowedRepositories.length > 0,
      hasBranchFilter: config.allowedBranches.length > 0 || !!config.branchPattern,
      hasActionFilter: config.allowedActions.length > 0 || config.deniedActions.length > 0,
    },
    capabilities: SUPPORTED_EVENTS,
  };
}

/**
 * 验证配置
 * @param {Object} pluginConfig - 插件配置
 * @returns {Object} { valid, errors?, warnings? }
 */
function validatePluginConfig(pluginConfig) {
  const errors = [];
  const warnings = [];
  
  if (!pluginConfig) {
    errors.push('配置不能为空');
    return { valid: false, errors };
  }
  
  // 验证事件类型
  if (pluginConfig.allowedEvents) {
    for (const event of pluginConfig.allowedEvents) {
      if (!SUPPORTED_EVENTS.includes(event)) {
        warnings.push(`未知的事件类型: ${event}，可能不被支持`);
      }
    }
  }
  
  // 验证分支正则
  if (pluginConfig.branchPattern) {
    try {
      new RegExp(pluginConfig.branchPattern);
    } catch (e) {
      errors.push('branchPattern 不是有效的正则表达式');
    }
  }
  
  // 验证仓库格式
  if (pluginConfig.allowedRepositories) {
    for (const repo of pluginConfig.allowedRepositories) {
      if (!repo.includes('/')) {
        errors.push(`仓库格式无效: ${repo}，应为 owner/repo 格式`);
      }
    }
  }
  
  // 检查密钥长度（GitHub 要求至少 20 字符）
  if (pluginConfig.secretToken && pluginConfig.secretToken.length < 20) {
    warnings.push('Webhook 密钥长度建议至少 20 字符');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * 获取插件元信息
 * @returns {Object}
 */
function getMeta() {
  return {
    ...meta,
    supportedEvents: SUPPORTED_EVENTS,
    capabilities: [
      { type: 'push', description: '监听代码推送事件' },
      { type: 'pull_request', description: '监听 Pull Request 事件' },
      { type: 'issues', description: '监听 Issue 事件' },
      { type: 'release', description: '监听 Release 发布' },
      { type: 'check_run', description: '监听 Check Run 状态' },
      { type: 'check_suite', description: '监听 Check Suite 状态' },
      { type: 'workflow_run', description: '监听 Workflow 运行' },
      { type: 'repository', description: '监听仓库事件' },
      { type: 'filter', description: '支持仓库、分支、Action 过滤' },
      { type: 'signature', description: '支持 HMAC-SHA256 签名验证' },
    ],
    supportedActions: {
      pull_request: ['opened', 'closed', 'synchronize', 'edited', 'labeled', 'unlabeled'],
      issues: ['opened', 'closed', 'edited', 'deleted', 'transferred', 'pinned', 'unpinned'],
      release: ['published', 'created', 'edited', 'deleted', 'prereleased', 'released'],
      check_run: ['created', 'completed', 'rerequested', 'requested_action'],
      check_suite: ['completed', 'requested', 'rerequested'],
      workflow_run: ['completed', 'requested', 'in_progress', 'queued'],
    },
  };
}

/**
 * 获取支持的 GitHub API 操作
 * @returns {Object}
 */
function getGitHubApi() {
  return {
    // GitHub API 基础 URL
    apiUrl: 'https://api.github.com',
    
    // 常用 API 端点
    endpoints: {
      // 仓库
      getRepository: (owner, repo) => `GET /repos/${owner}/${repo}`,
      listPullRequests: (owner, repo) => `GET /repos/${owner}/${repo}/pulls`,
      createCheckRun: (owner, repo) => `POST /repos/${owner}/${repo}/check-runs`,
      createCheckSuite: (owner, repo) => `POST /repos/${owner}/${repo}/check-suites`,
      
      // Workflow
      listWorkflowRuns: (owner, repo) => `GET /repos/${owner}/${repo}/actions/runs`,
      triggerWorkflow: (owner, repo, workflowId) => `POST /repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
      
      // Issues & PRs
      createIssue: (owner, repo) => `POST /repos/${owner}/${repo}/issues`,
      createComment: (owner, repo, issueNumber) => `POST /repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      
      // Deployments
      createDeployment: (owner, repo) => `POST /repos/${owner}/${repo}/deployments`,
      createDeploymentStatus: (owner, repo, deploymentId) => `POST /repos/${owner}/${repo}/deployments/${deploymentId}/statuses`,
    },
  };
}

/**
 * 销毁插件
 */
async function dispose() {
  config = {};
  context = {};
  eventHandlers = [];
  console.log('[GitHubTrigger] 插件已销毁');
}

// 导出插件
module.exports = {
  meta,
  initialize,
  handleWebhook,
  verifySignature,
  onTrigger,
  onCancel,
  healthCheck,
  validateConfig: validatePluginConfig,
  getMeta,
  getGitHubApi,
  dispose,
};

// ES Module 兼容
module.exports.default = module.exports;
