/**
 * Claude Code 执行器插件
 * 
 * 支持通过 Claude Code CLI 执行 AI 编程任务
 * 支持本地 Claude Code 和远程 Claude Code API
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');

/**
 * 插件元信息
 */
const meta = {
  name: 'claude-code-executor',
  version: '1.0.0',
  type: 'executor',
  description: 'Claude Code CLI 执行器，支持本地和远程 Claude Code API',
  author: 'ClawKit Team',
  homepage: 'https://github.com/clawkit/clawkit',
  keywords: ['executor', 'claude', 'anthropic', 'ai', 'coding'],
};

/**
 * 插件配置
 */
let config = {
  // 执行模式: 'cli' | 'api'
  mode: 'cli',
  
  // CLI 模式配置
  cli: {
    // Claude Code CLI 路径
    binaryPath: '',
    // 工作目录
    workDir: process.cwd(),
    // 模型 (sonnet, opus, haiku 等)
    model: 'sonnet',
    // 最大 Token 数
    maxTokens: 4096,
    // 是否允许执行命令
    allowExecute: true,
    // 是否允许编辑文件
    allowEdit: true,
    // 是否允许搜索
    allowSearch: true,
  },
  
  // API 模式配置（未来支持）
  api: {
    baseUrl: 'http://localhost:4096',
    apiKey: '',
    timeout: 120000,
  },
  
  // 通用配置
  timeout: 600000, // 10 分钟超时
  retryCount: 0,
};

let context = {};

/**
 * 初始化插件
 * @param {Object} pluginConfig - 插件配置
 * @param {Object} pluginContext - 插件上下文
 */
function initialize(pluginConfig, pluginContext) {
  config = {
    mode: pluginConfig.mode || 'cli',
    cli: {
      binaryPath: pluginConfig.cli?.binaryPath || findClaudeCodeBinary(),
      workDir: pluginConfig.cli?.workDir || process.cwd(),
      model: pluginConfig.cli?.model || 'sonnet',
      maxTokens: pluginConfig.cli?.maxTokens || 4096,
      allowExecute: pluginConfig.cli?.allowExecute !== false,
      allowEdit: pluginConfig.cli?.allowEdit !== false,
      allowSearch: pluginConfig.cli?.allowSearch !== false,
      ...pluginConfig.cli,
    },
    api: {
      baseUrl: pluginConfig.api?.baseUrl || 'http://localhost:4096',
      apiKey: pluginConfig.api?.apiKey || '',
      timeout: pluginConfig.api?.timeout || 120000,
      ...pluginConfig.api,
    },
    timeout: pluginConfig.timeout || 600000,
    retryCount: pluginConfig.retryCount || 0,
    ...pluginConfig,
  };
  context = pluginContext || {};
  
  console.log('[ClaudeCodeExecutor] 插件初始化完成');
  console.log(`[ClaudeCodeExecutor] 执行模式: ${config.mode}`);
  console.log(`[ClaudeCodeExecutor] Claude Code 路径: ${config.cli.binaryPath}`);
}

/**
 * 查找 Claude Code CLI 路径
 */
function findClaudeCodeBinary() {
  // 常见安装路径
  const commonPaths = [
    // npm 全局安装
    'claude-code',
    'claude',
    // Homebrew
    '/usr/local/bin/claude-code',
    '/opt/homebrew/bin/claude-code',
    // Linux
    '/usr/bin/claude-code',
    // 用户目录
    path.join(os.homedir(), '.local/bin/claude-code'),
    path.join(os.homedir(), 'bin/claude-code'),
  ];
  
  // 检查 PATH 环境变量
  const pathEnv = process.env.PATH || '';
  const pathDirs = pathEnv.split(path.delimiter);
  
  for (const dir of pathDirs) {
    commonPaths.push(path.join(dir, 'claude-code'));
    commonPaths.push(path.join(dir, 'claude'));
  }
  
  for (const binaryPath of commonPaths) {
    try {
      execSync(`which ${binaryPath}`, { stdio: 'ignore' });
      return binaryPath;
    } catch (e) {
      // 继续尝试
    }
  }
  
  return 'claude-code'; // 默认值，让系统自己找
}

/**
 * 检查 Claude Code 是否已安装
 * @returns {Object} { installed: boolean, version?: string, path?: string }
 */
