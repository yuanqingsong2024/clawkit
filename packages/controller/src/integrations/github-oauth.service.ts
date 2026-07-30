/**
 * GitHub OAuth 服务
 * 
 * 实现 GitHub OAuth 2.0 认证和 Webhook 处理
 * 
 * @module integrations
 */

import crypto from 'node:crypto';
import { z } from 'zod';

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

// ==================== Zod 验证 Schema ====================

/**
 * GitHub 提交作者 Schema
 */
const GitHubCommitAuthorSchema = z.object({
  name: z.string().default(''),
  email: z.string().default(''),
});

/**
 * GitHub 提交 Schema
 */
const GitHubCommitSchema = z.object({
  id: z.string().default(''),
  message: z.string().default(''),
  author: GitHubCommitAuthorSchema.optional(),
  url: z.string().default(''),
  added: z.array(z.string()).optional(),
  removed: z.array(z.string()).optional(),
  modified: z.array(z.string()).optional(),
});

/**
 * GitHub 仓库 Schema
 */
const GitHubRepositorySchema = z.object({
  name: z.string().default(''),
  full_name: z.string().default(''),
  html_url: z.string().default(''),
  default_branch: z.string().default('main'),
});

/**
 * GitHub 用户 Schema
 */
const GitHubUserSchema = z.object({
  login: z.string().default(''),
  id: z.number().optional(),
});

/**
 * GitHub PR head/base Schema
 */
const GitHubPRRefSchema = z.object({
  ref: z.string().default(''),
  sha: z.string().default(''),
});

/**
 * GitHub Pull Request Schema
 */
const GitHubPullRequestSchema = z.object({
  title: z.string().default(''),
  body: z.string().optional(),
  state: z.string().default(''),
  merged: z.boolean().default(false),
  head: GitHubPRRefSchema.optional(),
  base: GitHubPRRefSchema.optional(),
});

/**
 * GitHub Push Webhook Schema
 */
const GitHubPushWebhookSchema = z.object({
  ref: z.string().default(''),
  before: z.string().default(''),
  after: z.string().default(''),
  commits: z.array(GitHubCommitSchema).default([]),
  repository: GitHubRepositorySchema,
  sender: GitHubUserSchema,
  created_at: z.string().optional(),
});

/**
 * GitHub Pull Request Webhook Schema
 */
const GitHubPullRequestWebhookSchema = z.object({
  action: z.string().default(''),
  number: z.number().default(0),
  pull_request: GitHubPullRequestSchema,
  repository: GitHubRepositorySchema,
  sender: GitHubUserSchema,
  created_at: z.string().optional(),
});

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
   * 使用 Zod 进行运行时验证，防止外部恶意数据导致运行时错误
   */
  parseWebhookEvent(payload: unknown, headers: Record<string, string | undefined>): GitHubPushPayload | GitHubPullRequestPayload | null {
    const event = headers['x-github-event'] as string | undefined;
    
    if (!event) {
      return null;
    }

    try {
      // 根据事件类型使用对应的 Schema 验证
      if (event === 'push') {
        const result = GitHubPushWebhookSchema.safeParse(payload);
        if (!result.success) {
          console.warn('[GitHubOAuth] Push webhook 验证失败:', result.error.message);
          return null;
        }
        const data = result.data;

        return {
          eventType: WebhookEventType.GITHUB_PUSH,
          provider: Provider.GITHUB,
          repository: {
            name: data.repository.name,
            fullName: data.repository.full_name,
            url: data.repository.html_url,
            defaultBranch: data.repository.default_branch,
          },
          sender: {
            username: data.sender.login,
            id: String(data.sender.id),
          },
          timestamp: data.created_at,
          ref: data.ref,
          before: data.before,
          after: data.after,
          commits: data.commits.map((c) => ({
            id: c.id,
            message: c.message,
            author: {
              name: c.author?.name ?? '',
              email: c.author?.email ?? '',
            },
            url: c.url,
            added: c.added,
            removed: c.removed,
            modified: c.modified,
          })),
        };
      }

      if (event === 'pull_request') {
        const result = GitHubPullRequestWebhookSchema.safeParse(payload);
        if (!result.success) {
          console.warn('[GitHubOAuth] Pull request webhook 验证失败:', result.error.message);
          return null;
        }
        const data = result.data;

        return {
          eventType: WebhookEventType.GITHUB_PULL_REQUEST,
          provider: Provider.GITHUB,
          repository: {
            name: data.repository.name,
            fullName: data.repository.full_name,
            url: data.repository.html_url,
            defaultBranch: data.repository.default_branch,
          },
          sender: {
            username: data.sender.login,
            id: String(data.sender.id),
          },
          timestamp: data.created_at,
          action: data.action,
          number: data.number,
          pullRequest: {
            title: data.pull_request.title,
            body: data.pull_request.body,
            state: data.pull_request.state,
            merged: data.pull_request.merged,
            head: {
              ref: data.pull_request.head?.ref ?? '',
              sha: data.pull_request.head?.sha ?? '',
            },
            base: {
              ref: data.pull_request.base?.ref ?? '',
              sha: data.pull_request.base?.sha ?? '',
            },
          },
        };
      }

      return null;
    } catch (error) {
      console.error('[GitHubOAuth] Webhook 解析异常:', error);
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
