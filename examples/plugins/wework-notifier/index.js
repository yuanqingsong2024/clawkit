/**
 * 企业微信 (WeCom) 通知器插件
 * 
 * 支持通过企业微信 Webhook 发送消息通知
 * 支持 Markdown 消息、@成员、图片等
 */

const crypto = require('crypto');

/**
 * 插件元信息
 */
const meta = {
  name: 'wework-notifier',
  version: '1.0.0',
  type: 'notifier',
  description: '企业微信 Webhook 通知器，支持 Markdown 消息和 @成员',
  author: 'ClawKit Team',
  homepage: 'https://github.com/clawkit/clawkit',
  keywords: ['notifier', 'wework', 'wecom', 'webhook', 'notification', '企业微信'],
};

/**
 * 插件配置
 */
let config = {
  // Webhook 地址
  webhookUrl: '',
  
  // 是否启用安全模式（签名验证）
  enableSecurity: false,
  
  // 签名密钥
  secret: '',
  
  // 默认 @ 手机号列表
  atMobiles: [],
  
  // 是否 @所有人
  isAtAll: false,
  
  // 消息类型
  msgType: 'markdown',
};

/**
 * 上下文
 */
let context = {};

/**
 * 支持的通知类型
 */
const SUPPORTED_TYPES = [
  'task_created',
  'task_approved',
  'task_rejected',
  'task_started',
  'task_completed',
  'task_failed',
  'task_cancelled',
  'task_progress',
  'system_alert',
  'custom',
];

/**
 * 初始化插件
 * @param {Object} pluginConfig - 插件配置
 * @param {Object} pluginContext - 插件上下文
 */
function initialize(pluginConfig, pluginContext) {
  config = {
    webhookUrl: pluginConfig.webhookUrl || '',
    enableSecurity: pluginConfig.enableSecurity || false,
    secret: pluginConfig.secret || '',
    atMobiles: pluginConfig.atMobiles || [],
    isAtAll: pluginConfig.isAtAll || false,
    msgType: pluginConfig.msgType || 'markdown',
    ...pluginConfig,
  };
  context = pluginContext || {};
  
  console.log('[WeWorkNotifier] 插件初始化完成');
}

/**
 * 生成签名（用于安全模式）
 * @param {number} timestamp - 时间戳
 * @returns {string} 签名
 */
function generateSignature(timestamp) {
  if (!config.secret) {
    return '';
  }
  
  const str = `${timestamp}\n${config.secret}`;
  const hash = crypto.createHash('sha256').update(str).digest('binary');
  const signature = Buffer.from(hash, 'binary').toString('base64');
  return signature;
}

/**
 * 发送文本消息
 * @param {Object} notification - 通知对象
 */
async function sendText(notification) {
  const data = {
    msgtype: 'text',
    text: {
      content: formatTextContent(notification),
      mentioned_list: config.atMobiles,
      mentioned_mobile_list: config.atMobiles,
    },
  };
  
  return sendRequest(data);
}

/**
 * 发送 Markdown 消息
 * @param {Object} notification - 通知对象
 */
async function sendMarkdown(notification) {
  const data = {
    msgtype: 'markdown',
    markdown: {
      content: formatMarkdownContent(notification),
    },
  };
  
  return sendRequest(data);
}

/**
 * 发送图文消息
 * @param {Object} notification - 通知对象
 */
async function sendNews(notification) {
  const articles = [
    {
      title: notification.content?.title || 'ClawKit 通知',
      description: notification.content?.body || '',
      url: notification.content?.url || '',
      picurl: notification.content?.image || '',
    },
  ];
  
  const data = {
    msgtype: 'news',
    news: { articles },
  };
  
  return sendRequest(data);
}

/**
 * 发送模板卡片消息
 * @param {Object} notification - 通知对象
 */
