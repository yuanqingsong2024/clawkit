/**
 * HTTP Webhook 触发器插件
 * 
 * 支持接收任意 HTTP Webhook 请求
 * 支持自定义事件解析和过滤规则
 */

const crypto = require('crypto');

/**
 * 插件元信息
 */
const meta = {
  name: 'http-webhook-trigger',
  version: '1.0.0',
  type: 'trigger',
  description: '通用 HTTP Webhook 触发器，支持接收和处理任意 HTTP Webhook',
  author: 'ClawKit Team',
  homepage: 'https://github.com/clawkit/clawkit',
  keywords: ['webhook', 'trigger', 'http', 'api', 'custom'],
};

/**
 * 插件配置
 */
let config = {
  // 签名验证
  secretToken: '',
  signatureHeader: 'x-signature',
  signatureAlgorithm: 'sha256',
  
  // 事件过滤
  allowedMethods: ['POST', 'PUT', 'GET'],
  allowedContentTypes: [], // 空表示所有
  allowedPaths: [], // 空表示所有
  requiredHeaders: {}, // 必须包含的头部
  
  // 自定义解析器
  eventParser: null,
  
  // 默认事件类型
  defaultEventType: 'custom_webhook',
};

let context = {};
let eventHandlers = [];

/**
 * 初始化插件
 */
function initialize(pluginConfig, pluginContext) {
  config = {
    secretToken: pluginConfig.secretToken || '',
    signatureHeader: pluginConfig.signatureHeader || 'x-signature',
    signatureAlgorithm: pluginConfig.signatureAlgorithm || 'sha256',
    allowedMethods: pluginConfig.allowedMethods || ['POST', 'PUT', 'GET'],
    allowedContentTypes: pluginConfig.allowedContentTypes || [],
    allowedPaths: pluginConfig.allowedPaths || [],
    requiredHeaders: pluginConfig.requiredHeaders || {},
    eventParser: pluginConfig.eventParser || null,
    defaultEventType: pluginConfig.defaultEventType || 'custom_webhook',
    ...pluginConfig,
  };
  context = pluginContext;
  eventHandlers = [];
  
  console.log('[HttpWebhookTrigger] 插件初始化完成');
}

/**
 * 验证签名
 */
function verifySignature(payload, signature) {
  if (!config.secretToken || !signature) {
    return !config.secretToken; // 没配置密钥则不验证
  }
  
  const hash = crypto.createHash(config.signatureAlgorithm);
  hash.update(payload);
  const expectedSignature = hash.digest('hex');
  
  // 支持多种签名格式
  if (signature.startsWith('sha256=')) {
    return crypto.timingSafeEqual(
      Buffer.from(signature.slice(7)),
      Buffer.from(expectedSignature)
    );
  }
  
  if (signature.startsWith('sha1=')) {
    const sha1Hash = crypto.createHash('sha1').update(payload).digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature.slice(5)),
      Buffer.from(sha1Hash)
    );
  }
  
  // 纯签名
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * 解析 Query 参数
 */
function parseQueryParams(url) {
  try {
    const urlObj = new URL(url, 'http://localhost');
    const params = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    return {};
  }
}

/**
 * 解析 JSON 数据
 */
function parseJson(payload) {
  if (typeof payload === 'object') {
    return payload;
  }
  
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * 解析表单数据
 */
function parseFormData(payload) {
  const params = {};
  const pairs = payload.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  }
  return params;
}

/**
 * 通用事件解析器
 */
