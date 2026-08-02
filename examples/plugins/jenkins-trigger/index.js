/**
 * Jenkins 触发器插件
 * 
 * 支持监听 Jenkins Webhook 事件触发任务
 * 支持 Build、Stage、Step 等事件
 */

const crypto = require('crypto');

/**
 * 插件元信息
 */
const meta = {
  name: 'jenkins-trigger',
  version: '1.0.0',
  type: 'trigger',
  description: 'Jenkins Webhook 触发器，支持 Build、Pipeline 等事件',
  author: 'ClawKit Team',
  homepage: 'https://github.com/clawkit/clawkit',
  keywords: ['jenkins', 'trigger', 'webhook', 'ci', 'cd'],
};

/**
 * 插件配置
 */
let config = {
  // Webhook 密钥
  secretToken: '',
  
  // Jenkins 配置
  jenkinsUrl: '',
  jenkinsUser: '',
  jenkinsToken: '',
  
  // 事件过滤
  allowedEvents: ['build', 'pipeline'],
  allowedJobs: [], // 空表示所有 job
  allowedResults: [], // 空表示所有结果
  
  // 黑白名单
  excludeJobs: [],
  includeOnlyFailure: false, // 只触发失败构建
};

let context = {};
let eventHandlers = [];

/**
 * 初始化插件
 */
function initialize(pluginConfig, pluginContext) {
  config = {
    secretToken: pluginConfig.secretToken || '',
    jenkinsUrl: pluginConfig.jenkinsUrl || '',
    jenkinsUser: pluginConfig.jenkinsUser || '',
    jenkinsToken: pluginConfig.jenkinsToken || '',
    allowedEvents: pluginConfig.allowedEvents || ['build', 'pipeline'],
    allowedJobs: pluginConfig.allowedJobs || [],
    allowedResults: pluginConfig.allowedResults || [],
    excludeJobs: pluginConfig.excludeJobs || [],
    includeOnlyFailure: pluginConfig.includeOnlyFailure || false,
    ...pluginConfig,
  };
  context = pluginContext;
  eventHandlers = [];
  
  console.log('[JenkinsTrigger] 插件初始化完成');
}

/**
 * 验证 Webhook 签名（Jenkins 使用 HMAC）
 */