function checkInstallation() {
  try {
    const binaryPath = config.cli.binaryPath || 'claude-code';
    
    // 尝试获取版本
    const version = execSync(`${binaryPath} --version 2>&1`, {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    
    return {
      installed: true,
      version: version.replace(/v/, ''),
      path: binaryPath,
    };
  } catch (error) {
    return {
      installed: false,
      error: error.message,
    };
  }
}

/**
 * 构建 Claude Code 命令行参数
 * @param {Object} task - 任务配置
 * @returns {Array} 命令行参数数组
 */
function buildArgs(task) {
  const args = [];
  
  // 模型
  if (config.cli.model) {
    args.push('--model', config.cli.model);
  }
  
  // 最大 Token
  if (config.cli.maxTokens) {
    args.push('--max-tokens', String(config.cli.maxTokens));
  }
  
  // 权限设置
  if (config.cli.allowExecute) {
    args.push('--dangerously-skip-permissions');
  }
  
  // 指定工作目录
  if (task.cwd || config.cli.workDir) {
    args.push('--directory', task.cwd || config.cli.workDir);
  }
  
  // 系统提示
  if (task.systemPrompt) {
    args.push('--system-prompt', task.systemPrompt);
  }
  
  // 附加选项
  if (task.extraArgs) {
    args.push(...task.extraArgs);
  }
  
  return args;
}

/**
 * 通过 CLI 模式执行任务
 * @param {Object} task - 任务配置
 * @returns {Promise<Object>}
 */
async function executeViaCli(task) {
  return new Promise((resolve, reject) => {
    const binaryPath = config.cli.binaryPath || 'claude-code';
    const args = buildArgs(task);
    
    // 如果有 prompt，添加到参数中
    if (task.prompt) {
      // Claude Code 支持通过 stdin 传入 prompt
      args.push('--print');
    }
    
    console.log(`[ClaudeCodeExecutor] 执行命令: ${binaryPath} ${args.join(' ')}`);
    
    const child = spawn(binaryPath, args, {
      cwd: task.cwd || config.cli.workDir,
      shell: false,
      env: {
        ...process.env,
        ...(task.env || {}),
        // Claude Code 特定环境变量
        ANTHROPIC_API_KEY: task.apiKey || process.env.ANTHROPIC_API_KEY,
      },
      stdio: task.prompt ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    });
    
    let stdout = '';
    let stderr = '';
    
    // 如果有 prompt，通过 stdin 传入
    if (task.prompt) {
      child.stdin.write(task.prompt);
      child.stdin.end();
    }
    
    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      
      // 实时输出（如果需要）
      if (task.onProgress) {
        task.onProgress({ type: 'stdout', data: text });
      }
    });
    
    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      
      if (task.onProgress) {
        task.onProgress({ type: 'stderr', data: text });
      }
    });
    
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
      reject(new Error(`Claude Code 执行超时 (${config.timeout}ms)`));
    }, task.timeout || config.timeout);
    
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      
      const success = code === 0;
      
      resolve({
        success,
        output: stdout,
        error: stderr || undefined,
        exitCode: code,
        signal,
        metadata: {
          executor: 'claude-code-cli',
          version: checkInstallation().version,
          duration: Date.now() - (task.startTime || Date.now()),
        },
      });
    });
    
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Claude Code 执行失败: ${err.message}`));
    });
  });
}

/**
 * 通过 API 模式执行任务（未来支持）
 * @param {Object} task - 任务配置
 * @returns {Promise<Object>}
 */
async function executeViaApi(task) {
  const { default: axios } = await import('axios');
  
  const response = await axios.post(
    `${config.api.baseUrl}/execute`,
    {
      prompt: task.prompt,
      model: task.model || config.cli.model,
      maxTokens: task.maxTokens || config.cli.maxTokens,
      workDir: task.cwd || config.cli.workDir,
      systemPrompt: task.systemPrompt,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api.apiKey}`,
      },
      timeout: task.timeout || config.api.timeout,
    }
  );
  
  return {
    success: response.data.success !== false,
    output: response.data.output || response.data.result || '',
    error: response.data.error,
    exitCode: response.data.exitCode,
    metadata: {
      executor: 'claude-code-api',
      apiUrl: config.api.baseUrl,
      duration: response.data.duration,
    },
  };
}

/**
 * 执行任务
 * @param {Object} task - 任务配置
 * @param {string} task.prompt - 要执行的提示
 * @param {string} task.cwd - 工作目录
 * @param {string} task.apiKey - API Key（用于 API 模式）
 * @param {Function} task.onProgress - 进度回调
 * @returns {Promise<Object>}
 */
async function execute(task) {
  task.startTime = Date.now();
  
  try {
    if (config.mode === 'api') {
      return await executeViaApi(task);
    } else {
      return await executeViaCli(task);
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error.message,
      exitCode: -1,
      metadata: {
        executor: config.mode === 'api' ? 'claude-code-api' : 'claude-code-cli',
        error: error.message,
      },
    };
  }
}

/**
 * 执行批量任务
 * @param {Array} tasks - 任务数组
 * @returns {Promise<Array>}
 */
