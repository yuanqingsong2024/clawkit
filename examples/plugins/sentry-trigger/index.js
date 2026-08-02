/**
 * Sentry 触发器插件
 * 
 * 支持监听 Sentry Webhook 事件触发任务
 * 支持 Error、Performance、Issue 等事件
 */

const crypto = require('crypto');

/**
 * 插件元信息
 */
const meta = {
  name: 'sentry-trigger',
  version: '1.0.0',
  type: 'trigger',
  description: 'Sentry Webhook 触发器，支持 Error、Issue、Performance 等事件',
  author: 'ClawKit Team',
  homepage: 'https://github.com/clawkit/clawkit',
  keywords: ['sentry', 'trigger', 'webhook', 'error', 'monitoring'],
};

/**
 * 插件配置
 */
let config = {
  // 签名验证
  secretToken: '',
  
  // 事件过滤
  allowedEvents: ['event', 'issue', 'error', 'performance'],
  allowedProjects: [], // 空表示所有
  allowedLevels: [], // 空表示所有
  excludeProjects: [], // 排除的项目
  excludeLevels: ['info', 'debug'], // 默认排除低级别事件
  
  // 自定义阈值
  minUserCount: 0, // 最小影响用户数
  minOccurrence: 0, // 最小发生次数
  
  // 自动处理
  autoAssign: false,
};

let context = {};
let eventHandlers = [];

/**
 * 初始化插件
 */
function initialize(pluginConfig, pluginContext) {
  config = {
    secretToken: pluginConfig.secretToken || '',
    allowedEvents: pluginConfig.allowedEvents || ['event', 'issue', 'error', 'performance'],
    allowedProjects: pluginConfig.allowedProjects || [],
    allowedLevels: pluginConfig.allowedLevels || [],
    excludeProjects: pluginConfig.excludeProjects || [],
    excludeLevels: pluginConfig.excludeLevels || ['info', 'debug'],
    minUserCount: pluginConfig.minUserCount || 0,
    minOccurrence: pluginConfig.minOccurrence || 0,
    autoAssign: pluginConfig.autoAssign || false,
    ...pluginConfig,
  };
  context = pluginContext;
  eventHandlers = [];
  
  console.log('[SentryTrigger] 插件初始化完成');
}

/**
 * 验证签名
 */
function verifySignature(payload, signature, timestamp) {
  if (!config.secretToken) {
    return true;
  }
  
  if (!signature) {
    return false;
  }
  
  // Sentry 使用 timestamp 和 payload 组合签名
  const stringToSign = `t=${timestamp},v0=${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', config.secretToken)
    .update(stringToSign)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expectedSignature}`)
  );
}

/**
 * 解析 Error 事件
 */
function parseErrorEvent(event) {
  return {
    eventId: `sentry-${event.event_id || Date.now()}`,
    eventType: 'error',
    source: 'sentry',
    timestamp: event.timestamp || new Date().toISOString(),
    project: {
      id: event.project_id?.toString(),
      slug: event.project,
      name: event.project,
    },
    organization: {
      slug: event.organization?.slug || event.organization_slug,
    },
    error: {
      id: event.event_id,
      level: event.level || 'error',
      culprit: event.culprit,
      message: event.message || event.error?.value || '',
      platform: event.platform,
      environment: event.environment,
      logger: event.logger,
      fingerprints: event.fingerprint || [],
    },
    issue: event.group_id ? {
      id: event.group_id,
      shortId: event.group_id,
    } : null,
    user: {
      id: event.user?.id,
      email: event.user?.email,
      ip: event.user?.ip_address,
      count: event.user?.count || 0,
    },
    contexts: event.contexts || {},
    tags: event.tags || {},
    release: {
      version: event.release?.version,
    },
    platform: event.platform,
    raw: event,
  };
}

/**
 * 解析 Issue 事件
 */
function parseIssueEvent(event) {
  return {
    eventId: `sentry-issue-${event.issue?.id || Date.now()}`,
    eventType: 'issue',
    source: 'sentry',
    timestamp: new Date().toISOString(),
    project: {
      id: event.project?.id?.toString(),
      slug: event.project?.slug,
      name: event.project?.name,
    },
    organization: {
      slug: event.organization?.slug,
    },
    issue: {
      id: event.issue?.id,
      shortId: event.issue?.short_id,
      title: event.issue?.title,
      culprit: event.issue?.culprit,
      level: event.issue?.level,
      status: event.issue?.status,
      isUnhandled: event.issue?.isUnhandled,
      isPublic: event.issue?.isPublic,
      platform: event.issue?.platform,
      count: event.issue?.count || 0,
      userCount: event.issue?.userCount || 0,
      firstSeen: event.issue?.firstSeen,
      lastSeen: event.issue?.lastSeen,
    },
    action: event.action || event.event,
    raw: event,
  };
}

/**
 * 解析 Performance 事件
 */
function parsePerformanceEvent(event) {
  return {
    eventId: `sentry-perf-${event.event_id || Date.now()}`,
    eventType: 'performance',
    source: 'sentry',
    timestamp: event.timestamp || new Date().toISOString(),
    project: {
      id: event.project_id?.toString(),
      slug: event.project,
    },
    organization: {
      slug: event.organization_slug,
    },
    transaction: {
      id: event.event_id,
      name: event.transaction,
      duration: event.event?.measurements?.lcp?.value,
      op: event.transaction_info?.op,
      status: event.transaction_info?.status,
    },
    spans: event.spans || [],
    tags: event.tags || {},
    raw: event,
  };
}

