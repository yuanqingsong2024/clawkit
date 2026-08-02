/**
 * 自定义脚本执行器插件
 * 
 * 支持执行用户自定义的 Shell、Python、Node.js 脚本
 * 支持脚本模板和参数替换
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * 插件元信息
 */
const meta = {
  name: 'custom-script-executor',
  version: '1.0.0',
  type: 'executor',
  description: '自定义脚本执行器，支持 Shell、Python、Node.js 等脚本类型',
  author: 'ClawKit Team',
  homepage: 'https://github.com/clawkit/clawkit',
  keywords: ['script', 'executor', 'shell', 'python', 'node'],
};

/**
 * 插件配置
 */
let config = {
  // 脚本目录
  scriptsDir: './scripts',
  
  // 默认超时时间（毫秒）
  defaultTimeout: 300000, // 5分钟
  
  // 允许执行的命令（白名单）
  allowedCommands: [],
  
  // 禁止执行的命令（黑名单）
  forbiddenCommands: ['rm -rf /', ':(){ :|:& };:', 'mkfs', 'dd if='],
  
  // 环境变量
  env: {},
  
  // 最大输出大小（字节）
  maxOutputSize: 10 * 1024 * 1024, // 10MB
};

let context = {};

/**
 * 初始化插件
 */
function initialize(pluginConfig, pluginContext) {
  config = {
    scriptsDir: pluginConfig.scriptsDir || './scripts',
    defaultTimeout: pluginConfig.defaultTimeout || 300000,
    allowedCommands: pluginConfig.allowedCommands || [],
    forbiddenCommands: pluginConfig.forbiddenCommands || ['rm -rf /', ':(){ :|:& };:', 'mkfs', 'dd if='],
    env: pluginConfig.env || {},
    maxOutputSize: pluginConfig.maxOutputSize || 10 * 1024 * 1024,
    ...pluginConfig,
  };
  context = pluginContext;
  
  console.log('[CustomScriptExecutor] 插件初始化完成');
}

/**
 * 检查命令是否安全
 */
function isCommandSafe(command) {
  // 检查黑名单
  for (const forbidden of config.forbiddenCommands) {
    if (command.includes(forbidden)) {
      return { safe: false, reason: `命令包含禁止的模式: ${forbidden}` };
    }
  }
  
  // 检查白名单
  if (config.allowedCommands.length > 0) {
    const baseCommand = command.split(/\s+/)[0];
    const isAllowed = config.allowedCommands.some(cmd => {
      if (cmd.includes('*')) {
        const regex = new RegExp('^' + cmd.replace(/\*/g, '.*') + '$');
        return regex.test(baseCommand);
      }
      return baseCommand === cmd;
    });
    
    if (!isAllowed) {
      return { safe: false, reason: `命令不在允许列表中: ${baseCommand}` };
    }
  }
  
  return { safe: true };
}

/**
 * 获取脚本解释器
 */
function getScriptInterpreter(scriptPath) {
  const ext = path.extname(scriptPath).toLowerCase();
  
  const interpreters = {
    '.sh': { command: '/bin/bash', args: ['-c'] },
    '.bash': { command: '/bin/bash', args: ['-c'] },
    '.zsh': { command: '/bin/zsh', args: ['-c'] },
    '.py': { command: 'python3', args: [] },
    '.python': { command: 'python3', args: [] },
    '.js': { command: 'node', args: [] },
    '.ts': { command: 'npx', args: ['ts-node'] },
    '.rb': { command: 'ruby', args: [] },
    '.php': { command: 'php', args: [] },
    '.pl': { command: 'perl', args: [] },
    '.lua': { command: 'lua', args: [] },
    '.go': { command: 'go', args: ['run'] },
  };
  
  return interpreters[ext] || null;
}

/**
 * 替换变量
 */
function substituteVariables(script, variables = {}) {
  let result = script;
  
  // 替换 ${VAR} 和 $VAR 格式的变量
  result = result.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    return variables[varName] !== undefined ? variables[varName] : match;
  });
  
  result = result.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
    return variables[varName] !== undefined ? variables[varName] : match;
  });
  
  // 替换内置变量
  result = result.replace(/\$\{WORK_DIR\}/g, context.workDir || process.cwd());
  result = result.replace(/\$\{TASK_ID\}/g, context.taskId || '');
  result = result.replace(/\$\{TIMESTAMP\}/g, Date.now().toString());
  
  return result;
}

/**
 * 执行 Shell 命令
 */
function executeCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    const cwd = options.cwd || context.workDir || process.cwd();
    const timeout = options.timeout || config.defaultTimeout;
    const env = { ...process.env, ...config.env, ...options.env };
    
    // 检查命令安全性
    const safetyCheck = isCommandSafe(command);
    if (!safetyCheck.safe) {
      resolve({
        success: false,
        output: '',
        error: safetyCheck.reason,
        exitCode: -1,
      });
      return;
    }
    
    let stdout = '';
    let stderr = '';
    let killed = false;
    
    const child = spawn('/bin/bash', ['-c', command], {
      cwd,
      env,
      shell: false,
    });
    
    child.stdout.on('data', (data) => {
      if (stdout.length + data.length > config.maxOutputSize) {
        stdout += data.toString().substring(0, config.maxOutputSize - stdout.length);
        stdout += '\n[输出截断: 超出最大限制]';
        child.kill();
        killed = true;
        return;
      }
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      if (stderr.length + data.length > config.maxOutputSize) {
        stderr += data.toString().substring(0, config.maxOutputSize - stderr.length);
        stderr += '\n[错误输出截断: 超出最大限制]';
        return;
      }
      stderr += data.toString();
    });
    
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      killed = true;
    }, timeout);
    
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        success: killed ? null : code === 0,
        output: stdout,
        error: stderr || undefined,
        exitCode: killed ? -1 : code,
        killed,
      });
    });
    
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * 执行脚本文件
 */