async function sendTemplateCard(notification) {
  const cardType = notification.content?.cardType || 'text_notice';
  
  const data = {
    msgtype: 'template_card',
    template_card: {
      card_type: cardType,
      source: {
        icon_url: 'https://example.com/icon.png',
        desc: 'ClawKit',
        desc_color: 0,
      },
      main_title: {
        title: notification.content?.title || 'ClawKit 通知',
        desc: notification.content?.subtitle || '',
      },
      emphasis_content: {
        title: notification.content?.emphasis || '',
        description: notification.content?.emphasisDesc || '',
      },
      quote_area: {
        type: notification.content?.quoteType || 0,
        url: notification.content?.quoteUrl || '',
        appid: notification.content?.quoteAppid || '',
        pagepath: notification.content?.quotePagepath || '',
      },
      sub_title_text: notification.content?.footer || '',
      horizontal_content_list: buildHorizontalContent(notification),
      jump_list: buildJumpList(notification),
      card_action: {
        type: notification.content?.actionType || 1,
        url: notification.content?.actionUrl || '',
        appid: notification.content?.actionAppid || '',
        pagepath: notification.content?.actionPagepath || '',
      },
    },
  };
  
  return sendRequest(data);
}

/**
 * 构建横向内容列表
 */
function buildHorizontalContent(notification) {
  const list = [];
  
  if (notification.content?.priority) {
    list.push({
      type: 1,
      name: '优先级',
      value: formatPriority(notification.content.priority),
    });
  }
  
  if (notification.content?.executor) {
    list.push({
      type: 1,
      name: '执行者',
      value: notification.content.executor,
    });
  }
  
  if (notification.content?.duration) {
    list.push({
      type: 1,
      name: '耗时',
      value: formatDuration(notification.content.duration),
    });
  }
  
  return list;
}

/**
 * 构建跳转列表
 */
function buildJumpList(notification) {
  const list = [];
  
  if (notification.content?.viewUrl) {
    list.push({
      type: 1,
      title: '查看详情',
      url: notification.content.viewUrl,
    });
  }
  
  if (notification.content?.consoleUrl) {
    list.push({
      type: 2,
      title: '打开控制台',
      appid: 'wxxxxxxxxxxxxx', // 需要替换为实际的企业应用
      pagepath: '/pages/index',
    });
  }
  
  return list;
}

/**
 * 发送请求到企业微信
 * @param {Object} data - 消息数据
 */
async function sendRequest(data) {
  if (!config.webhookUrl) {
    throw new Error('企业微信 Webhook URL 未配置');
  }
  
  // 如果启用了安全模式，添加签名
  let url = config.webhookUrl;
  if (config.enableSecurity && config.secret) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateSignature(timestamp);
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}timestamp=${timestamp}&sign=${encodeURIComponent(signature)}`;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  const result = await response.json();
  
  if (result.errcode !== 0) {
    throw new Error(`企业微信 API 错误: ${result.errmsg}`);
  }
  
  return result;
}

/**
 * 格式化文本内容
 */
function formatTextContent(notification) {
  const type = notification.type || 'custom';
  const title = getTitleForType(type);
  const body = notification.content?.body || '';
  
  let content = `【${title}】\n\n${body}`;
  
  if (notification.content?.details) {
    content += '\n\n详情:';
    for (const [key, value] of Object.entries(notification.content.details)) {
      content += `\n- ${key}: ${value}`;
    }
  }
  
  return content;
}

/**
 * 格式化 Markdown 内容
 */
function formatMarkdownContent(notification) {
  const type = notification.type || 'custom';
  const title = getTitleForType(type);
  const body = notification.content?.body || '';
  
  let content = `### ${title}\n\n`;
  
  // 根据类型添加不同的样式
  if (type === 'task_failed' || type === 'system_alert') {
    content += `> ⚠️ ${body}\n\n`;
  } else if (type === 'task_completed') {
    content += `> ✅ ${body}\n\n`;
  } else {
    content += `> ${body}\n\n`;
  }
  
  // 添加详细信息
  if (notification.content?.title) {
    content += `**${notification.content.title}**\n\n`;
  }
  
  if (notification.content?.details) {
    content += '**详情:**\n';
    for (const [key, value] of Object.entries(notification.content.details)) {
      content += `- **${key}**: ${value}\n`;
    }
    content += '\n';
  }
  
  // 添加链接
  if (notification.content?.url) {
    content += `[查看详情](${notification.content.url})\n`;
  }
  
  // 添加 Footer
  content += `---\n`;
  content += `*来自 ClawKit · ${new Date().toLocaleString('zh-CN')}*`;
  
  return content;
}

