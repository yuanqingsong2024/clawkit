/**
 * Webhook 管理器服务
 * 
 * 统一处理 GitHub/GitLab Webhook 事件
 * 
 * @module integrations
 */

import { EventEmitter } from 'node:events';

import type { 
  WebhookPayload, 
  WebhookResult,
  OAuthProvider,
  OAuthService 
} from './oauth.types';
import { WebhookEventType, OAuthProvider as Provider } from './oauth.types';
import { GitHubOAuthService } from './github-oauth.service';
import { GitLabOAuthService } from './gitlab-oauth.service';

/**
 * Webhook 处理器接口
 */
export interface WebhookHandler {
  /** 处理器名称 */
  name: string;
  /** 支持的事件类型 */
  events: WebhookEventType[];
  /** 处理器优先级（数字越小优先级越高） */
  priority: number;
  /** 处理 Webhook 事件 */
  handle(payload: WebhookPayload): Promise<WebhookResult>;
}

/**
 * Webhook 管理器配置
 */
export interface WebhookManagerConfig {
  /** GitHub OAuth 服务 */
  githubService?: GitHubOAuthService;
  /** GitLab OAuth 服务 */
  gitlabService?: GitLabOAuthService;
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * Webhook 事件名称映射
 */
const WEBHOOK_EVENT_NAMES: Record<WebhookEventType, string> = {
  [WebhookEventType.GITHUB_PUSH]: 'webhook.push',
  [WebhookEventType.GITHUB_PULL_REQUEST]: 'webhook.pull_request',
  [WebhookEventType.GITHUB_ISSUE_COMMENT]: 'webhook.issue_comment',
  [WebhookEventType.GITHUB_CREATE]: 'webhook.create',
  [WebhookEventType.GITHUB_DELETE]: 'webhook.delete',
  [WebhookEventType.GITHUB_RELEASE]: 'webhook.release',
  [WebhookEventType.GITLAB_PUSH]: 'webhook.push',
  [WebhookEventType.GITLAB_MERGE_REQUEST]: 'webhook.merge_request',
  [WebhookEventType.GITLAB_NOTE]: 'webhook.note',
  [WebhookEventType.GITLAB_TAG_PUSH]: 'webhook.tag_push',
  [WebhookEventType.GITLAB_RELEASE]: 'webhook.release',
  [WebhookEventType.GITLAB_PIPELINE]: 'webhook.pipeline',
};

/**
 * Webhook 管理器服务
 * 
 * 负责接收、验证、分发 Webhook 事件到各个处理器
 */
export class WebhookManager extends EventEmitter {
  private readonly handlers: WebhookHandler[] = [];
  private readonly githubService?: GitHubOAuthService;
  private readonly gitlabService?: GitLabOAuthService;
  private readonly enabled: boolean;
  private eventIdCounter = 0;

