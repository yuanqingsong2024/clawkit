/**
 * 自动 PR 创建服务
 * 整合 GitHub PR 和 GitLab MR 创建功能
 */

import type { TaskExecutionResult } from '@clawkit/shared';
import type { PrProvider, PrCreationConfig, PrCreationInput, PrCreationResult } from './pr-creation.interface';
import { GithubPrService } from './github-pr.service';
import { GitlabMrService } from './gitlab-mr.service';

/**
 * PR 创建选项
 */
export interface AutoPrOptions {
  /** 是否启用自动 PR */
  enabled: boolean;
  /** GitHub Token */
  githubToken?: string;
  /** GitLab Token */
  gitlabToken?: string;
  /** 自定义 PR 配置 */
  config?: Partial<PrCreationConfig>;
}

/**
 * 自动 PR 服务
 */
export class AutoPrService {
  private readonly githubService: GithubPrService;
  private readonly gitlabService: GitlabMrService;

  constructor() {
    this.githubService = new GithubPrService();
    this.gitlabService = new GitlabMrService();
  }

  /**
   * 根据任务执行结果自动创建 PR
   * @param executionResult 任务执行结果
   * @param repoUrl 仓库 URL
   * @param sourceBranch 源分支
   * @param targetBranch 目标分支
   * @param options 选项
   * @returns PR 创建结果
   */
  async createPrFromExecution(
    executionResult: TaskExecutionResult,
    repoUrl: string,
    sourceBranch: string,
    targetBranch: string,
    options: AutoPrOptions,
  ): Promise<PrCreationResult> {
    // 检查是否启用
    if (!options.enabled) {
      return {
        success: false,
        error: '自动 PR 功能未启用',
      };
    }

    // 确定 Git 提供商
    const provider = this.detectProvider(repoUrl);
    if (!provider) {
      return {
        success: false,
        error: `无法识别的仓库 URL：${repoUrl}`,
      };
    }

    // 获取对应的 token
    const token = this.getToken(provider, options);
    if (!token) {
      return {
        success: false,
        error: `缺少 ${provider === 'github' ? 'GitHub' : 'GitLab'} 访问令牌`,
      };
    }

    // 构建创建输入
    const input: PrCreationInput = {
      executionResult,
      repoUrl,
      sourceBranch,
      targetBranch,
      provider,
      token,
      config: options.config,
    };

    // 选择对应的服务
    const service = this.getService(provider);
    return service.createPr(input);
  }

  /**
   * 检查分支是否存在
   */
  async branchExists(
    repoUrl: string,
    branch: string,
    options: AutoPrOptions,
  ): Promise<boolean> {
    const provider = this.detectProvider(repoUrl);
    if (!provider) {
      return false;
    }

    const token = this.getToken(provider, options);
    if (!token) {
      return false;
    }

    const service = this.getService(provider);
    return service.branchExists(repoUrl, branch, token);
  }

  /**
   * 创建分支
   */
  async createBranch(
    repoUrl: string,
    baseBranch: string,
    newBranch: string,
    options: AutoPrOptions,
  ): Promise<boolean> {
    const provider = this.detectProvider(repoUrl);
    if (!provider) {
      return false;
    }

    const token = this.getToken(provider, options);
    if (!token) {
      return false;
    }

    const service = this.getService(provider);
    return service.createBranch(repoUrl, baseBranch, newBranch, token);
  }

  /**
   * 检测 Git 提供商
   */
  private detectProvider(repoUrl: string): 'github' | 'gitlab' | null {
    if (repoUrl.includes('github.com')) {
      return 'github';
    }
    if (repoUrl.includes('gitlab.com') || repoUrl.includes('gitlab')) {
      return 'gitlab';
    }
    return null;
  }

  /**
   * 获取对应提供商的 token
   */
  private getToken(provider: 'github' | 'gitlab', options: AutoPrOptions): string | undefined {
    return provider === 'github' ? options.githubToken : options.gitlabToken;
  }

  /**
   * 获取对应提供商的服务
   */
  private getService(provider: 'github' | 'gitlab'): PrProvider {
    return provider === 'github' ? this.githubService : this.gitlabService;
  }
}

/**
 * 默认自动 PR 选项
 */
export const DEFAULT_AUTO_PR_OPTIONS: AutoPrOptions = {
  enabled: false,
};

/**
 * 从环境变量创建自动 PR 选项
 */
export function createAutoPrOptionsFromEnv(): AutoPrOptions {
  return {
    enabled: process.env.AUTO_PR_ENABLED === 'true',
    githubToken: process.env.GITHUB_TOKEN,
    gitlabToken: process.env.GITLAB_TOKEN,
    config: {
      enabled: process.env.AUTO_PR_ENABLED === 'true',
      baseBranch: process.env.AUTO_PR_BASE_BRANCH || 'main',
      titleTemplate: process.env.AUTO_PR_TITLE_TEMPLATE || DEFAULT_AUTO_PR_OPTIONS.config?.titleTemplate || '[ClawKit] {{intent}}',
      descriptionTemplate: process.env.AUTO_PR_DESCRIPTION_TEMPLATE || DEFAULT_AUTO_PR_OPTIONS.config?.descriptionTemplate || '',
      autoAssignReviewers: process.env.AUTO_PR_AUTO_REVIEWERS === 'true',
      reviewers: process.env.AUTO_PR_REVIEWERS?.split(','),
      autoAddLabels: process.env.AUTO_PR_AUTO_LABELS !== 'false',
      labels: process.env.AUTO_PR_LABELS?.split(',') || ['clawkit-auto'],
    },
  };
}
