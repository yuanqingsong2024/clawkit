/**
 * 邮件通知器插件
 * 
 * 支持通过 SMTP 服务器发送邮件通知
 * 支持 HTML 邮件和纯文本邮件
 */

const nodemailer = require('nodemailer');

/**
 * 插件元信息
 */
const meta = {
  name: 'email-notifier',
  version: '1.0.0',
  type: 'notifier',
  description: '邮件通知器，支持通过 SMTP 发送邮件通知',
  author: 'ClawKit Team',
  homepage: 'https://github.com/clawkit/clawkit',
  keywords: ['email', 'smtp', 'notification', 'mail'],
};

/**
 * 插件配置
 */
let config = {
  // SMTP 服务器配置
  host: 'smtp.example.com',
  port: 465,
  secure: true, // true for 465, false for other ports
  user: '',
  pass: '',
  
  // 发件人配置
  from: 'ClawKit <noreply@example.com>',
  fromName: 'ClawKit',
  
  // 默认收件人
  to: [],
  cc: [],
  bcc: [],
  
  // 邮件模板
  templates: {},
};

let transporter = null;
let context = {};

/**
 * 初始化插件
 */
function initialize(pluginConfig, pluginContext) {
  config = {
    host: pluginConfig.host || 'smtp.example.com',
    port: pluginConfig.port || 465,
    secure: pluginConfig.secure !== undefined ? pluginConfig.secure : true,
    user: pluginConfig.user || '',
    pass: pluginConfig.pass || '',
    from: pluginConfig.from || 'ClawKit <noreply@example.com>',
    fromName: pluginConfig.fromName || 'ClawKit',
    to: pluginConfig.to || [],
    cc: pluginConfig.cc || [],
    bcc: pluginConfig.bcc || [],
    templates: pluginConfig.templates || {},
    ...pluginConfig,
  };
  context = pluginContext;
  
  // 创建 transporter
  createTransporter();
  
  console.log('[EmailNotifier] 插件初始化完成');
}

/**
 * 创建邮件传输器
 */
function createTransporter() {
  if (!config.user || !config.host) {
    transporter = null;
    return;
  }
  
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    // 连接池配置
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
}

/**
 * 构建邮件 HTML 内容
 */
