/**
 * 自动 PR 创建服务接口
 * 定义 PR/MR 创建的统一接口和各平台实现规范
 */

import type { TaskExecutionResult } from '@clawkit/shared';

/**
 * PR 创建配置
 */
export interface PrCreationConfig {
  /** 是否启用自动 PR 创建 */
  enabled: boolean;
  /** 默认目标分支 */
  baseBranch: string;
  /** PR 标题模板 */
  titleTemplate: string;
  /** PR 描述模板 */
  descriptionTemplate: string;
  /** 自动添加 reviewers */
  autoAssignReviewers: boolean;
  /** Reviewer 用户名列表 */
  reviewers?: string[];
  /** 自动添加 labels */
  autoAddLabels: boolean;
  /** PR Labels */
  labels?: string[];
}

/**
 * PR 创建输入
 */
export interface PrCreationInput {
  /** 任务执行结果 */
  executionResult: TaskExecutionResult;
  /** 仓库 URL (如 https://github.com/owner/repo.git) */
  repoUrl: string;
  /** 源分支名称 */
  sourceBranch: string;
  /** 目标分支名称 */
  targetBranch: string;
  /** Git 提供商类型 */
  provider: 'github' | 'gitlab';
  /** GitHub Token 或 GitLab Token */
  token: string;
  /** 自定义配置 */
  config?: Partial<PrCreationConfig>;
}

/**
 * PR 创建结果
 */
