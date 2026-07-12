/**
 * GitHub OAuth 服务
 * 
 * 实现 GitHub OAuth 2.0 认证和 Webhook 处理
 * 
 * @module integrations
 */

import crypto from 'node:crypto';

import type { 
  OAuthConfig, 
  OAuthUserInfo, 
  OAuthProvider,
  WebhookPayload,
  GitHubPushPayload,
  GitHubPullRequestPayload
} from './oauth.types';
import { OAuthProvider as Provider, WebhookEventType } from './oauth.types';

/**
 * GitHub OAuth 配置
 */
export interface GitHubOAuthConfig extends OAuthConfig {
  /** Webhook 签名密钥 */
  webhookSecret?: string;
}

/**
 * GitHub OAuth 服务实现
 */
export class GitHubOAuthService {
  private readonly config: GitHubOAuthConfig;

  constructor(config: Partial<GitHubOAuthConfig>) {
    // 用户配置优先，默认值兜底
    this.config = {
      clientId: '',
      clientSecret: '',
      callbackUrl: '',
      scopes: ['read:user', 'user:email'],
      authUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userInfoUrl: 'https://api.github.com/user',
      ...config,
    };
  }

  /**
   * 获取提供商类型
   */
  getProvider(): OAuthProvider {
    return Provider.GITHUB;
  }

  /**
   * 生成 GitHub OAuth 授权 URL
   */
  getAuthorizationUrl(state: string, redirectUrl?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUrl || this.config.callbackUrl,
      scope: this.config.scopes.join(' '),
      state,
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
        redirect_uri: this.config.callbackUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub token exchange failed: ${error}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (data.error) {
      throw new Error(`GitHub OAuth error: ${data.error}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * 获取 GitHub 用户信息
   */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    // 获取用户基本信息
    const userResponse = await fetch(this.config.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!userResponse.ok) {
      throw new Error(`GitHub user info request failed: ${userResponse.status}`);
    }

    const userData = await userResponse.json() as {
      id: number;
      login: string;
      name?: string;
      email?: string;
      avatar_url?: string;
    };

    // 如果没有邮箱，获取邮箱列表
    let email = userData.email;
    if (!email) {
      const emailsResponse = await fetch(`${this.config.userInfoUrl}/emails`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (emailsResponse.ok) {
        const emails = await emailsResponse.json() as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;
        const primaryEmail = emails.find((e) => e.primary && e.verified);
        email = primaryEmail?.email || emails[0]?.email || '';
      }
    }

    return {
      provider: Provider.GITHUB,
      providerUserId: String(userData.id),
      username: userData.login,
      email: email || '',
      displayName: userData.name || userData.login,
      avatarUrl: userData.avatar_url,
      accessToken,
    };
  }

  /**
   * 刷新访问令牌（GitHub 不常用）
   */
  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }> {
    // GitHub OAuth 不支持 token 刷新，需要用户重新授权
    throw new Error('GitHub OAuth does not support token refresh');
  }

  /**
   * 验证 GitHub Webhook 签名
   * 
   * GitHub 使用 HMAC-SHA256 签名，格式：sha256=<signature>
   */
  verifyWebhookSignature(payload: string, signature: string, secret?: string): boolean {
    const webhookSecret = secret || this.config.webhookSecret;
    if (!webhookSecret) {
      // 如果没有配置密钥，跳过验证
      return true;
    }

    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');

    // 使用 timingSafeEqual 防止时序攻击
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch {
      return false;
    }
  }

  /**
   * 解析 GitHub Webhook 事件
   */
  parseWebhookEvent(payload: object, headers: Record<string, string | undefined>): GitHubPushPayload | GitHubPullRequestPayload | null {
    const event = headers['x-github-event'] as string | undefined;
    const deliveryId = headers['x-github-delivery'] as string | undefined;

    if (!event) {
      return null;
    }

    const data = payload as Record<string, unknown>;
    const repository = data.repository as Record<string, unknown> | undefined;
    const sender = data.sender as Record<string, unknown> | undefined;

    const basePayload: WebhookPayload = {
      eventType: this.mapEventType(event),
      provider: Provider.GITHUB,
      repository: {
        name: (repository?.name as string) || '',
        fullName: (repository?.full_name as string) || '',
        url: (repository?.html_url as string) || '',
        defaultBranch: (repository?.default_branch as string) || 'main',
      },
      sender: {
        username: (sender?.login as string) || '',
        id: String(sender?.id || ''),
      },
      timestamp: data.created_at as string | undefined,
    };

    // 根据事件类型添加特定字段
    switch (event) {
      case 'push':
        return {
          ...basePayload,
          eventType: WebhookEventType.GITHUB_PUSH,
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

      case 'pull_request':
        return {
          ...basePayload,
          eventType: WebhookEventType.GITHUB_PULL_REQUEST,
          action: (data.action as string) || '',
          number: (data.number as number) || 0,
          pullRequest: {
            title: ((data.pull_request as Record<string, unknown>)?.title as string) || '',
            body: (data.pull_request as Record<string, unknown>)?.body as string | undefined,
            state: ((data.pull_request as Record<string, unknown>)?.state as string) || '',
            merged: ((data.pull_request as Record<string, unknown>)?.merged as boolean) || false,
            head: {
              ref: ((data.pull_request as Record<string, unknown>)?.head as Record<string, unknown>)?.ref as string || '',
              sha: ((data.pull_request as Record<string, unknown>)?.head as Record<string, unknown>)?.sha as string || '',
            },
            base: {
              ref: ((data.pull_request as Record<string, unknown>)?.base as Record<string, unknown>)?.ref as string || '',
              sha: ((data.pull_request as Record<string, unknown>)?.base as Record<string, unknown>)?.sha as string || '',
            },
          },
        };

      default:
        return null;
    }
  }

  /**
   * 映射 GitHub 事件类型
   */
  private mapEventType(event: string): WebhookEventType {
    const eventMap: Record<string, WebhookEventType> = {
      push: WebhookEventType.GITHUB_PUSH,
      pull_request: WebhookEventType.GITHUB_PULL_REQUEST,
      issue_comment: WebhookEventType.GITHUB_ISSUE_COMMENT,
      create: WebhookEventType.GITHUB_CREATE,
      delete: WebhookEventType.GITHUB_DELETE,
      release: WebhookEventType.GITHUB_RELEASE,
    };

    return eventMap[event] || WebhookEventType.GITHUB_PUSH;
  }
}
