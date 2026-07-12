/**
 * Webhook 任务创建处理器
 * 
 * 将 Webhook 事件转换为 ClawKit 任务
 * 
 * @module integrations
 */

import type { 
  WebhookPayload, 
  WebhookResult,
  WebhookHandler,
  WebhookEventType 
} from './oauth.types';
import { WebhookEventType as Events, OAuthProvider } from './oauth.types';

/**
 * 任务创建服务接口
 */
export interface TaskCreator {
  /**
   * 从 Push 事件创建任务
   */
  createTaskFromPush(payload: WebhookPayload & { ref: string; commits: Array<{ id: string; message: string }> }): Promise<string>;
  
  /**
   * 从 Pull Request/Merge Request 事件创建任务
   */
  createTaskFromPR(payload: WebhookPayload & { 
    pullRequest?: { title: string; body?: string; head: { ref: string }; base: { ref: string } };
    objectAttributes?: { title: string; description?: string; sourceBranch: string; targetBranch: string };
  }): Promise<string>;
}

/**
 * Webhook 任务处理器配置
 */
export interface WebhookTaskHandlerConfig {
  /** 任务创建服务 */
  taskCreator: TaskCreator;
  /** 是否启用自动任务创建 */
  enabled?: boolean;
  /** 任务前缀 */
  taskPrefix?: string;
}

/**
 * Webhook 任务处理器
 * 
 * 将 Webhook 事件转换为任务
 */
export class WebhookTaskHandler implements WebhookHandler {
  readonly name: string;
  readonly events: WebhookEventType[];
  readonly priority: number;
  private readonly taskCreator: TaskCreator;
  private readonly enabled: boolean;
  private readonly taskPrefix: string;

  constructor(config: WebhookTaskHandlerConfig) {
    this.name = 'webhook-task-handler';
    this.taskCreator = config.taskCreator;
    this.enabled = config.enabled ?? true;
    this.taskPrefix = config.taskPrefix || '[Webhook]';
    this.events = [
      Events.GITHUB_PUSH,
      Events.GITHUB_PULL_REQUEST,
      Events.GITLAB_PUSH,
      Events.GITLAB_MERGE_REQUEST,
    ];
    this.priority = 100; // 中等优先级
  }

  /**
   * 处理 Webhook 事件
   */
  async handle(payload: WebhookPayload): Promise<WebhookResult> {
    if (!this.enabled) {
      return {
        success: true,
        message: 'Webhook 任务处理已禁用',
      };
    }

    try {
      switch (payload.eventType) {
        case Events.GITHUB_PUSH:
        case Events.GITLAB_PUSH:
          return this.handlePushEvent(payload);

        case Events.GITHUB_PULL_REQUEST:
        case Events.GITLAB_MERGE_REQUEST:
          return this.handlePREvent(payload);

        default:
          return {
            success: true,
            message: `事件类型 ${payload.eventType} 暂不支持自动任务创建`,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `任务创建失败：${(error as Error).message}`,
      };
    }
  }

  /**
   * 处理 Push 事件
   */
  private async handlePushEvent(payload: WebhookPayload): Promise<WebhookResult> {
    const pushPayload = payload as WebhookPayload & { 
      ref: string; 
      commits: Array<{ id: string; message: string }>;
    };

    // 过滤非分支推送
    if (!pushPayload.ref.startsWith('refs/heads/')) {
      return {
        success: true,
        message: '跳过非分支推送',
      };
    }

    const branch = pushPayload.ref.replace('refs/heads/', '');
    
    // 过滤 main/master 分支的直接推送（可选配置）
    if (branch === 'main' || branch === 'master') {
      return {
        success: true,
        message: '跳过主分支推送（如需处理请配置）',
      };
    }

    const taskId = await this.taskCreator.createTaskFromPush(pushPayload);

    return {
      success: true,
      message: `已为分支 ${branch} 创建任务`,
      taskId,
    };
  }

  /**
   * 处理 Pull Request / Merge Request 事件
   */
  private async handlePREvent(payload: WebhookPayload): Promise<WebhookResult> {
    const prPayload = payload as WebhookPayload & {
      pullRequest?: { title: string; body?: string; head: { ref: string }; base: { ref: string } };
      objectAttributes?: { title: string; description?: string; sourceBranch: string; targetBranch: string };
    };

    // GitHub PR 事件
    if (prPayload.pullRequest) {
      const { pullRequest } = prPayload;
      
      // 只处理 opened 和 reopened 事件
      const action = (payload as { action?: string }).action;
      if (action && !['opened', 'reopened', 'synchronize'].includes(action)) {
        return {
          success: true,
          message: `跳过 PR action: ${action}`,
        };
      }

      const taskId = await this.taskCreator.createTaskFromPR(prPayload);

      return {
        success: true,
        message: `已为 PR "${pullRequest.title}" 创建任务`,
        taskId,
      };
    }

    // GitLab MR 事件
    if (prPayload.objectAttributes) {
      const { objectAttributes } = prPayload;
      
      const taskId = await this.taskCreator.createTaskFromPR(prPayload);

      return {
        success: true,
        message: `已为 MR "${objectAttributes.title}" 创建任务`,
        taskId,
      };
    }

    return {
      success: false,
      message: '无法解析 PR/MR 信息',
    };
  }

  /**
   * 生成任务描述
   */
  generateTaskDescription(payload: WebhookPayload): string {
    const repoName = payload.repository.fullName;
    const sender = payload.sender.username;

    switch (payload.eventType) {
      case Events.GITHUB_PUSH:
      case Events.GITLAB_PUSH: {
        const pushPayload = payload as WebhookPayload & { ref: string; commits: Array<{ message: string }> };
        const branch = pushPayload.ref.replace('refs/heads/', '');
        const commitCount = pushPayload.commits?.length || 0;
        const latestCommit = pushPayload.commits?.[pushPayload.commits.length - 1]?.message || '';
        return `${this.taskPrefix} ${repoName} 分支 ${branch} 有 ${commitCount} 个新提交\n最新提交：${latestCommit.substring(0, 100)}`;
      }

      case Events.GITHUB_PULL_REQUEST: {
        const prPayload = payload as WebhookPayload & { pullRequest?: { title: string; body?: string } };
        return `${this.taskPrefix} GitHub PR: ${prPayload.pullRequest?.title || 'Unknown'}\n${prPayload.pullRequest?.body || ''}`;
      }

      case Events.GITLAB_MERGE_REQUEST: {
        const mrPayload = payload as WebhookPayload & { objectAttributes?: { title: string; description?: string } };
        return `${this.taskPrefix} GitLab MR: ${mrPayload.objectAttributes?.title || 'Unknown'}\n${mrPayload.objectAttributes?.description || ''}`;
      }

      default:
        return `${this.taskPrefix} 来自 ${sender} 的 Webhook 事件 (${payload.eventType})`;
    }
  }
}
