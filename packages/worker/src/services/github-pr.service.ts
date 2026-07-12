/**
 * GitHub PR 创建服务
 * 使用 GitHub REST API 创建 Pull Request
 */

import type { PrProvider, PrCreationInput, PrCreationResult, GithubPrRequest } from './pr-creation.interface';
import { parseRepoUrl, DEFAULT_PR_CONFIG, renderPrTemplate } from './pr-creation.interface';

/**
 * GitHub API 基础 URL
 */
const GITHUB_API_BASE = 'https://api.github.com';

/**
 * GitHub PR 创建服务实现
 */
export class GithubPrService implements PrProvider {
  /**
   * 创建 Pull Request
   */
  async createPr(input: PrCreationInput): Promise<PrCreationResult> {
    const repoInfo = parseRepoUrl(input.repoUrl);
    if (!repoInfo || repoInfo.provider !== 'github') {
      return {
        success: false,
        error: `无效的 GitHub 仓库 URL：${input.repoUrl}`,
      };
    }

    const config = { ...DEFAULT_PR_CONFIG, ...input.config };

    // 生成 PR 标题和描述
    const variables = this.buildTemplateVariables(input);
    const title = renderPrTemplate(config.titleTemplate, variables);
    const body = renderPrTemplate(config.descriptionTemplate, variables);

    // 构建 PR 请求
    const prRequest: GithubPrRequest = {
      title,
      head: input.sourceBranch,
      base: input.targetBranch,
      body,
      draft: false,
      maintainer_can_modify: true,
    };

    // 调用 GitHub API
    try {
      const response = await fetch(`${GITHUB_API_BASE}/repos/${repoInfo.owner}/${repoInfo.repo}/pulls`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${input.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify(prRequest),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
        const errorMessage = (errorData.message as string) || `HTTP ${response.status}`;

        // 检查是否是分支已存在的错误
        if (response.status === 422 && errorMessage.includes('A pull request already exists')) {
          return {
            success: false,
            error: `PR 已存在，源分支：${input.sourceBranch}`,
          };
        }

        return {
          success: false,
          error: `GitHub API 错误：${errorMessage}`,
        };
      }

      const prData = await response.json() as {
        number: number;
        html_url: string;
        title: string;
      };
      const prNumber = prData.number;

      // 添加 Reviewers（如果配置了）
      if (config.autoAssignReviewers && config.reviewers && config.reviewers.length > 0) {
        await this.addReviewers(repoInfo.owner, repoInfo.repo, prNumber, config.reviewers, input.token);
      }

      // 添加 Labels（如果配置了）
      if (config.autoAddLabels && config.labels && config.labels.length > 0) {
        await this.addLabels(repoInfo.owner, repoInfo.repo, prNumber, config.labels, input.token);
      }

      return {
        success: true,
        number: prNumber,
        url: prData.html_url,
        title: prData.title,
      };
    } catch (error) {
      return {
        success: false,
        error: `网络请求失败：${(error as Error).message}`,
      };
    }
  }

  /**
   * 检查分支是否存在
   */
  async branchExists(repoUrl: string, branch: string, token: string): Promise<boolean> {
    const repoInfo = parseRepoUrl(repoUrl);
    if (!repoInfo || repoInfo.provider !== 'github') {
      return false;
    }

    try {
      const response = await fetch(`${GITHUB_API_BASE}/repos/${repoInfo.owner}/${repoInfo.repo}/branches/${branch}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 创建分支
   */
  async createBranch(repoUrl: string, baseBranch: string, newBranch: string, token: string): Promise<boolean> {
    const repoInfo = parseRepoUrl(repoUrl);
    if (!repoInfo || repoInfo.provider !== 'github') {
      return false;
    }

    try {
      // 首先获取基础分支的 SHA
      const refResponse = await fetch(`${GITHUB_API_BASE}/repos/${repoInfo.owner}/${repoInfo.repo}/git/ref/heads/${baseBranch}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!refResponse.ok) {
        return false;
      }

      const refData = await refResponse.json() as { object: { sha: string } };
      const sha = refData.object.sha;

      // 创建新分支
      const createResponse = await fetch(`${GITHUB_API_BASE}/repos/${repoInfo.owner}/${repoInfo.repo}/git/refs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: `refs/heads/${newBranch}`,
          sha,
        }),
      });

      return createResponse.ok;
    } catch {
      return false;
    }
  }

  /**
   * 添加 Reviewers
   */
  private async addReviewers(
    owner: string,
    repo: string,
    prNumber: number,
    reviewers: string[],
    token: string,
  ): Promise<void> {
    try {
      await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reviewers }),
      });
    } catch {
      // 添加 reviewer 失败不阻塞 PR 创建
    }
  }

  /**
   * 添加 Labels
   */
  private async addLabels(
    owner: string,
    repo: string,
    prNumber: number,
    labels: string[],
    token: string,
  ): Promise<void> {
    try {
      await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${prNumber}/labels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ labels }),
      });
    } catch {
      // 添加 label 失败不阻塞 PR 创建
    }
  }

  /**
   * 构建模板变量
   */
  private buildTemplateVariables(input: PrCreationInput) {
    const repoInfo = parseRepoUrl(input.repoUrl)!;
    return {
      taskId: input.executionResult.taskId,
      intent: input.executionResult.projectKey,
      summary: input.executionResult.summary || '无执行摘要',
      changedFiles: input.executionResult.changedFiles || [],
      commands: input.executionResult.commands || [],
      testResult: input.executionResult.testResult || '未提供测试结果',
      risks: input.executionResult.risks || [],
      repoName: `${repoInfo.owner}/${repoInfo.repo}`,
      sourceBranch: input.sourceBranch,
      targetBranch: input.targetBranch,
      executedAt: new Date(input.executionResult.updatedAt || Date.now()).toLocaleString('zh-CN'),
      workerId: input.executionResult.workerId,
    };
  }
}