export interface PrCreationResult {
  /** 是否成功 */
  success: boolean;
  /** PR/MR 编号 */
  number?: number;
  /** PR/MR URL */
  url?: string;
  /** PR/MR 标题 */
  title?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * PR 模板变量
 */
export interface PrTemplateVariables {
  /** 任务 ID */
  taskId: string;
  /** 任务意图/描述 */
  intent: string;
  /** 执行摘要 */
  summary: string;
  /** 改动文件列表 */
  changedFiles: string[];
  /** 执行命令 */
  commands: string[];
  /** 测试结果 */
  testResult: string;
  /** 风险与待确认项 */
  risks: string[];
  /** 仓库名称 */
  repoName: string;
  /** 源分支 */
  sourceBranch: string;
  /** 目标分支 */
  targetBranch: string;
  /** 执行时间 */
  executedAt: string;
  /** Worker ID */
  workerId: string;
}

/**
 * GitHub PR 创建请求
 */
export interface GithubPrRequest {
  title: string;
  head: string;
  base: string;
  body: string;
  draft?: boolean;
  maintainer_can_modify?: boolean;
}

/**
 * GitLab MR 创建请求
 */
export interface GitlabMrRequest {
  source_branch: string;
  target_branch: string;
  title: string;
  description: string;
  remove_source_branch?: boolean;
}

/**
 * PR 服务提供商接口
 */
export interface PrProvider {
  /** 创建 PR/MR */
  createPr(input: PrCreationInput): Promise<PrCreationResult>;
  /** 检查分支是否存在 */
  branchExists(repoUrl: string, branch: string, token: string): Promise<boolean>;
  /** 创建分支 */
  createBranch(repoUrl: string, baseBranch: string, newBranch: string, token: string): Promise<boolean>;
}

/**
 * 默认 PR 配置
 */
export const DEFAULT_PR_CONFIG: Required<PrCreationConfig> = {
  enabled: true,
  baseBranch: 'main',
  titleTemplate: '[ClawKit] 任务执行结果：{{intent}}',
  descriptionTemplate: `## 执行摘要
{{summary}}

## 改动文件
{{#each changedFiles}}
- {{this}}
{{/each}}

## 执行命令
{{#each commands}}
- \`{{this}}\`
{{/each}}

## 测试结果
{{testResult}}

{{#if risks}}
## 风险与待确认项
{{#each risks}}
- ⚠️ {{this}}
{{/each}}
{{/if}}

---
🤖 由 [ClawKit](https://github.com/clawkit/clawkit) 自动创建 | 任务 ID: {{taskId}}`,
  autoAssignReviewers: false,
  reviewers: [],
  autoAddLabels: true,
  labels: ['clawkit-auto'],
};

/**
 * 平台类型
 */
export type GitProvider = 'github' | 'gitlab';

/**
 * 解析仓库 URL 获取信息
 */
export function parseRepoUrl(repoUrl: string): { owner: string; repo: string; provider: GitProvider } | null {
  // GitHub: https://github.com/owner/repo.git 或 git@github.com:owner/repo.git
  const githubHttpsMatch = repoUrl.match(/https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (githubHttpsMatch) {
    return {
      owner: githubHttpsMatch[1],
      repo: githubHttpsMatch[2].replace(/\.git$/, ''),
      provider: 'github',
    };
  }

  const githubSshMatch = repoUrl.match(/git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (githubSshMatch) {
    return {
      owner: githubSshMatch[1],
      repo: githubSshMatch[2].replace(/\.git$/, ''),
      provider: 'github',
    };
  }

  // GitLab: https://gitlab.com/owner/repo.git 或 git@gitlab.com:owner/repo.git
  const gitlabHttpsMatch = repoUrl.match(/https?:\/\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (gitlabHttpsMatch) {
    return {
      owner: gitlabHttpsMatch[2],
      repo: gitlabHttpsMatch[3].replace(/\.git$/, ''),
      provider: 'gitlab',
    };
  }

  const gitlabSshMatch = repoUrl.match(/git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (gitlabSshMatch) {
    return {
      owner: gitlabSshMatch[2],
      repo: gitlabSshMatch[3].replace(/\.git$/, ''),
      provider: 'gitlab',
    };
  }

  return null;
}

/**
 * 渲染 PR 模板
 */
export function renderPrTemplate(template: string, variables: PrTemplateVariables): string {
  let result = template;

  // 替换简单变量
  result = result.replace(/\{\{taskId\}\}/g, variables.taskId);
  result = result.replace(/\{\{intent\}\}/g, variables.intent);
  result = result.replace(/\{\{summary\}\}/g, variables.summary);
  result = result.replace(/\{\{testResult\}\}/g, variables.testResult);
  result = result.replace(/\{\{repoName\}\}/g, variables.repoName);
  result = result.replace(/\{\{sourceBranch\}\}/g, variables.sourceBranch);
  result = result.replace(/\{\{targetBranch\}\}/g, variables.targetBranch);
  result = result.replace(/\{\{executedAt\}\}/g, variables.executedAt);
  result = result.replace(/\{\{workerId\}\}/g, variables.workerId);

  // 处理数组变量 - 改动文件
  if (variables.changedFiles.length > 0) {
    const filesBlock = variables.changedFiles.map((f) => `- ${f}`).join('\n');
    result = result.replace(/\{\{#each changedFiles\}\}[\s\S]*?\{\{\/each\}\}/g, filesBlock);
  } else {
    result = result.replace(/\{\{#each changedFiles\}\}[\s\S]*?\{\{\/each\}\}/g, '- 无改动文件');
  }

  // 处理数组变量 - 执行命令
  if (variables.commands.length > 0) {
    const commandsBlock = variables.commands.map((c) => `- \`${c}\``).join('\n');
    result = result.replace(/\{\{#each commands\}\}[\s\S]*?\{\{\/each\}\}/g, commandsBlock);
  } else {
    result = result.replace(/\{\{#each commands\}\}[\s\S]*?\{\{\/each\}\}/g, '- 无执行命令');
  }

  // 处理数组变量 - 风险
  if (variables.risks.length > 0) {
    const risksBlock = variables.risks.map((r) => `⚠️ ${r}`).join('\n');
    result = result.replace(/\{\{#if risks\}\}[\s\S]*?\{\{\/if\}\}/g, `\n## 风险与待确认项\n${risksBlock}`);
  } else {
    result = result.replace(/\{\{#if risks\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }

  return result;
}
