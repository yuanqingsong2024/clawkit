/**
 * 飞书通知器插件
 * 
 * 支持通过飞书 Webhook 发送通知消息
 * 文档: https://open.feishu.cn/document/ukTMukTMukTM/ucTM5YjL3ETO24yNxkjN
 */

const crypto = require('crypto');

/**
 * 插件元信息
 */
const meta = {
  name: 'feishu-notifier',
  version: '1.0.0',
  type: 'notifier',
  description: '飞书 Webhook 通知器，支持文本、卡片等多种消息类型',
  author: 'ClawKit Team',
  homepage: 'https://github.com/clawkit/clawkit',
  keywords: ['feishu', 'lark', 'notification', 'webhook'],
};

/**
 * 插件配置
 */
let config = {
  webhookUrl: '',
  secret: '',
  botName: 'ClawKit Bot',
  atMobiles: [],
  isAtAll: false,
};
let context = {};

/**
 * 初始化插件
 */
function initialize(pluginConfig, pluginContext) {
  config = {
    webhookUrl: pluginConfig.webhookUrl || '',
    secret: pluginConfig.secret || '',
    botName: pluginConfig.botName || 'ClawKit Bot',
    atMobiles: pluginConfig.atMobiles || [],
    isAtAll: pluginConfig.isAtAll || false,
    ...pluginConfig,
  };
  context = pluginContext;
  console.log('[FeishuNotifier] 插件初始化完成');
}

/**
 * 生成签名（飞书 v2 版本）
 */
function generateSign(secret, timestamp) {
  if (!secret) return '';
  
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(stringToSign);
  return hmac.digest('base64');
}

/**
 * 构建消息内容
 */
function buildMessage(notification) {
  const { content, priority } = notification;
  const title = content.title || 'ClawKit 通知';
  const body = content.body || '';
  
  // 根据通知类型添加emoji
  let emoji = '📢';
  if (notification.type === 'task_completed') emoji = '✅';
  else if (notification.type === 'task_failed') emoji = '❌';
  else if (notification.type === 'task_progress') emoji = '🔄';
  else if (notification.type === 'system_alert') emoji = '⚠️';
  
  // 构建富文本消息
  return {
    msg_type: 'post',
    content: {
      post: {
        zh_cn: {
          title: `${emoji} ${title}`,
          content: [
            [
              {
                tag: 'text',
                text: body,
              },
            ],
            [
              {
                tag: 'text',
                text: `\n\n优先级: ${priority || 'normal'}`,
              },
            ],
            ...(notification.target?.name ? [[
              {
                tag: 'text',
                text: `\n目标: ${notification.target.name}`,
              },
            ]] : []),
          ],
        },
      },
    },
  };
}

/**
 * 发送飞书消息
 */
async function sendNotification(notification) {
  const { target, priority } = notification;
  
  // 如果没有配置 webhook，返回错误
  if (!config.webhookUrl) {
    return {
      success: false,
      error: '未配置飞书 Webhook URL，请先配置 feishu-notifier.webhookUrl',
    };
  }
  
  try {
    // 构建消息
    const message = buildMessage(notification);
    
    // 如果配置了 @，添加 at 信息
    if (config.atMobiles.length > 0 || config.isAtAll) {
      message.content.post.zh_cn.content.push([
        {
          tag: 'at',
          at_mobiles: config.atMobiles,
          is_at_all: config.isAtAll,
        },
      ]);
    }
    
    // 构建请求 URL（添加签名）
    let url = config.webhookUrl;
    if (config.secret) {
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = generateSign(config.secret, timestamp);
      url += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
    }
    
    // 发送请求
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    
    const result = await response.json();
    
    if (result.code === 0 || result.StatusCode === 0) {
      return {
        success: true,
        notificationId: `feishu-${Date.now()}`,
        details: result,
      };
    } else {
      return {
        success: false,
        error: result.msg || result.message || '发送失败',
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
 * 发送文本消息（简单模式）
 */
async function sendText(text) {
  return sendNotification({
    id: `text-${Date.now()}`,
    type: 'custom',
    priority: 'normal',
    content: {
      title: 'ClawKit 通知',
      body: text,
    },
    target: { type: 'webhook', id: 'default', name: '飞书群' },
    timestamp: Date.now(),
  });
}

/**
 * 发送卡片消息
 */
async function sendCard(card) {
  const message = {
    msg_type: 'interactive',
    card: {
      config: {
        wide_screen_mode: true,
      },
      header: {
        title: {
          tag: 'plain_text',
          content: card.title || 'ClawKit 通知',
        },
        template: card.color || 'blue',
      },
      elements: card.elements || [],
    },
  };
  
  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    
    const result = await response.json();
    return {
      success: result.code === 0,
      notificationId: `feishu-card-${Date.now()}`,
      details: result,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
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
      title: '飞书通知器测试',
      body: '✅ 这是一条来自 ClawKit 的测试消息。\n\n如果你看到这条消息，说明飞书通知器配置正确。',
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
    // 发送一条测试消息来检查连接
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
  } else if (!pluginConfig.webhookUrl.startsWith('https://')) {
    errors.push('webhookUrl 必须是 HTTPS 地址');
  } else if (!pluginConfig.webhookUrl.includes('open.feishu.cn') && 
             !pluginConfig.webhookUrl.includes('open.larksuite.com')) {
    warnings.push('webhookUrl 建议使用飞书官方域名');
  }
  
  if (pluginConfig.secret && pluginConfig.secret.length < 20) {
    warnings.push('密钥长度建议至少 20 个字符');
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
    supportedTargets: ['webhook', 'group'],
    capabilities: [
      { type: 'text', description: '支持文本消息' },
      { type: 'post', description: '支持富文本消息' },
      { type: 'interactive', description: '支持卡片消息' },
      { type: 'at', description: '支持 @ 成员' },
    ],
  };
}

/**
 * 销毁插件
 */
async function dispose() {
  config = {};
  context = {};
  console.log('[FeishuNotifier] 插件已销毁');
}

// 导出插件
module.exports = {
  meta,
  initialize,
  send: sendNotification,
  sendText,
  sendCard,
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
