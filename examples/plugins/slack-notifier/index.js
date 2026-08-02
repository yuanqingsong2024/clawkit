/**
 * Slack 通知器插件
 * 
 * 支持通过 Slack Webhook 发送通知消息
 * 支持 Block Kit UI 组件
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * 插件元信息
 */
const meta = {
  name: 'slack-notifier',
  version: '1.0.0',
  type: 'notifier',
  description: 'Slack Webhook 通知器，支持 Block Kit UI 组件',
  author: 'ClawKit Team',
  homepage: 'https://github.com/clawkit/clawkit',
  keywords: ['slack', 'notification', 'webhook', 'block-kit'],
};

/**
 * 插件配置
 */
let config = {
  webhookUrl: '',
  channel: '',
  botName: 'ClawKit',
  botIcon: ':robot_face:',
};
let context = {};

/**
 * 初始化插件
 */
function initialize(pluginConfig, pluginContext) {
  config = {
    webhookUrl: pluginConfig.webhookUrl || '',
    channel: pluginConfig.channel || '',
    botName: pluginConfig.botName || 'ClawKit',
    botIcon: pluginConfig.botIcon || ':robot_face:',
    ...pluginConfig,
  };
  context = pluginContext;
  console.log('[SlackNotifier] 插件初始化完成');
}

/**
 * 发送 HTTP 请求（支持 HTTPS）
 */
function httpRequest(url, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(data)),
      },
    };
    
    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

/**
 * 构建 Block Kit 消息
 */
function buildBlockKitMessage(notification) {
  const { content, priority } = notification;
  const title = content.title || 'ClawKit 通知';
  const body = content.body || '';
  
  // 根据类型选择颜色和图标
  let color = '#36a64f'; // 默认绿色
  let statusEmoji = ':bell:';
  if (notification.type === 'task_completed') {
    color = '#36a64f';
    statusEmoji = ':white_check_mark:';
  } else if (notification.type === 'task_failed') {
    color = '#dc3545';
    statusEmoji = ':x:';
  } else if (notification.type === 'task_progress') {
    color = '#ffc107';
    statusEmoji = ':hourglass_flowing_sand:';
  } else if (notification.type === 'system_alert') {
    color = '#dc3545';
    statusEmoji = ':warning:';
  }
  
  // 优先级 emoji
  const priorityEmoji = {
    urgent: ':red_circle:',
    high: ':orange_circle:',
    normal: ':large_blue_circle:',
    low: ':white_circle:',
  };
  
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${statusEmoji} ${title}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: body,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${priorityEmoji[priority] || ':large_blue_circle:'} *优先级:* ${priority || 'normal'} | :clock1: ${new Date().toLocaleString('zh-CN')}`,
        },
      ],
    },
  ];
  
  // 添加目标信息
  if (notification.target?.name) {
    blocks.splice(2, 0, {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*目标:* ${notification.target.name}`,
      },
    });
  }
  
  return {
    blocks,
    attachments: [
      {
        color,
        blocks: [],
      },
    ],
  };
}

/**
 * 发送 Slack 消息
 */
async function sendNotification(notification) {
  // 如果没有配置 webhook
  if (!config.webhookUrl) {
    return {
      success: false,
      error: '未配置 Slack Webhook URL，请先配置 slack-notifier.webhookUrl',
    };
  }
  
  try {
    const message = buildBlockKitMessage(notification);
    
    // 添加 channel 和 username 配置
    const payload = {
      ...message,
      channel: config.channel || undefined,
      username: config.botName,
      icon_emoji: config.botIcon,
    };
    
    const result = await httpRequest(config.webhookUrl, payload);
    
    if (result === 'ok' || result === '') {
      return {
        success: true,
        notificationId: `slack-${Date.now()}`,
      };
    } else if (result && result.ok === true) {
      return {
        success: true,
        notificationId: `slack-${Date.now()}`,
        details: result,
      };
    } else {
      return {
        success: false,
        error: result?.error || '发送失败',
        details: result,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || '网络请求失败',
    };
  }
}

/**
 * 发送简单文本消息
 */
async function sendText(text, channel) {
  return sendNotification({
    id: `text-${Date.now()}`,
    type: 'custom',
    priority: 'normal',
    content: {
      title: 'ClawKit 通知',
      body: text,
    },
    target: { type: 'webhook', id: channel || 'default', name: channel || 'Slack' },
    timestamp: Date.now(),
  });
}

/**
 * 发送 Block Kit 消息
 */
async function sendBlockKitMessage(blocks, options = {}) {
  try {
    const payload = {
      blocks,
      channel: options.channel || config.channel || undefined,
      username: options.botName || config.botName,
      icon_emoji: options.icon || config.botIcon,
    };
    
    const result = await httpRequest(config.webhookUrl, payload);
    
    return {
      success: result === 'ok' || result?.ok === true,
      notificationId: `slack-block-${Date.now()}`,
      details: result,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 发送交互式消息（带按钮）
 */
async function sendInteractiveMessage(title, message, actions) {
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: title,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: message,
      },
    },
    {
      type: 'actions',
      elements: actions.map(action => ({
        type: 'button',
        text: {
          type: 'plain_text',
          text: action.text,
          emoji: true,
        },
        style: action.style || 'primary',
        value: action.value,
        action_id: action.actionId || action.text.toLowerCase().replace(/\s+/g, '_'),
      })),
    },
  ];
  
  return sendBlockKitMessage(blocks);
}

/**
 * 批量发送通知
 */
async function sendBatch(notifications) {
  const results = [];
  for (const notification of notifications) {
    const result = await sendNotification(notification);
    results.push(result);
  }
  return results;
}

/**
 * 发送测试通知
 */
async function sendTest(target) {
  const testNotification = {
    id: `test-${Date.now()}`,
    type: 'system_alert',
    priority: 'normal',
    content: {
      title: 'Slack 通知器测试',
      body: ':white_check_mark: 这是一条来自 ClawKit 的测试消息。\n\n如果你看到这条消息，说明 Slack 通知器配置正确。',
    },
    target: target || { type: 'webhook', id: 'test', name: '测试' },
    timestamp: Date.now(),
  };
  
  return sendNotification(testNotification);
}

/**
 * 检查是否支持特定通知类型
 */
function supportsType(type) {
  const supportedTypes = [
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
  return supportedTypes.includes(type);
}

/**
 * 健康检查
 */
async function healthCheck() {
  if (!config.webhookUrl) {
    return false;
  }
  
  try {
    const result = await sendTest();
    return result.success;
  } catch {
    return false;
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
    errors.push('缺少 webhookUrl 配置');
  } else if (!pluginConfig.webhookUrl.startsWith('https://hooks.slack.com/')) {
    errors.push('webhookUrl 必须是 Slack Webhook 地址');
  }
  
  if (pluginConfig.botIcon && !pluginConfig.botIcon.startsWith(':')) {
    warnings.push('botIcon 建议使用 emoji 格式，如 :robot_face:');
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
    supportedTypes: [
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
    ],
    supportedTargets: ['webhook', 'channel'],
    capabilities: [
      { type: 'text', description: '支持文本消息' },
      { type: 'block-kit', description: '支持 Block Kit UI' },
      { type: 'interactive', description: '支持交互式消息' },
      { type: 'emoji', description: '支持 emoji 图标' },
    ],
  };
}

/**
 * 销毁插件
 */
async function dispose() {
  config = {};
  context = {};
  console.log('[SlackNotifier] 插件已销毁');
}

// 导出插件
module.exports = {
  meta,
  initialize,
  send: sendNotification,
  sendText,
  sendBlockKitMessage,
  sendInteractiveMessage,
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
