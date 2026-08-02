/**
 * Cron 定时触发器插件
 * 
 * 支持基于 Cron 表达式的定时任务触发
 * 支持一次性任务和循环任务
 */

const cronParser = require('cron-parser');

/**
 * 插件元信息
 */
const meta = {
  name: 'cron-trigger',
  version: '1.0.0',
  type: 'trigger',
  description: 'Cron 定时触发器，支持基于 Cron 表达式的定时任务',
  author: 'ClawKit Team',
  homepage: 'https://github.com/clawkit/clawkit',
  keywords: ['trigger', 'cron', 'schedule', 'timer', '定时任务'],
};

/**
 * 插件配置
 */
let config = {
  // 默认时区
  timezone: 'Asia/Shanghai',
  
  // 是否自动启动
  autoStart: true,
  
  // 任务列表
  jobs: [],
};

/**
 * 上下文
 */
let context = {};

/**
 * 定时器引用
 */
let timers = new Map();

/**
 * 事件处理器
 */
let eventHandlers = [];

/**
 * 初始化插件
 * @param {Object} pluginConfig - 插件配置
 * @param {Object} pluginContext - 插件上下文
 */
function initialize(pluginConfig, pluginContext) {
  config = {
    timezone: pluginConfig.timezone || 'Asia/Shanghai',
    autoStart: pluginConfig.autoStart !== false,
    jobs: pluginConfig.jobs || [],
    ...pluginConfig,
  };
  context = pluginContext || {};
  timers = new Map();
  eventHandlers = [];
  
  console.log('[CronTrigger] 插件初始化完成');
  console.log(`[CronTrigger] 时区: ${config.timezone}`);
  console.log(`[CronTrigger] 任务数: ${config.jobs.length}`);
  
  if (config.autoStart) {
    startAll();
  }
}

/**
 * 解析 Cron 表达式
 * @param {string} cronExpr - Cron 表达式
 * @param {string} timezone - 时区
 * @returns {Object} 解析结果
 */