function buildHtml(notification) {
  const { content, priority } = notification;
  const title = content.title || 'ClawKit 通知';
  const body = content.body || '';
  
  // 根据通知类型设置颜色
  let color = '#1890ff'; // 默认蓝色
  let icon = '📢';
  if (notification.type === 'task_completed') {
    color = '#52c41a';
    icon = '✅';
  } else if (notification.type === 'task_failed') {
    color = '#ff4d4f';
    icon = '❌';
  } else if (notification.type === 'task_progress') {
    color = '#faad14';
    icon = '🔄';
  } else if (notification.type === 'system_alert') {
    color = '#ff4d4f';
    icon = '⚠️';
  }
  
  // 优先级标签
  const priorityLabel = {
    urgent: { text: '紧急', color: '#ff4d4f' },
    high: { text: '高', color: '#fa8c16' },
    normal: { text: '普通', color: '#1890ff' },
    low: { text: '低', color: '#8c8c8c' },
  };
  const priorityInfo = priorityLabel[priority] || priorityLabel.normal;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: ${color}; color: white; padding: 20px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 500; }
    .body { padding: 20px; }
    .title { font-size: 18px; font-weight: 500; color: #262626; margin-bottom: 16px; }
    .content { color: #595959; line-height: 1.8; white-space: pre-wrap; }
    .footer { background: #fafafa; padding: 16px 20px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #8c8c8c; }
    .priority { display: inline-block; padding: 2px 8px; border-radius: 4px; background: ${priorityInfo.color}; color: white; font-size: 12px; }
    .highlight { background: #f5f5f5; padding: 12px; border-radius: 4px; margin: 12px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${icon} ${title}</h1>
    </div>
    <div class="body">
      <div class="content">${body}</div>
      ${notification.target?.name ? `<div class="highlight"><strong>目标:</strong> ${notification.target.name}</div>` : ''}
    </div>
    <div class="footer">
      <span class="priority">${priorityInfo.text}</span> · 由 ClawKit 自动发送 · ${new Date().toLocaleString('zh-CN')}
    </div>
  </div>
</body>
</html>
`;
}

/**
 * 构建纯文本内容
 */
function buildText(notification) {
  const { content, priority } = notification;
  const title = content.title || 'ClawKit 通知';
  const body = content.body || '';
  
  let prefix = '📢';
  if (notification.type === 'task_completed') prefix = '✅';
  else if (notification.type === 'task_failed') prefix = '❌';
  else if (notification.type === 'system_alert') prefix = '⚠️';
  
  let text = `${prefix} ${title}\n`;
  text += `${'='.repeat(title.length + 2)}\n\n`;
  text += `${body}\n\n`;
  text += `优先级: ${priority || 'normal'}\n`;
  if (notification.target?.name) {
    text += `目标: ${notification.target.name}\n`;
  }
  text += `\n---\n由 ClawKit 自动发送\n`;
  
  return text;
}

/**
 * 发送邮件通知
 */
async function sendNotification(notification) {
  // 如果没有配置 transporter
  if (!transporter) {
    return {
      success: false,
      error: '未配置邮件 SMTP 服务器，请先配置 email-notifier',
    };
  }
  
  const { content } = notification;
  const title = content.title || 'ClawKit 通知';
  
  // 获取收件人
  const to = notification.target?.email 
    ? notification.target.email 
    : (config.to.length > 0 ? config.to : []);
  
  if (to.length === 0) {
    return {
      success: false,
      error: '未指定收件人',
    };
  }
  
  try {
    const info = await transporter.sendMail({
      from: config.from,
      to: to.join(', '),
      cc: config.cc.length > 0 ? config.cc.join(', ') : undefined,
      bcc: config.bcc.length > 0 ? config.bcc.join(', ') : undefined,
      subject: `[ClawKit] ${title}`,
      text: buildText(notification),
      html: buildHtml(notification),
    });
    
    return {
      success: true,
      notificationId: `email-${Date.now()}`,
      messageId: info.messageId,
      details: {
        accepted: info.accepted,
        rejected: info.rejected,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || '发送邮件失败',
    };
  }
}

/**
 * 发送简单邮件
 */
async function sendEmail(to, subject, body) {
  return new Promise((resolve, reject) => {
    if (!transporter) {
      resolve({ success: false, error: '未配置 SMTP 服务器' });
      return;
    }
    
    transporter.sendMail({
      from: config.from,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: `[ClawKit] ${subject}`,
      text: body,
    }, (error, info) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({
          success: true,
          notificationId: `email-${Date.now()}`,
          messageId: info.messageId,
        });
      }
    });
  });
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
 * 发送测试邮件
 */
async function sendTest(target) {
  const testNotification = {
    id: `test-${Date.now()}`,
    type: 'system_alert',
    priority: 'normal',
    content: {
      title: '邮件通知器测试',
      body: '这是一条来自 ClawKit 的测试邮件。\n\n如果你收到这条邮件，说明邮件通知器配置正确。',
    },
    target: target || { type: 'email', id: 'test', name: '测试收件人', email: config.to[0] || 'test@example.com' },
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
  if (!transporter) {
    return false;
  }
  
  try {
    // 验证 SMTP 连接
    const verified = await transporter.verify();
    return verified;
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
  
  if (!pluginConfig.host) {
    errors.push('缺少 SMTP 主机地址 (host)');
  }
  
  if (!pluginConfig.user) {
    errors.push('缺少 SMTP 用户名 (user)');
  }
  
  if (!pluginConfig.pass) {
    errors.push('缺少 SMTP 密码 (pass)');
  }
  
  if (pluginConfig.port && (pluginConfig.port < 1 || pluginConfig.port > 65535)) {
    errors.push('SMTP 端口号无效');
  }
  
  if (pluginConfig.to && pluginConfig.to.length === 0) {
    warnings.push('建议配置默认收件人 (to)');
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
    supportedTargets: ['email'],
    capabilities: [
      { type: 'text', description: '支持纯文本邮件' },
      { type: 'html', description: '支持 HTML 邮件' },
      { type: 'cc', description: '支持抄送' },
      { type: 'bcc', description: '支持密送' },
      { type: 'templates', description: '支持邮件模板' },
    ],
  };
}

/**
 * 销毁插件
 */
async function dispose() {
  if (transporter) {
    transporter.close();
    transporter = null;
  }
  config = {};
  context = {};
  console.log('[EmailNotifier] 插件已销毁');
}

// 导出插件
module.exports = {
  meta,
  initialize,
  send: sendNotification,
  sendEmail,
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
