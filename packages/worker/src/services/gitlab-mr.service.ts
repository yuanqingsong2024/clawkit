/**
 * GitLab MR 创建服务
 * 使用 GitLab REST API 创建 Merge Request
 */

import type { PrProvider, PrCreationInput, PrCreationResult, GitlabMrRequest } from './pr-creation.interface';
import { parseRepoUrl, DEFAULT_PR_CONFIG, renderPrTemplate } from './pr-creation.interface';

/**
 * 从仓库 URL 提取 GitLab 实例 URL
 */
function extractGitlabInstanceUrl(repoUrl: string): string {
  // 从仓库 URL 中提取 GitLab 实例地址
  const httpsMatch = repoUrl.match(/https?:\/\/([^/]+)\//);
  if (httpsMatch) {
    return `https://${httpsMatch[1]}`;
  }

  const sshMatch = repoUrl.match(/git@([^:]+):/);
  if (sshMatch) {
    return `https://${sshMatch[1]}`;
  }

  // 默认使用 GitLab.com
  return 'https://gitlab.com';
}

/**
 * 对 URL 组件进行编码（用于路径中的命名空间）
 */
function encodeProjectPath(owner: string, repo: string): string {
  return `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

/**
 * GitLab MR 创建服务实现
 */
export class GitlabMrService implements PrProvider {
  /**
   * 创建 Merge Request
   */
  async createPr(input: PrCreationInput): Promise<PrCreationResult> {
    const repoInfo = parseRepoUrl(input.repoUrl);
    if (!repoInfo || repoInfo.provider !== 'gitlab') {
      return {
        success: false,
        error: `无效的 GitLab 仓库 URL：${input.repoUrl}`,
      };
    }

    const config = { ...DEFAULT_PR_CONFIG, ...input.config };
    const instanceUrl = extractGitlabInstanceUrl(input.repoUrl);
    const projectPath = encodeProjectPath(repoInfo.owner, repoInfo.repo);

    // 生成 MR 标题和描述
    const variables = this.buildTemplateVariables(input);
    const title = renderPrTemplate(config.titleTemplate, variables);
    const body = renderPrTemplate(config.descriptionTemplate, variables);

    // 构建 MR 请求
    const mrRequest: GitlabMrRequest = {
      source_branch: input.sourceBranch,
      target_branch: input.targetBranch,
      title,
      description: body,
      remove_source_branch: false,
    };

    // 调用 GitLab API
    try {
      const response = await fetch(`${instanceUrl}/api/v4/projects/${projectPath}/merge_requests`, {
        method: 'POST',
        headers: {
          'PRIVATE-TOKEN': input.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mrRequest),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;

        // 检查是否是 MR 已存在的错误
        if (response.status === 400 && typeof errorMessage === 'string' && errorMessage.includes('already exists')) {
          return {
            success: false,
            error: `MR 已存在，源分支：${input.sourceBranch}`,
          };
        }

        return {
          success: false,
          error: `GitLab API 错误：${typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage)}`,
        };
      }

      const mrData = await response.json() as {
        iid: number;
        web_url: string;
        title: string;
      };
      const mrIid = mrData.iid;

      // 添加 Reviewers（如果配置了）
      if (config.autoAssignReviewers && config.reviewers && config.reviewers.length > 0) {
        await this.addReviewers(instanceUrl, projectPath, mrIid, config.reviewers, input.token);
      }

      // 添加 Labels（如果配置了）
      if (config.autoAddLabels && config.labels && config.labels.length > 0) {
        await this.addLabels(instanceUrl, projectPath, mrIid, config.labels, input.token);
      }

      return {
        success: true,
        number: mrIid,
        url: mrData.web_url,
        title: mrData.title,
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
    if (!repoInfo || repoInfo.provider !== 'gitlab') {
      return false;
    }

    const instanceUrl = extractGitlabInstanceUrl(repoUrl);
    const projectPath = encodeProjectPath(repoInfo.owner, repoInfo.repo);

    try {
      const response = await fetch(`${instanceUrl}/api/v4/projects/${projectPath}/repository/branches/${encodeURIComponent(branch)}`, {
        method: 'GET',
        headers: {
          'PRIVATE-TOKEN': token,
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
    if (!repoInfo || repoInfo.provider !== 'gitlab') {
      return false;
    }

    const instanceUrl = extractGitlabInstanceUrl(repoUrl);
    const projectPath = encodeProjectPath(repoInfo.owner, repoInfo.repo);

    try {
      const response = await fetch(`${instanceUrl}/api/v4/projects/${projectPath}/repository/branches`, {
        method: 'POST',
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch: newBranch,
          ref: baseBranch,
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 添加 Reviewers
   */
  private async addReviewers(
    instanceUrl: string,
    projectPath: string,
    mrIid: number,
    reviewers: string[],
    token: string,
  ): Promise<void> {
    try {
      await fetch(`${instanceUrl}/api/v4/projects/${projectPath}/merge_requests/${mrIid}`, {
        method: 'PUT',
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reviewer_ids: reviewers }),
      });
    } catch {
      // 添加 reviewer 失败不阻塞 MR 创建
    }
  }

  /**
   * 添加 Labels
   */
  private async addLabels(
    instanceUrl: string,
    projectPath: string,
    mrIid: number,
    labels: string[],
    token: string,
  ): Promise<void> {
    try {
      await fetch(`${instanceUrl}/api/v4/projects/${projectPath}/merge_requests/${mrIid}`, {
        method: 'PUT',
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ add_labels: labels.join(',') }),
      });
    } catch {
      // 添加 label 失败不阻塞 MR 创建
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
