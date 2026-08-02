/**
 * GitLab 触发器插件
 * 
 * 支持监听 GitLab Webhook 事件触发任务
 * 支持 Push、Merge Request、Tag、Pipeline 等事件
 */

const crypto = require('crypto');

/**
 * 插件元信息
 */
const meta = {
  name: 'gitlab-trigger',
  version: '1.0.0',
  type: 'trigger',
  description: 'GitLab Webhook 触发器，支持 Push、MR、Pipeline 等事件',
  author: 'ClawKit Team',
  homepage: 'https://github.com/clawkit/clawkit',
  keywords: ['gitlab', 'trigger', 'webhook', 'ci', 'cd'],
};

/**
 * 插件配置
 */
let config = {
  // Webhook 密钥
  secretToken: '',
  
  // 事件过滤
  allowedEvents: ['push', 'merge_request', 'tag_push', 'pipeline'],
  allowedProjects: [], // 空表示所有项目
  allowedBranches: [], // 空表示所有分支
  
  // 自定义规则（正则表达式）
  branchPattern: '', // 如: ^(main|develop|feature/.*)$
  excludeBranches: [], // 排除的分支
};

let context = {};
let eventHandlers = [];

/**
 * 初始化插件
 */
function initialize(pluginConfig, pluginContext) {
  config = {
    secretToken: pluginConfig.secretToken || '',
    allowedEvents: pluginConfig.allowedEvents || ['push', 'merge_request', 'tag_push', 'pipeline'],
    allowedProjects: pluginConfig.allowedProjects || [],
    allowedBranches: pluginConfig.allowedBranches || [],
    branchPattern: pluginConfig.branchPattern || '',
    excludeBranches: pluginConfig.excludeBranches || [],
    ...pluginConfig,
  };
  context = pluginContext;
  eventHandlers = [];
  
  console.log('[GitLabTrigger] 插件初始化完成');
}

/**
 * 验证 Webhook 签名
 */
function verifySignature(payload, signature) {
  if (!config.secretToken) {
    return true; // 没有配置密钥时不验证
  }
  
  if (!signature) {
    return false;
  }
  
  const hmac = crypto.createHmac('sha256', config.secretToken);
  hmac.update(payload);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * 解析 Push 事件
 */
function parsePushEvent(event, headers) {
  const project = event.project || {};
  const ref = event.ref || '';
  const branch = ref.replace('refs/heads/', '');
  
  return {
    eventId: `gitlab-${event.checkout_sha || Date.now()}`,
    eventType: 'push',
    source: 'gitlab',
    timestamp: new Date(event.timestamp || Date.now()).toISOString(),
    project: {
      id: project.id,
      name: project.name,
      path: project.path_with_namespace,
      url: project.web_url,
    },
    branch,
    commit: {
      sha: event.checkout_sha,
      message: event.commits?.[0]?.message || '',
      author: event.user_name,
      count: event.total_commits_count || 0,
    },
    pusher: {
      name: event.user_name,
      email: event.user_email,
    },
    raw: event,
  };
}

/**
 * 解析 Merge Request 事件
 */
function parseMergeRequestEvent(event, headers) {
  const project = event.project || event.repository || {};
  const mr = event.object_attributes || {};
  
  return {
    eventId: `gitlab-mr-${mr.iid || Date.now()}`,
    eventType: 'merge_request',
    source: 'gitlab',
    timestamp: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      path: project.path_with_namespace,
      url: project.web_url,
    },
    mergeRequest: {
      id: mr.iid,
      title: mr.title,
      description: mr.description,
      sourceBranch: mr.source_branch,
      targetBranch: mr.target_branch,
      state: mr.state,
      action: mr.action,
      url: mr.url || mr.link || '',
      author: event.user?.name || event.user?.username || '',
    },
    branch: mr.source_branch,
    raw: event,
  };
}

/**
 * 解析 Pipeline 事件
 */
function parsePipelineEvent(event, headers) {
  const project = event.project || {};
  const pipeline = event.object_attributes || {};
  
  return {
    eventId: `gitlab-pipeline-${pipeline.id || Date.now()}`,
    eventType: 'pipeline',
    source: 'gitlab',
    timestamp: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      path: project.path_with_namespace,
      url: project.web_url,
    },
    pipeline: {
      id: pipeline.id,
      status: pipeline.status,
      ref: pipeline.ref,
      stages: event.builds?.map(b => b.stage) || [],
    },
    branch: pipeline.ref,
    raw: event,
  };
}

/**
 * 解析 Tag 事件
 */
