/**
 * GitLab OAuth 服务
 * 
 * 实现 GitLab OAuth 2.0 认证和 Webhook 处理
 * 
 * @module integrations
 */

import crypto from 'node:crypto';

import type { 
  OAuthConfig, 
  OAuthUserInfo, 
  OAuthProvider,
  WebhookPayload,
  GitLabPushPayload,
  GitLabMergeRequestPayload
} from './oauth.types';
import { OAuthProvider as Provider, WebhookEventType } from './oauth.types';

/**
 * GitLab OAuth 配置
 */
export interface GitLabOAuthConfig extends OAuthConfig {
  /** GitLab 实例 URL（如使用自建 GitLab） */
  gitlabUrl?: string;
  /** Webhook 签名密钥 */
  webhookSecret?: string;
}

/**
 * GitLab OAuth 服务实现
 */
export class GitLabOAuthService {
  private readonly config: GitLabOAuthConfig;

  constructor(config: Partial<GitLabOAuthConfig>) {
    // 用户配置优先，默认值兜底
    const gitlabUrl = config.gitlabUrl || 'https://gitlab.com';
    
    this.config = {
      clientId: '',
      clientSecret: '',
      callbackUrl: '',
      scopes: ['read_user', 'api'],
      authUrl: `${gitlabUrl}/oauth/authorize`,
      tokenUrl: `${gitlabUrl}/oauth/token`,
      userInfoUrl: `${gitlabUrl}/api/v4/user`,
      ...config,
    };
  }

  /**
   * 获取提供商类型
   */
  getProvider(): OAuthProvider {
    return Provider.GITLAB;
  }

  /**
   * 生成 GitLab OAuth 授权 URL
   */
  getAuthorizationUrl(state: string, redirectUrl?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUrl || this.config.callbackUrl,
      scope: this.config.scopes.join('+'),
      state,
      response_type: 'code',
    });

    return `${this.config.authUrl}?${params.toString()}`;
  }

  /**
   * 交换授权码获取访问令牌
   */
  async exchangeCodeForToken(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }> {
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.callbackUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitLab token exchange failed: ${error}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (data.error) {
      throw new Error(`GitLab OAuth error: ${data.error}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * 获取 GitLab 用户信息
   */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const response = await fetch(this.config.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitLab user info request failed: ${response.status}`);
    }

    const data = await response.json() as {
      id: number;
      username: string;
      name: string;
      email: string;
      avatar_url?: string;
    };

    return {
      provider: Provider.GITLAB,
      providerUserId: String(data.id),
      username: data.username,
      email: data.email,
      displayName: data.name,
      avatarUrl: data.avatar_url,
      accessToken,
    };
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }> {
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`GitLab token refresh failed: ${response.status}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * 验证 GitLab Webhook 签名
   * 
   * GitLab 使用 Token 或 Secret-Token 头进行验证
   * 也可以使用 X-Gitlab-Token 头直接匹配
   */
  verifyWebhookSignature(payload: string, signature: string, secret?: string): boolean {
    const webhookSecret = secret || this.config.webhookSecret;
    if (!webhookSecret) {
      // 如果没有配置密钥，跳过验证
      return true;
    }

    // GitLab 支持直接 token 匹配
    return signature === webhookSecret;
  }

  /**
   * 解析 GitLab Webhook 事件
   */
  parseWebhookEvent(payload: object, headers: Record<string, string | undefined>): GitLabPushPayload | GitLabMergeRequestPayload | null {
    const eventType = headers['x-gitlab-event'] as string | undefined;

    if (!eventType) {
      return null;
    }

    const data = payload as Record<string, unknown>;
    const project = data.project as Record<string, unknown> | undefined;
    const repository = data.repository as Record<string, unknown> | undefined;
    const userName = data.user_name as string | undefined;
    const userUsername = data.user_username as string | undefined;
    const userId = data.user_id as number | undefined;

    const basePayload: WebhookPayload = {
      eventType: this.mapEventType(eventType),
      provider: Provider.GITLAB,
      repository: {
        name: (project?.name as string) || (repository?.name as string) || '',
        fullName: (project?.path_with_namespace as string) || (repository?.full_name as string) || '',
        url: (project?.web_url as string) || (repository?.homepage as string) || '',
        defaultBranch: (project?.default_branch as string) || 'main',
      },
      sender: {
        username: userUsername || userName || '',
        id: String(userId || ''),
      },
      timestamp: data.created_at as string | undefined,
    };

    // 根据事件类型添加特定字段
    switch (eventType) {
      case 'Push Hook':
        return {
          ...basePayload,
          eventType: WebhookEventType.GITLAB_PUSH,
          ref: (data.ref as string) || '',
          before: (data.before as string) || '',
          after: (data.after as string) || '',
          commits: ((data.commits as Array<Record<string, unknown>>) || []).map((c) => ({
            id: (c.id as string) || '',
            message: (c.message as string) || '',
            author: {
              name: ((c.author as Record<string, unknown>)?.name as string) || '',
              email: ((c.author as Record<string, unknown>)?.email as string) || '',
            },
            url: (c.url as string) || '',
            added: c.added as string[] | undefined,
            removed: c.removed as string[] | undefined,
            modified: c.modified as string[] | undefined,
          })),
        };

      case 'Merge Request Hook':
        return {
          ...basePayload,
          eventType: WebhookEventType.GITLAB_MERGE_REQUEST,
          objectKind: (data.object_kind as string) || 'merge_request',
          objectAttributes: {
            id: (data.object_attributes as Record<string, unknown>)?.id as number || 0,
            iid: (data.object_attributes as Record<string, unknown>)?.iid as number || 0,
            title: (data.object_attributes as Record<string, unknown>)?.title as string || '',
            description: (data.object_attributes as Record<string, unknown>)?.description as string | undefined,
            state: (data.object_attributes as Record<string, unknown>)?.state as string || '',
            merged: ((data.object_attributes as Record<string, unknown>)?.state as string) === 'merged',
            sourceBranch: (data.object_attributes as Record<string, unknown>)?.source_branch as string || '',
            targetBranch: (data.object_attributes as Record<string, unknown>)?.target_branch as string || '',
            lastCommit: {
              id: ((data.object_attributes as Record<string, unknown>)?.last_commit as Record<string, unknown>)?.id as string || '',
            },
          },
        };

      default:
        return null;
    }
  }

  /**
   * 映射 GitLab 事件类型
   */
  private mapEventType(eventType: string): WebhookEventType {
    const eventMap: Record<string, WebhookEventType> = {
      'Push Hook': WebhookEventType.GITLAB_PUSH,
      'Merge Request Hook': WebhookEventType.GITLAB_MERGE_REQUEST,
      'Note Hook': WebhookEventType.GITLAB_NOTE,
      'Tag Push Hook': WebhookEventType.GITLAB_TAG_PUSH,
      'Release Hook': WebhookEventType.GITLAB_RELEASE,
      'Pipeline Hook': WebhookEventType.GITLAB_PIPELINE,
    };

    return eventMap[eventType] || WebhookEventType.GITLAB_PUSH;
  }
}