function verifySignature(payload, signature) {
  if (!config.secretToken) {
    return true;
  }
  
  if (!signature) {
    return false;
  }
  
  const hmac = crypto.createHmac('sha256', config.secretToken);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * 获取 Jenkins API 详情
 */
async function getBuildDetails(jobName, buildNumber) {
  if (!config.jenkinsUrl) {
    return null;
  }
  
  const url = `${config.jenkinsUrl}/job/${encodeURIComponent(jobName)}/${buildNumber}/api/json`;
  
  try {
    const auth = Buffer.from(`${config.jenkinsUser}:${config.jenkinsToken}`).toString('base64');
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('[JenkinsTrigger] 获取构建详情失败:', error);
    return null;
  }
}

/**
 * 解析 Generic Webhook 事件
 */
function parseGenericEvent(event, headers) {
  const build = event.build || {};
  const project = event.name || build.project || build.full_project || '';
  
  return {
    eventId: `jenkins-${project}-${build.number || Date.now()}`,
    eventType: 'build',
    source: 'jenkins',
    timestamp: new Date(build.timestamp ? build.timestamp : Date.now()).toISOString(),
    build: {
      number: build.number,
      phase: build.phase,
      status: build.status,
      url: build.url,
      scm: build.scm || {},
    },
    project: {
      name: project,
      url: build.url ? build.url.replace(/\/\d+\/?$/, '') : '',
    },
    raw: event,
  };
}

/**
 * 解析 GitHub Pull Request 评论事件
 */
function parseGitHubCommentEvent(event, headers) {
  const action = event.action || '';
  const comment = event.comment || {};
  const issue = event.issue || {};
  const pr = event.pull_request || {};
  
  return {
    eventId: `jenkins-gh-comment-${comment.id || Date.now()}`,
    eventType: 'github_comment',
    source: 'jenkins',
    timestamp: new Date().toISOString(),
    github: {
      action,
      comment: {
        id: comment.id,
        body: comment.body,
        author: comment.user?.login,
      },
      issue: {
        number: issue.number,
        title: issue.title,
        body: issue.body,
        url: issue.html_url,
      },
      pullRequest: {
        number: pr.number,
        title: pr.title,
        body: pr.body,
        url: pr.html_url,
        head: pr.head?.ref,
        base: pr.base?.ref,
      },
      repository: event.repository?.full_name,
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
  
  const jobName = parsedEvent.project?.name || parsedEvent.build?.project || '';
  
  // 排除 job
  if (config.excludeJobs.length > 0) {
    if (config.excludeJobs.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(jobName);
      }
      return jobName === pattern;
    })) {
      return { allowed: false, reason: `Job ${jobName} 在排除列表中` };
    }
  }
  
  // 白名单 job
  if (config.allowedJobs.length > 0) {
    const isAllowed = config.allowedJobs.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(jobName);
      }
      return jobName === pattern;
    });
    
    if (!isAllowed) {
      return { allowed: false, reason: `Job ${jobName} 不在允许列表中` };
    }
  }
  
  // 检查结果
  const buildStatus = parsedEvent.build?.status || '';
  if (config.allowedResults.length > 0 && !config.allowedResults.includes(buildStatus)) {
    return { allowed: false, reason: `构建状态 ${buildStatus} 不在允许列表中` };
  }
  
  // 只触发失败
  if (config.includeOnlyFailure) {
    const failureStatuses = ['FAILURE', 'UNSTABLE', 'FAILED', 'ERROR'];
    if (!failureStatuses.includes(buildStatus)) {
      return { allowed: false, reason: '只触发失败构建，但当前状态不是失败' };
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
  
  // 检测事件类型
  let parsedEvent;
  
  // GitHub Pull Request 评论触发
  if (event.comment && event.action) {
    parsedEvent = parseGitHubCommentEvent(event, headers);
  } else {
    // Generic Webhook
    parsedEvent = parseGenericEvent(event, headers);
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
  
  // 获取更详细的构建信息
  if (parsedEvent.build?.number && parsedEvent.project?.name && config.jenkinsUrl) {
    const details = await getBuildDetails(parsedEvent.project.name, parsedEvent.build.number);
    if (details) {
      parsedEvent.buildDetails = details;
    }
  }
  
  // 触发处理器
  for (const handler of eventHandlers) {
    try {
      await handler(parsedEvent);
    } catch (error) {
      console.error('[JenkinsTrigger] 处理器执行失败:', error);
    }
  }
  
  return {
    success: true,
    processed: true,
    event: parsedEvent,
  };
}

/**
 * 触发 Jenkins 构建
 */
async function triggerBuild(jobName, parameters = {}) {
  if (!config.jenkinsUrl || !config.jenkinsUser || !config.jenkinsToken) {
    return {
      success: false,
      error: 'Jenkins 配置不完整',
    };
  }
  
  const url = parameters
    ? `${config.jenkinsUrl}/job/${encodeURIComponent(jobName)}/buildWithParameters`
    : `${config.jenkinsUrl}/job/${encodeURIComponent(jobName)}/build`;
  
  try {
    const auth = Buffer.from(`${config.jenkinsUser}:${config.jenkinsToken}`).toString('base64');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: parameters ? JSON.stringify(parameters) : undefined,
    });
    
    if (response.status === 201 || response.status === 200) {
      return {
        success: true,
        queueId: response.headers.get('location')?.split('/').pop(),
      };
    } else {
      return {
        success: false,
        error: `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 获取构建状态
 */
async function getBuildStatus(jobName, buildNumber) {
  const details = await getBuildDetails(jobName, buildNumber);
  if (!details) {
    return null;
  }
  
  return {
    number: details.number,
    result: details.result,
    duration: details.duration,
    building: details.building,
    timestamp: details.timestamp,
    stages: details.stages || [],
    actions: details.actions || [],
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
  console.log(`[JenkinsTrigger] 取消任务: ${taskId}`);
}

/**
 * 健康检查
 */
async function healthCheck() {
  const result = {
    status: 'healthy',
    config: {
      hasSecretToken: !!config.secretToken,
      hasJenkinsConfig: !!config.jenkinsUrl,
      allowedEvents: config.allowedEvents,
      hasJobFilter: config.allowedJobs.length > 0,
    },
  };
  
  // 测试 Jenkins 连接
  if (config.jenkinsUrl && config.jenkinsUser && config.jenkinsToken) {
    try {
      const url = `${config.jenkinsUrl}/api/json`;
      const auth = Buffer.from(`${config.jenkinsUser}:${config.jenkinsToken}`).toString('base64');
      const response = await fetch(url, {
        headers: { 'Authorization': `Basic ${auth}` },
      });
      result.config.jenkinsReachable = response.ok;
    } catch {
      result.config.jenkinsReachable = false;
    }
  }
  
  return result;
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
  
  if (pluginConfig.jenkinsUrl && !pluginConfig.jenkinsUrl.startsWith('http')) {
    errors.push('jenkinsUrl 必须是有效的 URL');
  }
  
  if (pluginConfig.jenkinsUrl && !pluginConfig.jenkinsUser) {
    warnings.push('建议配置 jenkinsUser 以访问 Jenkins API');
  }
  
  const validEvents = ['build', 'pipeline', 'github_comment', 'generic'];
  if (pluginConfig.allowedEvents) {
    for (const event of pluginConfig.allowedEvents) {
      if (!validEvents.includes(event)) {
        warnings.push(`未知的事件类型: ${event}`);
      }
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
      { type: 'build', description: '监听构建事件' },
      { type: 'pipeline', description: '监听流水线事件' },
      { type: 'github_comment', description: '监听 GitHub PR 评论触发' },
      { type: 'filter', description: '支持 Job 和结果过滤' },
      { type: 'trigger', description: '支持触发 Jenkins 构建' },
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
  console.log('[JenkinsTrigger] 插件已销毁');
}

// 导出插件
module.exports = {
  meta,
  initialize,
  handleWebhook,
  verifySignature,
  triggerBuild,
  getBuildStatus,
  onTrigger,
  onCancel,
  healthCheck,
  validateConfig: validatePluginConfig,
  getMeta,
  dispose,
};

// ES Module 兼容
module.exports.default = module.exports;
