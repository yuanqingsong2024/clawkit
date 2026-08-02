/**
 * GitHub Actions 集成插件
 * 
 * 支持触发、监控和管理 GitHub Actions workflow
 * 支持与 Pull Request、Issue 等事件联动
 */

const crypto = require('crypto');

/**
 * 插件元信息
 */
const meta = {
  name: 'github-actions',
  version: '1.0.0',
  type: 'executor',
  description: 'GitHub Actions 集成，支持触发、监控和管理 workflow',
  author: 'ClawKit Team',
  homepage: 'https://github.com/clawkit/clawkit',
  keywords: ['github', 'actions', 'ci', 'cd', 'workflow', 'automation'],
};

/**
 * 插件配置
 */
let config = {
  // GitHub API 配置
  apiUrl: 'https://api.github.com',
  
  // 个人访问令牌或 GitHub App Token
  token: '',
  
  // 默认仓库
  owner: '',
  repo: '',
  
  // 触发器配置
  trigger: {
    // 是否自动触发
    autoTrigger: false,
    // 触发的事件类型
    events: ['push', 'pull_request'],
    // 允许的分支
    branches: [],
    // 排除的分支
    excludeBranches: [],
  },
  
  // 通知配置
  notify: {
    // 是否发送通知
    enabled: true,
    // 通知的事件类型
    onEvents: ['workflow_run', 'check_run'],
  },
};

let context = {};
let eventHandlers = [];
let httpClient = null;

/**
 * 初始化插件
 * @param {Object} pluginConfig - 插件配置
 * @param {Object} pluginContext - 插件上下文
 */
function initialize(pluginConfig, pluginContext) {
  config = {
    apiUrl: pluginConfig.apiUrl || 'https://api.github.com',
    token: pluginConfig.token || process.env.GITHUB_TOKEN || '',
    owner: pluginConfig.owner || '',
    repo: pluginConfig.repo || '',
    trigger: {
      autoTrigger: pluginConfig.trigger?.autoTrigger || false,
      events: pluginConfig.trigger?.events || ['push', 'pull_request'],
      branches: pluginConfig.trigger?.branches || [],
      excludeBranches: pluginConfig.trigger?.excludeBranches || [],
      ...pluginConfig.trigger,
    },
    notify: {
      enabled: pluginConfig.notify?.enabled !== false,
      onEvents: pluginConfig.notify?.onEvents || ['workflow_run', 'check_run'],
      ...pluginConfig.notify,
    },
    ...pluginConfig,
  };
  context = pluginContext || {};
  
  // 初始化 HTTP 客户端
  httpClient = createHttpClient();
  
  console.log('[GitHubActions] 插件初始化完成');
  console.log(`[GitHubActions] 默认仓库: ${config.owner}/${config.repo}`);
}

/**
 * 创建 HTTP 客户端
 */
function createHttpClient() {
  return {
    async request(method, path, options = {}) {
      const url = `${config.apiUrl}${path}`;
      const headers = {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...options.headers,
      };
      
      if (options.body) {
        headers['Content-Type'] = 'application/json';
      }
      
      const response = await fetch(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`GitHub API 错误: ${response.status} - ${error.message || response.statusText}`);
      }
      
      return response.json();
    },
    
    get(path, options) {
      return this.request('GET', path, options);
    },
    
    post(path, body, options = {}) {
      return this.request('POST', path, { ...options, body });
    },
    
    put(path, body, options = {}) {
      return this.request('PUT', path, { ...options, body });
    },
    
    patch(path, body, options = {}) {
      return this.request('PATCH', path, { ...options, body });
    },
    
    delete(path, options) {
      return this.request('DELETE', path, options);
    },
  };
}

/**
 * 触发 Workflow
 * @param {Object} options - 触发选项
 */