function defaultParser(event, headers, queryParams) {
  // 尝试提取关键字段
  const data = event.data || event.payload || event.body || event;
  const action = event.action || event.event || event.type || queryParams.action;
  const resource = event.resource || event.object || event.model || data?.constructor?.name;
  
  return {
    eventId: `http-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    eventType: action || config.defaultEventType,
    source: 'http_webhook',
    timestamp: new Date().toISOString(),
    resource: {
      type: resource,
      id: event.id || event.uuid || queryParams.id,
      name: event.name || event.title || event.message || '',
      data: data,
    },
    action: action,
    headers: headers,
    queryParams: queryParams,
    raw: event,
  };
}

/**
 * 过滤请求
 */
function shouldProcessRequest(method, path, contentType) {
  // 检查方法
  if (!config.allowedMethods.includes(method.toUpperCase())) {
    return { allowed: false, reason: `HTTP 方法 ${method} 不在允许列表中` };
  }
  
  // 检查路径
  if (config.allowedPaths.length > 0) {
    const isAllowed = config.allowedPaths.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(path);
      }
      return path === pattern;
    });
    
    if (!isAllowed) {
      return { allowed: false, reason: `路径 ${path} 不在允许列表中` };
    }
  }
  
  // 检查 Content-Type
  if (config.allowedContentTypes.length > 0 && contentType) {
    const isAllowed = config.allowedContentTypes.some(type => {
      return contentType.includes(type);
    });
    
    if (!isAllowed) {
      return { allowed: false, reason: `Content-Type ${contentType} 不在允许列表中` };
    }
  }
  
  return { allowed: true };
}

/**
 * 检查必需头部
 */
function checkRequiredHeaders(headers) {
  const missing = [];
  
  for (const [key, value] of Object.entries(config.requiredHeaders)) {
    const headerValue = headers[key.toLowerCase()] || headers[key];
    if (!headerValue) {
      missing.push(key);
    } else if (value && !headerValue.includes(value)) {
      missing.push(`${key}=${value}`);
    }
  }
  
  return missing;
}

/**
 * 处理 Webhook 请求
 */
async function handleWebhook(payload, headers, method, path) {
  const contentType = headers['content-type'] || headers['Content-Type'] || '';
  const signature = headers[config.signatureHeader.toLowerCase()] || headers[config.signatureHeader];
  
  // 验证签名
  if (config.secretToken) {
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (!verifySignature(payloadStr, signature)) {
      return {
        success: false,
        error: '签名验证失败',
        statusCode: 401,
      };
    }
  }
  
  // 过滤请求
  const filterResult = shouldProcessRequest(method, path, contentType);
  if (!filterResult.allowed) {
    return {
      success: true,
      processed: false,
      reason: filterResult.reason,
    };
  }
  
  // 检查必需头部
  const missingHeaders = checkRequiredHeaders(headers);
  if (missingHeaders.length > 0) {
    return {
      success: false,
      error: `缺少必需的头部: ${missingHeaders.join(', ')}`,
      statusCode: 400,
    };
  }
  
  // 解析 payload
  let event;
  if (contentType.includes('application/json')) {
    event = parseJson(payload);
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    event = parseFormData(payload);
  } else {
    event = payload;
  }
  
  // 解析 query 参数
  const queryParams = parseQueryParams(headers['referer'] || '');
  
  // 使用自定义解析器或默认解析器
  const parsedEvent = config.eventParser
    ? config.eventParser(event, headers, queryParams)
    : defaultParser(event, headers, queryParams);
  
  // 触发处理器
  for (const handler of eventHandlers) {
    try {
      await handler(parsedEvent);
    } catch (error) {
      console.error('[HttpWebhookTrigger] 处理器执行失败:', error);
    }
  }
  
  return {
    success: true,
    processed: true,
    event: parsedEvent,
  };
}

/**
 * 发送 Webhook 请求
 */
async function sendWebhook(url, data, options = {}) {
  const {
    method = 'POST',
    headers = {},
    secretToken,
    signatureAlgorithm = 'sha256',
  } = options;
  
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  const requestHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };
  
  // 添加签名
  if (secretToken) {
    const hash = crypto.createHash(signatureAlgorithm);
    hash.update(payload);
    const signature = signatureAlgorithm === 'sha1'
      ? `sha1=${hash.digest('hex')}`
      : `sha256=${hash.digest('hex')}`;
    requestHeaders['X-Signature'] = signature;
  }
  
  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: payload,
    });
    
    return {
      success: response.ok,
      statusCode: response.status,
      body: await response.text(),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
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
  console.log(`[HttpWebhookTrigger] 取消任务: ${taskId}`);
}

/**
 * 健康检查
 */
async function healthCheck() {
  return {
    status: 'healthy',
    config: {
      hasSecretToken: !!config.secretToken,
      signatureHeader: config.signatureHeader,
      allowedMethods: config.allowedMethods,
      hasPathFilter: config.allowedPaths.length > 0,
      hasHeaderFilter: Object.keys(config.requiredHeaders).length > 0,
      handlersCount: eventHandlers.length,
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
  
  const validAlgorithms = ['sha256', 'sha1', 'md5'];
  if (pluginConfig.signatureAlgorithm && !validAlgorithms.includes(pluginConfig.signatureAlgorithm)) {
    warnings.push(`signatureAlgorithm 建议使用 ${validAlgorithms.join(' 或 ')}`);
  }
  
  const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  if (pluginConfig.allowedMethods) {
    for (const method of pluginConfig.allowedMethods) {
      if (!validMethods.includes(method.toUpperCase())) {
        warnings.push(`未知的 HTTP 方法: ${method}`);
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
    supportedMethods: config.allowedMethods,
    capabilities: [
      { type: 'json', description: '支持 JSON payload' },
      { type: 'form', description: '支持表单数据' },
      { type: 'signature', description: '支持签名验证' },
      { type: 'filter', description: '支持方法和路径过滤' },
      { type: 'custom-parser', description: '支持自定义解析器' },
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
  console.log('[HttpWebhookTrigger] 插件已销毁');
}

// 导出插件
module.exports = {
  meta,
  initialize,
  handleWebhook,
  verifySignature,
  sendWebhook,
  onTrigger,
  onCancel,
  healthCheck,
  validateConfig: validatePluginConfig,
  getMeta,
  dispose,
};

// ES Module 兼容
module.exports.default = module.exports;
