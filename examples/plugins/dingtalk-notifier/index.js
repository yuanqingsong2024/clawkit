/**
 * 钉钉通知器插件示例
 * 
 * 这是一个钉钉 Webhook 通知器插件的实现示例
 * 展示了如何创建一个符合 ClawKit 插件接口的通知器
 */

/**
 * 插件元信息
 */
const meta = {
  name: 'dingtalk-notifier',
  version: '1.0.0',
  type: 'notifier',
  description: '钉钉 Webhook 通知器',
  author: 'ClawKit Team',
};

/**
 * 插件配置
 */
let config = {
  webhookUrl: '',
  secret: '',
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
    atMobiles: pluginConfig.atMobiles || [],
    isAtAll: pluginConfig.isAtAll || false,
    ...pluginConfig,
  };
  context = pluginContext;
  console.log('[DingTalkNotifier] 插件初始化完成');
}

/**
 * 生成签名（如果配置了密钥）
 */
function generateSign(secret) {
  if (!secret) return '';
  
  const timestamp = Date.now();
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = require('crypto').createHmac('sha256', secret);
  hmac.update(stringToSign);
  const sign = hmac.digest('base64');
  
  return encodeURIComponent(`${timestamp}&${sign}`);
}

/**
 * 发送钉钉消息
 */
async function sendNotification(notification) {
  const { content, target, priority } = notification;
  
  // 构建消息内容
  let message = {
    msgtype: 'markdown',
    markdown: {
      title: content.title || 'ClawKit 通知',
      text: `### ${content.title || 'ClawKit 通知'}\n\n${content.body}\n\n${
        target.type === 'group' ? `**目标群组**: ${target.name || target.id}` : ''
      }`
    },
    at: {
      atMobiles: config.atMobiles,
      isAtAll: config.isAtAll,
    },
  };
  
  // 根据通知类型调整消息
  if (notification.type === 'task_completed') {
    message.markdown.text += '\n\n> ✅ 任务已完成';
  } else if (notification.type === 'task_failed') {
    message.markdown.text += '\n\n> ❌ 任务执行失败';
  }
  
  // 如果没有配置 webhook，返回成功但不发送
  if (!config.webhookUrl) {
    return {
      success: false,
      error: '未配置钉钉 Webhook URL',
    };
  }
  
  try {
    // 构建请求 URL（添加签名）
    let url = config.webhookUrl;
    if (config.secret) {
      const sign = generateSign(config.secret);
      url += `&sign=${sign}`;
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
    
    if (result.errcode === 0) {
      return {
        success: true,
        notificationId: `dingtalk-${Date.now()}`,
        details: result,
      };
    } else {
      return {
        success: false,
        error: result.errmsg || '发送失败',
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
      title: '钉钉通知器测试',
      body: '这是一条来自 ClawKit 的测试消息，如果你看到这条消息，说明钉钉通知器配置正确。',
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
 * 检查是否支持特定目标类型
 */
function supportsTarget(targetType) {
  const supportedTargets = ['webhook', 'group'];
  return supportedTargets.includes(targetType);
}

/**
 * 健康检查
 */
async function healthCheck() {
  if (!config.webhookUrl) {
    return false;
  }
  
  try {
    // 简单测试：检查 URL 是否可访问
    const response = await fetch(config.webhookUrl, { method: 'HEAD' });
    return response.ok || response.status === 405; // 405 Method Not Allowed 也是正常的
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
  };
}

/**
 * 销毁插件
 */
async function dispose() {
  config = {};
  context = {};
  console.log('[DingTalkNotifier] 插件已销毁');
}

// 导出插件
module.exports = {
  meta,
  initialize,
  send: sendNotification,
  sendBatch,
  sendTest,
  supportsType,
  supportsTarget,
  healthCheck,
  validateConfig: validatePluginConfig,
  getMeta,
  dispose,
};

// ES Module 兼容
module.exports.default = module.exports;