  constructor(config: WebhookManagerConfig) {
    super();
    this.enabled = config.enabled ?? true;
    this.githubService = config.githubService;
    this.gitlabService = config.gitlabService;
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 注册 Webhook 处理器
   */
  registerHandler(handler: WebhookHandler): void {
    this.handlers.push(handler);
    // 按优先级排序
    this.handlers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 注销 Webhook 处理器
   */
  unregisterHandler(name: string): boolean {
    const index = this.handlers.findIndex((h) => h.name === name);
    if (index !== -1) {
      this.handlers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 根据提供商获取 OAuth 服务
   */
  getOAuthService(provider: OAuthProvider): OAuthService | undefined {
    switch (provider) {
      case Provider.GITHUB:
        return this.githubService;
      case Provider.GITLAB:
        return this.gitlabService;
      default:
        return undefined;
    }
  }

  /**
   * 处理 GitHub Webhook 请求
   */
  async handleGitHubWebhook(
    payload: string,
    headers: Record<string, string | undefined>,
  ): Promise<WebhookResult> {
    if (!this.githubService) {
      return {
        success: false,
        message: 'GitHub 集成未配置',
      };
    }

    // 验证签名
    const signature = headers['x-hub-signature-256'] as string | undefined;
    if (signature) {
      if (!this.githubService.verifyWebhookSignature(payload, signature)) {
        return {
          success: false,
          message: 'Webhook 签名验证失败',
        };
      }
    }

    // 解析事件
    let parsedPayload: object;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      return {
        success: false,
        message: '无效的 JSON 载荷',
      };
    }

    const webhookPayload = this.githubService.parseWebhookEvent(parsedPayload, headers);
    if (!webhookPayload) {
      return {
        success: false,
        message: '无法解析 Webhook 事件',
      };
    }

    return this.dispatchEvent(webhookPayload);
  }

  /**
   * 处理 GitLab Webhook 请求
   */
  async handleGitLabWebhook(
    payload: string,
    headers: Record<string, string | undefined>,
  ): Promise<WebhookResult> {
    if (!this.gitlabService) {
      return {
        success: false,
        message: 'GitLab 集成未配置',
      };
    }

    // 验证签名（GitLab 使用 X-Gitlab-Token）
    const token = headers['x-gitlab-token'] as string | undefined;
    if (token) {
      if (!this.gitlabService.verifyWebhookSignature(payload, token)) {
        return {
          success: false,
          message: 'Webhook Token 验证失败',
        };
      }
    }

    // 解析事件
    let parsedPayload: object;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      return {
        success: false,
        message: '无效的 JSON 载荷',
      };
    }

    const webhookPayload = this.gitlabService.parseWebhookEvent(parsedPayload, headers);
    if (!webhookPayload) {
      return {
        success: false,
        message: '无法解析 Webhook 事件',
      };
    }

    return this.dispatchEvent(webhookPayload);
  }

  /**
   * 分发事件到处理器
   */
  private async dispatchEvent(payload: WebhookPayload): Promise<WebhookResult> {
    const eventId = `evt_${++this.eventIdCounter}_${Date.now()}`;
    
    // 触发事件通知
    const eventName = WEBHOOK_EVENT_NAMES[payload.eventType] || 'webhook.unknown';
    this.emit(eventName, payload, eventId);
    this.emit('webhook', payload, eventId);

    // 查找匹配的处理器
    const matchingHandlers = this.handlers.filter((handler) =>
      handler.events.includes(payload.eventType),
    );

    if (matchingHandlers.length === 0) {
      return {
        success: true,
        message: `事件已接收，暂无处理程序（${payload.eventType}）`,
        eventId,
      };
    }

    // 按优先级执行处理器
    for (const handler of matchingHandlers) {
      try {
        const result = await handler.handle(payload);
        if (result.taskId) {
          return {
            ...result,
            eventId,
          };
        }
      } catch (error) {
        // 单个处理器失败不影响其他处理器
        console.error(`Webhook 处理器 ${handler.name} 执行失败:`, error);
      }
    }

    return {
      success: true,
      message: `事件已处理（${matchingHandlers.map((h) => h.name).join(', ')}）`,
      eventId,
    };
  }

  /**
   * 获取已注册的处理
   */
  getHandlers(): WebhookHandler[] {
    return [...this.handlers];
  }

  /**
   * 获取支持的 Webhook 端点信息
   */
  getEndpoints(): {
    github?: { url: string; events: string[] };
    gitlab?: { url: string; events: string[] };
  } {
    const result: ReturnType<typeof this.getEndpoints> = {};

    if (this.githubService) {
      result.github = {
        url: '/api/webhooks/github',
        events: Object.values(WebhookEventType)
          .filter((e) => e.startsWith('GITHUB_'))
          .map((e) => e.replace('GITHUB_', '').toLowerCase()),
      };
    }

    if (this.gitlabService) {
      result.gitlab = {
        url: '/api/webhooks/gitlab',
        events: Object.values(WebhookEventType)
          .filter((e) => e.startsWith('GITLAB_'))
          .map((e) => e.replace('GITLAB_', ' ').trim().toLowerCase()),
      };
    }

    return result;
  }
}