function parseTagEvent(event, headers) {
  const project = event.project || {};
  
  return {
    eventId: `gitlab-tag-${event.ref || Date.now()}`,
    eventType: 'tag_push',
    source: 'gitlab',
    timestamp: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      path: project.path_with_namespace,
      url: project.web_url,
    },
    tag: event.ref?.replace('refs/tags/', ''),
    ref: event.ref,
    before: event.before,
    after: event.after,
    pusher: {
      name: event.user_name,
      email: event.user_email,
    },
    raw: event,
  };
}

/**
 * 过滤事件
 */
function shouldProcessEvent(parsedEvent) {
  // 检查事件类型
  if (!config.allowedEvents.includes(parsedEvent.eventType)) {
    return { allowed: false, reason: `事件类型 ${parsedEvent.eventType} 不在允许列表中` };
  }
  
  // 检查项目
  if (config.allowedProjects.length > 0) {
    const projectPath = parsedEvent.project?.path || '';
    if (!config.allowedProjects.some(p => projectPath.includes(p))) {
      return { allowed: false, reason: `项目 ${projectPath} 不在允许列表中` };
    }
  }
  
  // 检查分支
  const branch = parsedEvent.branch || parsedEvent.tag || '';
  if (branch) {
    // 排除分支
    if (config.excludeBranches.includes(branch)) {
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
        console.warn('[GitLabTrigger] 无效的正则表达式:', config.branchPattern);
      }
    }
  }
  
  return { allowed: true };
}

/**
 * 处理 Webhook 事件
 */
async function handleWebhook(payload, headers) {
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
  
  // 获取事件类型
  const gitlabEvent = headers['x-gitlab-event'] || headers['x-gitlab-event-type'];
  
  // 根据事件类型解析
  let parsedEvent;
  switch (gitlabEvent) {
    case 'Push Hook':
      parsedEvent = parsePushEvent(event, headers);
      break;
    case 'Merge Request Hook':
      parsedEvent = parseMergeRequestEvent(event, headers);
      break;
    case 'Pipeline Hook':
      parsedEvent = parsePipelineEvent(event, headers);
      break;
    case 'Tag Push Hook':
      parsedEvent = parseTagEvent(event, headers);
      break;
    default:
      return {
        success: false,
        error: `未知的事件类型: ${gitlabEvent}`,
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
      console.error('[GitLabTrigger] 处理器执行失败:', error);
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
 */
function onCancel(taskId) {
  console.log(`[GitLabTrigger] 取消任务: ${taskId}`);
  // 可以实现取消逻辑，如终止正在运行的 CI 流水线
}

/**
 * 健康检查
 */
async function healthCheck() {
  return {
    status: 'healthy',
    config: {
      hasSecretToken: !!config.secretToken,
      allowedEvents: config.allowedEvents,
      hasProjectFilter: config.allowedProjects.length > 0,
      hasBranchFilter: config.allowedBranches.length > 0 || !!config.branchPattern,
    },
  };
}

/**
 * 验证配置
 */
function validatePluginConfig(pluginConfig) {
  const errors = [];
  const warnings = [];
  
  if (!pluginConfig) {
    errors.push('配置不能为空');
    return { valid: false, errors };
  }
  
  const validEvents = ['push', 'merge_request', 'tag_push', 'pipeline', 'note', 'issue', 'job'];
  if (pluginConfig.allowedEvents) {
    for (const event of pluginConfig.allowedEvents) {
      if (!validEvents.includes(event)) {
        warnings.push(`未知的事件类型: ${event}`);
      }
    }
  }
  
  if (pluginConfig.branchPattern) {
    try {
      new RegExp(pluginConfig.branchPattern);
    } catch (e) {
      errors.push('branchPattern 不是有效的正则表达式');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * 获取插件元信息
 */
function getMeta() {
  return {
    ...meta,
    supportedEvents: config.allowedEvents,
    capabilities: [
      { type: 'push', description: '监听代码推送事件' },
      { type: 'merge_request', description: '监听 Merge Request 事件' },
      { type: 'pipeline', description: '监听流水线状态变化' },
      { type: 'tag_push', description: '监听标签推送事件' },
      { type: 'filter', description: '支持项目和分支过滤' },
    ],
  };
}

/**
 * 销毁插件
 */
async function dispose() {
  config = {};
  context = {};
  eventHandlers = [];
  console.log('[GitLabTrigger] 插件已销毁');
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
  dispose,
};

// ES Module 兼容
module.exports.default = module.exports;