async function triggerWorkflow(options) {
  const { owner = config.owner, repo = config.repo, workflowId, ref, inputs = {} } = options;
  
  if (!workflowId || !owner || !repo) {
    throw new Error('缺少必要参数: workflowId, owner, repo');
  }
  
  const path = `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;
  
  const body = {
    ref: ref || 'main',
  };
  
  // workflow_dispatch 类型的 workflow 可以传递 inputs
  if (Object.keys(inputs).length > 0) {
    body.inputs = inputs;
  }
  
  await httpClient.post(path, body);
  
  console.log(`[GitHubActions] 触发 workflow: ${workflowId} @ ${ref || 'main'}`);
  
  return {
    success: true,
    message: `Workflow ${workflowId} 已触发`,
    workflowId,
    ref: ref || 'main',
  };
}

/**
 * 列出 Workflows
 * @param {Object} options - 查询选项
 */
async function listWorkflows(options = {}) {
  const { owner = config.owner, repo = config.repo, per_page = 30, page = 1 } = options;
  
  if (!owner || !repo) {
    throw new Error('缺少必要参数: owner, repo');
  }
  
  const path = `/repos/${owner}/${repo}/actions/workflows?per_page=${per_page}&page=${page}`;
  const result = await httpClient.get(path);
  
  return {
    workflows: result.workflows.map(w => ({
      id: w.id,
      name: w.name,
      path: w.path,
      state: w.state,
      createdAt: w.created_at,
      updatedAt: w.updated_at,
    })),
    total: result.total_count,
  };
}

/**
 * 获取 Workflow 详情
 * @param {Object} options - 查询选项
 */
async function getWorkflow(options = {}) {
  const { owner = config.owner, repo = config.repo, workflowId } = options;
  
  if (!workflowId || !owner || !repo) {
    throw new Error('缺少必要参数: workflowId, owner, repo');
  }
  
  const path = `/repos/${owner}/${repo}/actions/workflows/${workflowId}`;
  const workflow = await httpClient.get(path);
  
  return {
    id: workflow.id,
    name: workflow.name,
    path: workflow.path,
    state: workflow.state,
    createdAt: workflow.created_at,
    updatedAt: workflow.updated_at,
    htmlUrl: workflow.html_url,
  };
}

/**
 * 列出 Workflow Runs
 * @param {Object} options - 查询选项
 */
async function listWorkflowRuns(options = {}) {
  const { 
    owner = config.owner, 
    repo = config.repo, 
    workflowId,
    actor,
    branch,
    event,
    status,
    per_page = 30,
    page = 1,
  } = options;
  
  if (!owner || !repo) {
    throw new Error('缺少必要参数: owner, repo');
  }
  
  let path = `/repos/${owner}/${repo}/actions/workflows`;
  if (workflowId) {
    path += `/${workflowId}/runs`;
  } else {
    path += '/runs';
  }
  
  const params = new URLSearchParams();
  if (actor) params.set('actor', actor);
  if (branch) params.set('branch', branch);
  if (event) params.set('event', event);
  if (status) params.set('status', status);
  params.set('per_page', String(per_page));
  params.set('page', String(page));
  
  path += `?${params.toString()}`;
  
  const result = await httpClient.get(path);
  
  return {
    runs: result.workflow_runs.map(r => formatRun(r)),
    total: result.total_count,
  };
}

/**
 * 格式化 Run 数据
 */
function formatRun(run) {
  return {
    id: run.id,
    name: run.name,
    headBranch: run.head_branch,
    headSha: run.head_sha,
    status: run.status,
    conclusion: run.conclusion,
    event: run.event,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    runNumber: run.run_number,
    runAttempt: run.run_attempt,
    htmlUrl: run.html_url,
    actor: run.actor?.login,
    headCommit: run.head_commit ? {
      message: run.head_commit.message,
      author: run.head_commit.author?.name,
    } : null,
    jobsUrl: run.jobs_url,
    logsUrl: run.logs_url,
  };
}

/**
 * 获取 Run 详情
 * @param {Object} options - 查询选项
 */
async function getWorkflowRun(options = {}) {
  const { owner = config.owner, repo = config.repo, runId } = options;
  
  if (!runId || !owner || !repo) {
    throw new Error('缺少必要参数: runId, owner, repo');
  }
  
  const path = `/repos/${owner}/${repo}/actions/runs/${runId}`;
  const run = await httpClient.get(path);
  
  return formatRun(run);
}

/**
 * 取消 Run
 * @param {Object} options - 选项
 */
async function cancelRun(options = {}) {
  const { owner = config.owner, repo = config.repo, runId } = options;
  
  if (!runId || !owner || !repo) {
    throw new Error('缺少必要参数: runId, owner, repo');
  }
  
  const path = `/repos/${owner}/${repo}/actions/runs/${runId}/cancel`;
  await httpClient.post(path, {});
  
  console.log(`[GitHubActions] 取消 run: ${runId}`);
  
  return { success: true, message: `Run ${runId} 已取消`, runId };
}

/**
 * 重新运行 Run
 * @param {Object} options - 选项
 */
async function rerunRun(options = {}) {
  const { owner = config.owner, repo = config.repo, runId } = options;
  
  if (!runId || !owner || !repo) {
    throw new Error('缺少必要参数: runId, owner, repo');
  }
  
  const path = `/repos/${owner}/${repo}/actions/runs/${runId}/rerun`;
  await httpClient.post(path, {});
  
  console.log(`[GitHubActions] 重新运行 run: ${runId}`);
  
  return { success: true, message: `Run ${runId} 正在重新运行`, runId };
}

/**
 * 获取 Run 日志
 * @param {Object} options - 选项
 */
async function getRunLogs(options = {}) {
  const { owner = config.owner, repo = config.repo, runId } = options;
  
  if (!runId || !owner || !repo) {
    throw new Error('缺少必要参数: runId, owner, repo');
  }
  
  const path = `/repos/${owner}/${repo}/actions/runs/${runId}/logs`;
  
  // GitHub API 返回 302 重定向到日志下载链接
  const response = await fetch(`${config.apiUrl}${path}`, {
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/vnd.github+json',
    },
    redirect: 'manual',
  });
  
  if (response.status === 302) {
    const logUrl = response.headers.get('location');
    if (logUrl) {
      const logResponse = await fetch(logUrl);
      const logs = await logResponse.text();
      return { logs, url: logUrl };
    }
  }
  
  // 如果没有重定向，尝试直接获取
  const result = await httpClient.get(path);
  return result;
}

/**
 * 获取 Run Jobs
 * @param {Object} options - 选项
 */
async function getRunJobs(options = {}) {
  const { owner = config.owner, repo = config.repo, runId, per_page = 100, page = 1 } = options;
  
  if (!runId || !owner || !repo) {
    throw new Error('缺少必要参数: runId, owner, repo');
  }
  
  const path = `/repos/${owner}/${repo}/actions/runs/${runId}/jobs?per_page=${per_page}&page=${page}`;
  const result = await httpClient.get(path);
  
  return {
    jobs: result.jobs.map(job => ({
      id: job.id,
      name: job.name,
      status: job.status,
      conclusion: job.conclusion,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      htmlUrl: job.html_url,
      steps: job.steps?.map(s => ({
        name: s.name,
        status: s.status,
        conclusion: s.conclusion,
        number: s.number,
      })),
    })),
    total: result.total_count,
  };
}

/**
 * 获取 Check Runs
 * @param {Object} options - 选项
 */
async function getCheckRuns(options = {}) {
  const { owner = config.owner, repo = config.repo, ref, checkName } = options;
  
  if (!owner || !repo) {
    throw new Error('缺少必要参数: owner, repo');
  }
  
  let path = `/repos/${owner}/${repo}/commits/${ref}/check-runs`;
  if (checkName) {
    path += `?check_name=${encodeURIComponent(checkName)}`;
  }
  
  const result = await httpClient.get(path);
  
  return {
    checkRuns: result.check_runs.map(cr => ({
      id: cr.id,
      name: cr.name,
      status: cr.status,
      conclusion: cr.conclusion,
      startedAt: cr.started_at,
      completedAt: cr.completed_at,
      htmlUrl: cr.html_url,
      output: {
        title: cr.output?.title,
        summary: cr.output?.summary,
      },
    })),
    total: result.total_count,
  };
}

/**
 * 创建 Check Run
 * @param {Object} options - 选项
 */
async function createCheckRun(options = {}) {
  const { owner = config.owner, repo = config.repo, name, headSha, detailsUrl, status, conclusion, output } = options;
  
  if (!owner || !repo || !name || !headSha) {
    throw new Error('缺少必要参数: owner, repo, name, headSha');
  }
  
  const path = `/repos/${owner}/${repo}/check-runs`;
  
  const body = {
    name,
    head_sha: headSha,
  };
  
  if (detailsUrl) body.details_url = detailsUrl;
  if (status) body.status = status;
  if (conclusion) body.conclusion = conclusion;
  if (output) body.output = output;
  
  const result = await httpClient.post(path, body);
  
  return {
    id: result.id,
    name: result.name,
    status: result.status,
    htmlUrl: result.html_url,
  };
}

/**
 * 更新 Check Run
 * @param {Object} options - 选项
 */
async function updateCheckRun(options = {}) {
  const { owner = config.owner, repo = config.repo, checkRunId, status, conclusion, output } = options;
  
  if (!owner || !repo || !checkRunId) {
    throw new Error('缺少必要参数: owner, repo, checkRunId');
  }
  
  const path = `/repos/${owner}/${repo}/check-runs/${checkRunId}`;
  
  const body = {};
  if (status) body.status = status;
  if (conclusion) body.conclusion = conclusion;
  if (output) body.output = output;
  
  const result = await httpClient.patch(path, body);
  
  return {
    id: result.id,
    name: result.name,
    status: result.status,
    conclusion: result.conclusion,
  };
}

/**
 * 处理 GitHub Webhook 事件
 * @param {Object} payload - Webhook payload
 * @param {Object} headers - 请求头
 */
async function handleWebhook(payload, headers) {
  const event = headers['x-github-event'];
  
  if (event === 'workflow_run') {
    return handleWorkflowRunEvent(payload);
  }
  
  if (event === 'check_run') {
    return handleCheckRunEvent(payload);
  }
  
  return {
    success: true,
    processed: false,
    message: `未处理的事件类型: ${event}`,
  };
}

/**
 * 处理 workflow_run 事件
 */
async function handleWorkflowRunEvent(payload) {
  const { action, workflow_run, repository } = payload;
  
  const event = {
    eventId: `github-actions-${workflow_run.id}`,
    eventType: 'workflow_run',
    source: 'github-actions',
    timestamp: new Date().toISOString(),
    action,
    repository: {
      id: repository.id,
      name: repository.name,
      fullName: repository.full_name,
    },
    run: formatRun(workflow_run),
    raw: payload,
  };
  
  // 触发处理器
  for (const handler of eventHandlers) {
    try {
      await handler(event);
    } catch (error) {
      console.error('[GitHubActions] 处理器执行失败:', error);
    }
  }
  
  return {
    success: true,
    processed: true,
    event,
  };
}

/**
 * 处理 check_run 事件
 */
async function handleCheckRunEvent(payload) {
  const { action, check_run, repository } = payload;
  
  const event = {
    eventId: `github-actions-check-${check_run.id}`,
    eventType: 'check_run',
    source: 'github-actions',
    timestamp: new Date().toISOString(),
    action,
    repository: {
      id: repository.id,
      name: repository.name,
      fullName: repository.full_name,
    },
    checkRun: {
      id: check_run.id,
      name: check_run.name,
      status: check_run.status,
      conclusion: check_run.conclusion,
      headSha: check_run.head_sha,
    },
    raw: payload,
  };
  
  for (const handler of eventHandlers) {
    try {
      await handler(event);
    } catch (error) {
      console.error('[GitHubActions] 处理器执行失败:', error);
    }
  }
  
  return {
    success: true,
    processed: true,
    event,
  };
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
 * 取消任务
 * @param {string} taskId - 任务 ID
 */
function onCancel(taskId) {
  // 可以实现取消正在运行的 workflow
  console.log(`[GitHubActions] 取消任务: ${taskId}`);
}

/**
 * 健康检查
 */
async function healthCheck() {
  try {
    // 测试 API 连接
    const result = await httpClient.get('/user');
    
    return {
      status: 'healthy',
      authenticated: true,
      user: result.login,
      rateLimit: {
        limit: 5000,
        remaining: 'unknown',
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
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
  
  if (!pluginConfig.token && !process.env.GITHUB_TOKEN) {
    errors.push('缺少 GitHub Token');
  }
  
  if (!pluginConfig.owner || !pluginConfig.repo) {
    warnings.push('建议配置默认的 owner 和 repo');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * 获取执行器工厂
 */
function getFactory() {
  return {
    meta: {
      name: 'github-actions',
      displayName: 'GitHub Actions 执行器',
      version: '1.0.0',
      description: '与 GitHub Actions 深度集成，支持 workflow 触发和管理',
      capabilities: [
        { type: 'trigger-workflow', description: '触发 workflow' },
        { type: 'monitor-runs', description: '监控运行状态' },
        { type: 'get-logs', description: '获取运行日志' },
        { type: 'cancel-runs', description: '取消运行' },
        { type: 'rerun', description: '重新运行' },
        { type: 'check-runs', description: '管理 Check Runs' },
      ],
    },
    create(cfg) {
      return {
        async execute(task) {
          // 执行 GitHub Actions 相关操作
          const { action, options } = task;
          
          switch (action) {
            case 'trigger':
              return triggerWorkflow({ ...cfg, ...options });
            case 'list-workflows':
              return listWorkflows({ ...cfg, ...options });
            case 'list-runs':
              return listWorkflowRuns({ ...cfg, ...options });
            case 'cancel-run':
              return cancelRun({ ...cfg, ...options });
            case 'rerun':
              return rerunRun({ ...cfg, ...options });
            case 'get-logs':
              return getRunLogs({ ...cfg, ...options });
            case 'get-jobs':
              return getRunJobs({ ...cfg, ...options });
            default:
              throw new Error(`未知的 action: ${action}`);
          }
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
 * 获取插件元信息
 */
function getMeta() {
  return {
    ...meta,
    capabilities: [
      { type: 'workflow-trigger', description: '触发 workflow' },
      { type: 'workflow-monitor', description: '监控 workflow 运行' },
      { type: 'logs-retrieval', description: '获取运行日志' },
      { type: 'run-management', description: '取消/重新运行' },
      { type: 'check-integration', description: 'Check Runs 集成' },
    ],
    supportedEvents: [
      'workflow_run',
      'workflow_job',
      'check_run',
      'check_suite',
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
  httpClient = null;
  console.log('[GitHubActions] 插件已销毁');
}

// 导出插件
module.exports = {
  meta,
  initialize,
  getFactory,
  // Workflow 操作
  triggerWorkflow,
  listWorkflows,
  getWorkflow,
  listWorkflowRuns,
  getWorkflowRun,
  cancelRun,
  rerunRun,
  getRunLogs,
  getRunJobs,
  // Check Runs
  getCheckRuns,
  createCheckRun,
  updateCheckRun,
  // Webhook 处理
  handleWebhook,
  onTrigger,
  onCancel,
  healthCheck,
  validateConfig: validatePluginConfig,
  getMeta,
  dispose,
};

// ES Module 兼容
module.exports.default = module.exports;