/**
 * 获取类型对应的标题
 */
function getTitleForType(type) {
  const titles = {
    task_created: '🆕 任务创建',
    task_approved: '✅ 任务审批通过',
    task_rejected: '❌ 任务被拒绝',
    task_started: '🚀 任务开始执行',
    task_completed: '✅ 任务完成',
    task_failed: '❌ 任务失败',
    task_cancelled: '⏹️ 任务取消',
    task_progress: '📊 任务进度更新',
    system_alert: '🚨 系统告警',
    custom: '📢 通知',
  };
  
  return titles[type] || titles.custom;
}

/**
 * 格式化优先级
 */
function formatPriority(priority) {
  const map = {
    low: '🔵 低',
    medium: '🟡 中',
    high: '🟠 高',
    urgent: '🔴 紧急',
  };
  return map[priority] || priority;
}

/**
 * 格式化时长
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}秒`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}分钟`;
  return `${(ms / 3600000).toFixed(1)}小时`;
}

/**
 * 发送通知
 * @param {Object} notification - 通知对象
 */
async function send(notification) {
  const type = notification.type || 'custom';
  
  // 根据消息类型选择发送方式
  switch (config.msgType) {
    case 'text':
      return sendText(notification);
    case 'news':
      return sendNews(notification);
    case 'template_card':
      return sendTemplateCard(notification);
    case 'markdown':
    default:
      return sendMarkdown(notification);
  }
}

/**
 * 批量发送通知
 * @param {Array} notifications - 通知数组
 */
async function sendBatch(notifications) {
  const results = [];
  
  for (const notification of notifications) {
    try {
      const result = await send(notification);
      results.push({ success: true, result });
    } catch (error) {
      results.push({ success: false, error: error.message });
    }
  }
  
  return results;
}

/**
 * 发送测试消息
 */
async function sendTest() {
  return send({
    id: 'test-' + Date.now(),
    type: 'custom',
    priority: 'medium',
    content: {
      title: '测试通知',
      body: '这是一条来自 ClawKit 的测试消息，用于验证企业微信通知配置是否正确。',
      details: {
        '测试时间': new Date().toLocaleString('zh-CN'),
        '状态': '✅ 配置正确',
      },
    },
    timestamp: Date.now(),
  });
}

/**
 * 检查是否支持特定通知类型
 */
function supportsType(type) {
  return SUPPORTED_TYPES.includes(type);
}

/**
 * 健康检查
 */
async function healthCheck() {
  try {
    await sendTest();
    return {
      status: 'healthy',
      message: '企业微信 Webhook 连接正常',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message,
    };
  }
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
  
  if (!pluginConfig.webhookUrl) {
    errors.push('webhookUrl 必须配置');
  } else if (!pluginConfig.webhookUrl.startsWith('https://qyapi.weixin.qq.com/')) {
    errors.push('webhookUrl 必须是企业微信 Webhook 地址');
  }
  
  if (pluginConfig.enableSecurity && !pluginConfig.secret) {
    errors.push('启用安全模式时必须配置 secret');
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
    supportedTypes: SUPPORTED_TYPES,
    capabilities: [
      { type: 'text', description: '支持文本消息' },
      { type: 'markdown', description: '支持 Markdown 消息' },
      { type: 'news', description: '支持图文消息' },
      { type: 'template_card', description: '支持模板卡片' },
      { type: 'at_member', description: '支持 @ 成员' },
      { type: 'at_all', description: '支持 @所有人' },
    ],
  };
}

/**
 * 销毁插件
 */
async function dispose() {
  config = {};
  context = {};
  console.log('[WeWorkNotifier] 插件已销毁');
}

// 导出插件
module.exports = {
  meta,
  initialize,
  send,
  sendBatch,
  sendTest,
  supportsType,
  healthCheck,
  validateConfig: validatePluginConfig,
  getMeta,
  dispose,
};

// ES Module 兼容
module.exports.default = module.exports;