function parseCron(cronExpr, timezone = config.timezone) {
  try {
    const interval = cronParser.parseExpression(cronExpr, {
      currentDate: new Date(),
      tz: timezone,
    });
    
    return {
      valid: true,
      next: interval.next().toDate(),
      interval,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * 获取下次执行时间
 * @param {string} cronExpr - Cron 表达式
 * @returns {Date|null} 下次执行时间
 */
function getNextExecution(cronExpr) {
  const result = parseCron(cronExpr);
  return result.valid ? result.next : null;
}

/**
 * 创建定时任务
 * @param {Object} jobConfig - 任务配置
 * @param {string} jobConfig.id - 任务 ID
 * @param {string} jobConfig.name - 任务名称
 * @param {string} jobConfig.cron - Cron 表达式
 * @param {Object} jobConfig.data - 附加数据
 */
function createJob(jobConfig) {
  const { id, name, cron, data = {} } = jobConfig;
  
  if (!id || !cron) {
    throw new Error('任务 ID 和 Cron 表达式必须提供');
  }
  
  const parseResult = parseCron(cron);
  if (!parseResult.valid) {
    throw new Error(`无效的 Cron 表达式: ${parseResult.error}`);
  }
  
  const job = {
    id,
    name: name || id,
    cron,
    data,
    enabled: true,
    createdAt: new Date().toISOString(),
    lastRun: null,
    nextRun: parseResult.next,
    runCount: 0,
  };
  
  config.jobs.push(job);
  
  if (config.autoStart) {
    startJob(job);
  }
  
  console.log(`[CronTrigger] 创建任务: ${job.name} (${job.cron})`);
  return job;
}

/**
 * 启动单个任务
 * @param {Object} job - 任务对象
 */
function startJob(job) {
  if (timers.has(job.id)) {
    console.log(`[CronTrigger] 任务已运行: ${job.name}`);
    return;
  }
  
  // 计算距离下次执行的时间
  const calculateDelay = () => {
    const now = Date.now();
    const next = job.nextRun ? job.nextRun.getTime() : getNextExecution(job.cron)?.getTime();
    if (!next) return null;
    return Math.max(0, next - now);
  };
  
  const scheduleNext = () => {
    const delay = calculateDelay();
    if (delay === null) return;
    
    const timer = setTimeout(async () => {
      // 执行任务
      await executeJob(job);
      
      // 更新下次执行时间
      job.nextRun = getNextExecution(job.cron);
      job.lastRun = new Date().toISOString();
      
      // 继续调度
      scheduleNext();
    }, delay);
    
    timers.set(job.id, timer);
  };
  
  scheduleNext();
  console.log(`[CronTrigger] 启动任务: ${job.name}`);
}

/**
 * 执行任务
 * @param {Object} job - 任务对象
 */
async function executeJob(job) {
  job.runCount++;
  
  console.log(`[CronTrigger] 执行任务: ${job.name} (#${job.runCount})`);
  
  const event = {
    eventId: `cron-${job.id}-${Date.now()}`,
    eventType: 'scheduled',
    source: 'cron',
    triggerName: job.name,
    timestamp: new Date().toISOString(),
    job: {
      id: job.id,
      name: job.name,
      cron: job.cron,
      runCount: job.runCount,
      lastRun: job.lastRun,
    },
    data: job.data,
    schedule: {
      nextRun: job.nextRun,
      timezone: config.timezone,
    },
  };
  
  // 触发所有处理器
  for (const handler of eventHandlers) {
    try {
      await handler(event);
    } catch (error) {
      console.error(`[CronTrigger] 处理器执行失败:`, error);
    }
  }
}

/**
 * 停止任务
 * @param {string} jobId - 任务 ID
 */
function stopJob(jobId) {
  const timer = timers.get(jobId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(jobId);
    console.log(`[CronTrigger] 停止任务: ${jobId}`);
  }
}

/**
 * 删除任务
 * @param {string} jobId - 任务 ID
 */
function removeJob(jobId) {
  stopJob(jobId);
  const index = config.jobs.findIndex(j => j.id === jobId);
  if (index !== -1) {
    config.jobs.splice(index, 1);
    console.log(`[CronTrigger] 删除任务: ${jobId}`);
  }
}

/**
 * 启动所有任务
 */
function startAll() {
  for (const job of config.jobs) {
    if (job.enabled) {
      startJob(job);
    }
  }
}

/**
 * 停止所有任务
 */
function stopAll() {
  for (const [jobId, timer] of timers) {
    clearTimeout(timer);
  }
  timers.clear();
  console.log('[CronTrigger] 停止所有任务');
}

/**
 * 注册事件处理器
 * @param {Function} handler - 处理器函数
 * @returns {Function} 取消订阅函数
 */
function onTrigger(handler) {
  eventHandlers.push(handler);
  return () => {
    const index = eventHandlers.indexOf(handler);
    if (index !== -1) {
      eventHandlers.splice(index, 1);
    }
  };
}

/**
 * 处理传入的请求（兼容 Webhook 接口）
 * @param {Object} request - 请求对象
 * @param {Object} headers - 请求头
 */
async function handleWebhook(request, headers) {
  // Cron 触发器不支持 Webhook，直接返回
  return {
    success: true,
    processed: false,
    message: 'Cron 触发器不支持 Webhook 请求，请使用定时触发',
  };
}

/**
 * 取消任务
 * @param {string} taskId - 任务 ID
 */
function onCancel(taskId) {
  stopJob(taskId);
  console.log(`[CronTrigger] 取消任务: ${taskId}`);
}

/**
 * 获取任务状态
 * @param {string} jobId - 任务 ID
 */
function getJobStatus(jobId) {
  const job = config.jobs.find(j => j.id === jobId);
  if (!job) return null;
  
  return {
    ...job,
    isRunning: timers.has(jobId),
    nextRun: job.nextRun,
  };
}

/**
 * 获取所有任务
 */
function getAllJobs() {
  return config.jobs.map(job => ({
    ...job,
    isRunning: timers.has(job.id),
    nextRun: job.nextRun,
  }));
}

/**
 * 手动触发任务
 * @param {string} jobId - 任务 ID
 */
async function triggerJob(jobId) {
  const job = config.jobs.find(j => j.id === jobId);
  if (!job) {
    throw new Error(`任务不存在: ${jobId}`);
  }
  
  await executeJob(job);
  return { success: true, jobId };
}

/**
 * 更新任务
 * @param {string} jobId - 任务 ID
 * @param {Object} updates - 更新内容
 */
function updateJob(jobId, updates) {
  const job = config.jobs.find(j => j.id === jobId);
  if (!job) {
    throw new Error(`任务不存在: ${jobId}`);
  }
  
  // 停止旧任务
  stopJob(jobId);
  
  // 更新配置
  Object.assign(job, updates);
  
  // 如果 cron 表达式变了，重新验证
  if (updates.cron) {
    const parseResult = parseCron(updates.cron);
    if (!parseResult.valid) {
      throw new Error(`无效的 Cron 表达式: ${parseResult.error}`);
    }
    job.nextRun = parseResult.next;
  }
  
  // 如果启用了，重启任务
  if (job.enabled) {
    startJob(job);
  }
  
  return job;
}

/**
 * 健康检查
 */
async function healthCheck() {
  return {
    status: 'healthy',
    timezone: config.timezone,
    jobs: {
      total: config.jobs.length,
      running: timers.size,
      enabled: config.jobs.filter(j => j.enabled).length,
    },
    statistics: {
      totalRuns: config.jobs.reduce((sum, j) => sum + j.runCount, 0),
      lastRun: config.jobs
        .filter(j => j.lastRun)
        .sort((a, b) => new Date(b.lastRun) - new Date(a.lastRun))[0]?.lastRun,
    },
  };
}

/**
 * 验证配置
 * @param {Object} pluginConfig - 插件配置
 */
function validatePluginConfig(pluginConfig) {
  const errors = [];
  const warnings = [];
  
  if (!pluginConfig) {
    errors.push('配置不能为空');
    return { valid: false, errors };
  }
  
  // 验证时区
  if (pluginConfig.timezone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: pluginConfig.timezone });
    } catch (e) {
      errors.push(`无效的时区: ${pluginConfig.timezone}`);
    }
  }
  
  // 验证任务
  if (pluginConfig.jobs) {
    for (let i = 0; i < pluginConfig.jobs.length; i++) {
      const job = pluginConfig.jobs[i];
      
      if (!job.id) {
        errors.push(`任务 #${i + 1}: 缺少 ID`);
      }
      
      if (!job.cron) {
        errors.push(`任务 #${i + 1}: 缺少 Cron 表达式`);
      } else {
        const result = parseCron(job.cron, pluginConfig.timezone);
        if (!result.valid) {
          errors.push(`任务 #${i + 1}: 无效的 Cron 表达式 - ${result.error}`);
        }
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
    capabilities: [
      { type: 'scheduled', description: '支持 Cron 定时触发' },
      { type: 'timezone', description: '支持时区配置' },
      { type: 'manual', description: '支持手动触发' },
      { type: 'crud', description: '支持任务 CRUD 操作' },
    ],
    cronFormats: [
      { format: '5字段', example: '* * * * *', description: '分 时 日 月 周' },
      { format: '6字段', example: '* * * * * *', description: '秒 分 时 日 月 周' },
    ],
    examples: [
      { cron: '* * * * *', description: '每分钟' },
      { cron: '0 * * * *', description: '每小时整点' },
      { cron: '0 0 * * *', description: '每天午夜' },
      { cron: '0 9 * * 1-5', description: '工作日上午 9 点' },
      { cron: '0 */2 * * *', description: '每 2 小时' },
      { cron: '0 0 * * 0', description: '每周日午夜' },
      { cron: '0 0 1 * *', description: '每月第一天午夜' },
    ],
  };
}

/**
 * 销毁插件
 */
async function dispose() {
  stopAll();
  config = {};
  context = {};
  eventHandlers = [];
  console.log('[CronTrigger] 插件已销毁');
}

// 导出插件
module.exports = {
  meta,
  initialize,
  handleWebhook,
  onTrigger,
  onCancel,
  createJob,
  removeJob,
  startJob,
  stopJob,
  startAll,
  stopAll,
  getJobStatus,
  getAllJobs,
  getNextExecution,
  triggerJob,
  updateJob,
  healthCheck,
  validateConfig: validatePluginConfig,
  getMeta,
  dispose,
};

// ES Module 兼容
module.exports.default = module.exports;