/**
 * 过滤事件
 */
function shouldProcessEvent(eventType, parsedEvent) {
  // 检查事件类型
  if (!config.allowedEvents.includes(eventType)) {
    return { allowed: false, reason: `事件类型 ${eventType} 不在允许列表中` };
  }
  
  const projectSlug = parsedEvent.project?.slug || '';
  const level = parsedEvent.error?.level || parsedEvent.issue?.level || '';
  
  // 排除项目
  if (config.excludeProjects.length > 0) {
    if (config.excludeProjects.some(p => projectSlug.includes(p))) {
      return { allowed: false, reason: `项目 ${projectSlug} 在排除列表中` };
    }
  }
  
  // 白名单项目
  if (config.allowedProjects.length > 0) {
    const isAllowed = config.allowedProjects.some(p => projectSlug.includes(p));
    if (!isAllowed) {
      return { allowed: false, reason: `项目 ${projectSlug} 不在允许列表中` };
    }
  }
  
  // 排除级别
  if (config.excludeLevels.length > 0 && level) {
    if (config.excludeLevels.includes(level)) {
      return { allowed: false, reason: `级别 ${level} 在排除列表中` };
    }
  }
  
  // 白名单级别
  if (config.allowedLevels.length > 0 && level) {
    if (!config.allowedLevels.includes(level)) {
      return { allowed: false, reason: `级别 ${level} 不在允许列表中` };
    }
  }
  
  // 用户数阈值
  const userCount = parsedEvent.user?.count || parsedEvent.issue?.userCount || 0;
  if (config.minUserCount > 0 && userCount < config.minUserCount) {
    return { allowed: false, reason: `影响用户数 ${userCount} 低于阈值 ${config.minUserCount}` };
  }
  
  // 发生次数阈值
  const occurrence = parsedEvent.issue?.count || 0;
  if (config.minOccurrence > 0 && occurrence < config.minOccurrence) {
    return { allowed: false, reason: `发生次数 ${occurrence} 低于阈值 ${config.minOccurrence}` };
  }
  
  return { allowed: true };
}

/**
 * 处理 Webhook 事件
 */
async function handleWebhook(payload, headers) {
  const signature = headers['sentry-hook-signature'] || headers['x-sentry-signature'];
  const timestamp = headers['sentry-hook-timestamp'] || Date.now().toString();
  
  // 验证签名
  if (config.secretToken) {
    if (!verifySignature(payload, signature, timestamp)) {
      return {
        success: false,
        error: '签名验证失败',
        statusCode: 401,
      };
    }
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
  
  // 获取事件类型
  const eventType = event.type || event.action || 'event';
  
  // 根据事件类型解析
  let parsedEvent;
  switch (eventType) {
    case 'error':
    case 'Event':
      parsedEvent = parseErrorEvent(event);
      break;
    case 'issue':
    case 'Issue':
      parsedEvent = parseIssueEvent(event);
      break;
    case 'transaction':
    case 'performance':
      parsedEvent = parsePerformanceEvent(event);
      break;
    default:
      parsedEvent = parseErrorEvent(event);
  }
  
  // 过滤事件
  const filterResult = shouldProcessEvent(eventType, parsedEvent);
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
      console.error('[SentryTrigger] 处理器执行失败:', error);
    }
  }
  
  return {
    success: true,
    processed: true,
    event: parsedEvent,
  };
}

/**
 * 获取 Sentry Issues
 */
async function getIssues(projectSlug) {
  if (!context.sentryClient) {
    return [];
  }
  
  try {
    return await context.sentryClient.getIssues(projectSlug);
  } catch {
    return [];
  }
}

/**
 * 获取 Issue 详情
 */
async function getIssueDetails(issueId) {
  if (!context.sentryClient) {
    return null;
  }
  
  try {
    return await context.sentryClient.getIssue(issueId);
  } catch {
    return null;
  }
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
  console.log(`[SentryTrigger] 取消任务: ${taskId}`);
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
      hasProjectFilter: config.allowedProjects.length > 0 || config.excludeProjects.length > 0,
      hasLevelFilter: config.allowedLevels.length > 0 || config.excludeLevels.length > 0,
      minUserCount: config.minUserCount,
      minOccurrence: config.minOccurrence,
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
  
  const validEvents = ['event', 'issue', 'error', 'performance', 'transaction'];
  if (pluginConfig.allowedEvents) {
    for (const event of pluginConfig.allowedEvents) {
      if (!validEvents.includes(event)) {
        warnings.push(`未知的事件类型: ${event}`);
      }
    }
  }
  
  const validLevels = ['fatal', 'error', 'warning', 'info', 'debug'];
  if (pluginConfig.allowedLevels) {
    for (const level of pluginConfig.allowedLevels) {
      if (!validLevels.includes(level)) {
        warnings.push(`未知的级别: ${level}`);
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
      { type: 'error', description: '监听错误事件' },
      { type: 'issue', description: '监听 Issue 事件' },
      { type: 'performance', description: '监听性能事件' },
      { type: 'filter', description: '支持项目和级别过滤' },
      { type: 'threshold', description: '支持用户数和次数阈值' },
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
  console.log('[SentryTrigger] 插件已销毁');
}

// 导出插件
module.exports = {
  meta,
  initialize,
  handleWebhook,
  verifySignature,
  getIssues,
  getIssueDetails,
  onTrigger,
  onCancel,
  healthCheck,
  validateConfig: validatePluginConfig,
  getMeta,
  dispose,
};

// ES Module 兼容
module.exports.default = module.exports;
