/**
 * 简单执行器插件示例
 * 
 * 这是一个最小化的执行器插件实现示例
 * 展示了如何创建一个符合 ClawKit 插件接口的执行器
 */

const { spawn } = require('child_process');

/**
 * 插件元信息
 */
const meta = {
  name: 'simple-executor',
  version: '1.0.0',
  type: 'executor',
  description: '一个简单的命令执行器插件',
  author: 'ClawKit Team',
};

/**
 * 插件配置
 */
let config = {};
let context = {};

/**
 * 初始化插件
 */
function initialize(pluginConfig, pluginContext) {
  config = pluginConfig;
  context = pluginContext;
  console.log('[SimpleExecutor] 插件初始化完成');
}

/**
 * 执行命令
 * @param command 命令字符串，将被拆分为命令和参数
 * @param options 执行选项
 */
async function execute(command, options = {}) {
  const cwd = options.cwd || context.workDir || process.cwd();
  const timeout = options.timeout || 60000;
  
  // 解析命令字符串为命令和参数数组，防止命令注入
  // 只支持通过空格分隔的命令和参数，不支持 shell 特殊字符
  const parts = command.trim().split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);
  
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      shell: false, // 禁用 shell 模式，防止命令注入
      env: { ...process.env, ...options.env },
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`命令执行超时: ${command}`));
    }, timeout);
    
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        success: code === 0,
        output: stdout,
        error: stderr || undefined,
        exitCode: code,
      });
    });
    
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * 健康检查
 */
async function healthCheck() {
  return true;
}

/**
 * 验证配置
 */
function validatePluginConfig(pluginConfig) {
  const errors = [];
  // 简单的配置验证
  if (pluginConfig && typeof pluginConfig !== 'object') {
    errors.push('配置必须是一个对象');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * 获取执行器工厂
 */
function getFactory() {
  return {
    meta: {
      name: 'simple-executor',
      displayName: '简单执行器',
      version: '1.0.0',
      description: '一个简单的命令执行器',
      capabilities: [
        { type: 'shell-execution', description: '支持 shell 命令执行' }
      ],
    },
    create(config) {
      return {
        async execute(command, options) {
          return execute(command, { ...config, ...options });
        },
        async checkConnection() {
          return true;
        },
      };
    },
    validateConfig(cfg) {
      return validatePluginConfig(cfg);
    },
  };
}

/**
 * 销毁插件
 */
async function dispose() {
  config = {};
  context = {};
  console.log('[SimpleExecutor] 插件已销毁');
}

// 导出插件
module.exports = {
  meta,
  initialize,
  getFactory,
  healthCheck,
  validateConfig: validatePluginConfig,
  dispose,
};

// ES Module 兼容
module.exports.default = module.exports;