function executeScript(scriptPath, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    // 解析脚本路径
    let fullPath = scriptPath;
    if (!path.isAbsolute(scriptPath)) {
      fullPath = path.resolve(context.workDir || process.cwd(), config.scriptsDir, scriptPath);
    }
    
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      resolve({
        success: false,
        output: '',
        error: `脚本文件不存在: ${scriptPath}`,
        exitCode: -1,
      });
      return;
    }
    
    // 获取解释器
    const interpreter = getScriptInterpreter(fullPath);
    if (!interpreter) {
      resolve({
        success: false,
        output: '',
        error: `不支持的脚本类型: ${path.extname(scriptPath)}`,
        exitCode: -1,
      });
      return;
    }
    
    const cwd = options.cwd || context.workDir || path.dirname(fullPath);
    const timeout = options.timeout || config.defaultTimeout;
    const env = { ...process.env, ...config.env, ...options.env };
    const variables = options.variables || {};
    
    // 读取脚本内容并替换变量
    let scriptContent = fs.readFileSync(fullPath, 'utf-8');
    scriptContent = substituteVariables(scriptContent, variables);
    
    let stdout = '';
    let stderr = '';
    let killed = false;
    
    // 使用解释器执行脚本
    const childArgs = [...interpreter.args, scriptContent, ...args];
    const child = spawn(interpreter.command, childArgs, {
      cwd,
      env,
      shell: false,
    });
    
    child.stdout.on('data', (data) => {
      if (stdout.length + data.length > config.maxOutputSize) {
        stdout += data.toString().substring(0, config.maxOutputSize - stdout.length);
        stdout += '\n[输出截断: 超出最大限制]';
        child.kill();
        killed = true;
        return;
      }
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      killed = true;
    }, timeout);
    
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        success: killed ? null : code === 0,
        output: stdout,
        error: stderr || undefined,
        exitCode: killed ? -1 : code,
        killed,
      });
    });
    
    child.on('error', reject);
  });
}

/**
 * 执行任务
 */
async function execute(task, options = {}) {
  const { script, command, args, variables, timeout } = task;
  
  try {
    let result;
    
    if (script) {
      // 执行脚本文件
      result = await executeScript(script, args || [], { variables, timeout });
    } else if (command) {
      // 执行命令
      result = await executeCommand(command, { timeout });
    } else {
      return {
        success: false,
        output: '',
        error: '必须提供 script 或 command 参数',
        exitCode: -1,
      };
    }
    
    return result;
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error.message || '执行失败',
      exitCode: -1,
    };
  }
}

/**
 * 健康检查
 */
async function healthCheck() {
  // 检查脚本目录
  const scriptsDir = path.resolve(context.workDir || process.cwd(), config.scriptsDir);
  
  return {
    status: 'healthy',
    config: {
      scriptsDir,
      scriptsDirExists: fs.existsSync(scriptsDir),
      defaultTimeout: config.defaultTimeout,
      allowedCommandsCount: config.allowedCommands.length,
      hasEnvVars: Object.keys(config.env).length > 0,
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
  
  if (pluginConfig.defaultTimeout && pluginConfig.defaultTimeout < 1000) {
    warnings.push('默认超时时间建议至少 1000 毫秒');
  }
  
  if (pluginConfig.maxOutputSize && pluginConfig.maxOutputSize < 1024) {
    warnings.push('最大输出大小建议至少 1024 字节');
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
    supportedScriptTypes: ['sh', 'bash', 'py', 'python', 'js', 'ts', 'rb', 'php', 'pl', 'lua', 'go'],
    capabilities: [
      { type: 'shell', description: '支持 Shell 脚本' },
      { type: 'python', description: '支持 Python 脚本' },
      { type: 'nodejs', description: '支持 Node.js 脚本' },
      { type: 'variables', description: '支持变量替换' },
      { type: 'security', description: '命令安全检查' },
    ],
  };
}

/**
 * 销毁插件
 */
async function dispose() {
  config = {};
  context = {};
  console.log('[CustomScriptExecutor] 插件已销毁');
}

/**
 * 获取执行器工厂
 */
function getFactory() {
  return {
    meta: {
      name: 'custom-script-executor',
      displayName: '自定义脚本执行器',
      version: '1.0.0',
      description: '执行自定义脚本',
    },
    create(cfg) {
      return {
        async execute(task, options) {
          return execute(task, { ...cfg, ...options });
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

// 导出插件
module.exports = {
  meta,
  initialize,
  execute,
  executeCommand,
  executeScript,
  healthCheck,
  validateConfig: validatePluginConfig,
  getMeta,
  getFactory,
  dispose,
};

// ES Module 兼容
module.exports.default = module.exports;