async function executeBatch(tasks) {
  const results = [];
  
  for (const task of tasks) {
    const result = await execute(task);
    results.push(result);
    
    // 如果任务失败，可以选择停止
    if (!result.success && config.stopOnError) {
      break;
    }
  }
  
  return results;
}

/**
 * 健康检查
 * @returns {Promise<Object>}
 */
async function healthCheck() {
  const installCheck = checkInstallation();
  
  if (!installCheck.installed) {
    return {
      status: 'unhealthy',
      error: 'Claude Code 未安装或不在 PATH 中',
      installUrl: 'https://docs.anthropic.com/en/docs/claude-code',
    };
  }
  
  // 检查 API 模式
  if (config.mode === 'api') {
    try {
      const { default: axios } = await import('axios');
      await axios.get(`${config.api.baseUrl}/health`, {
        timeout: 5000,
      });
    } catch (error) {
      return {
        status: 'unhealthy',
        error: `API 服务不可用: ${error.message}`,
        apiUrl: config.api.baseUrl,
      };
    }
  }
  
  return {
    status: 'healthy',
    mode: config.mode,
    version: installCheck.version,
    path: installCheck.path,
    model: config.cli.model,
    capabilities: [
      { type: 'code-generation', description: '代码生成' },
      { type: 'code-review', description: '代码审查' },
      { type: 'refactoring', description: '代码重构' },
      { type: 'testing', description: '测试生成' },
      { type: 'documentation', description: '文档生成' },
      { type: 'command-execution', description: '命令执行' },
      { type: 'file-editing', description: '文件编辑' },
    ],
  };
}

/**
 * 验证配置
 * @param {Object} pluginConfig - 插件配置
 * @returns {Object}
 */
function validatePluginConfig(pluginConfig) {
  const errors = [];
  const warnings = [];
  
  if (!pluginConfig) {
    errors.push('配置不能为空');
    return { valid: false, errors };
  }
  
  // 验证模式
  if (pluginConfig.mode && !['cli', 'api'].includes(pluginConfig.mode)) {
    errors.push(`不支持的执行模式: ${pluginConfig.mode}，支持的值: cli, api`);
  }
  
  // 验证 CLI 模式配置
  if (pluginConfig.mode !== 'api') {
    if (pluginConfig.cli?.binaryPath) {
      // 检查文件是否存在
      const fs = require('fs');
      if (!fs.existsSync(pluginConfig.cli.binaryPath)) {
        warnings.push(`指定的 Claude Code 路径不存在: ${pluginConfig.cli.binaryPath}`);
      }
    }
  }
  
  // 验证 API 模式配置
  if (pluginConfig.mode === 'api') {
    if (!pluginConfig.api?.baseUrl) {
      errors.push('API 模式必须指定 baseUrl');
    }
  }
  
  // 验证模型
  const validModels = ['sonnet', 'opus', 'haiku', 'claude-3-5-sonnet-20241022', 'claude-3-5-opus-20241022'];
  if (pluginConfig.cli?.model && !validModels.some(m => pluginConfig.cli.model.includes(m))) {
    warnings.push(`指定的模型可能不受支持: ${pluginConfig.cli.model}`);
  }
  
  // 验证超时
  if (pluginConfig.timeout && (pluginConfig.timeout < 10000 || pluginConfig.timeout > 3600000)) {
    warnings.push('超时时间建议在 10 秒到 1 小时之间');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * 获取执行器工厂
 * @returns {Object}
 */
function getFactory() {
  return {
    meta: {
      name: 'claude-code-executor',
      displayName: 'Claude Code 执行器',
      version: '1.0.0',
      description: '通过 Claude Code 执行 AI 编程任务',
      capabilities: [
        { type: 'code-generation', description: '代码生成' },
        { type: 'code-review', description: '代码审查' },
        { type: 'refactoring', description: '代码重构' },
        { type: 'testing', description: '测试生成' },
        { type: 'documentation', description: '文档生成' },
        { type: 'command-execution', description: '命令执行' },
        { type: 'file-editing', description: '文件编辑' },
        { type: 'search', description: '代码搜索' },
      ],
    },
    create(cfg) {
      return {
        async execute(task) {
          return execute({ ...cfg, ...task });
        },
        async executeBatch(tasks) {
          return executeBatch(tasks);
        },
        async checkConnection() {
          const result = await healthCheck();
          return result.status === 'healthy';
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
  console.log('[ClaudeCodeExecutor] 插件已销毁');
}

// 导出插件
module.exports = {
  meta,
  initialize,
  execute,
  executeBatch,
  getFactory,
  healthCheck,
  checkInstallation,
  validateConfig: validatePluginConfig,
  dispose,
};

// ES Module 兼容
module.exports.default = module.exports;
