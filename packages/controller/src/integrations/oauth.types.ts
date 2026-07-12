/**
 * OAuth 集成类型定义
 */

import type { FastifyInstance } from 'fastify';

/**
 * OAuth 提供商类型
 */
export enum OAuthProvider {
  GITHUB = 'github',
  GITLAB = 'gitlab',
}

/**
 * OAuth 状态
 */
export interface OAuthState {
  /** 提供商类型 */
  provider: OAuthProvider;
  /** 随机 state 参数，用于 CSRF 防护 */
  state: string;
  /** 重定向 URL */
  redirectUrl?: string;
  /** 创建时间戳 */
  createdAt: number;
}

/**
 * OAuth 用户信息
 */
export interface OAuthUserInfo {
  /** 提供商类型 */
  provider: OAuthProvider;
  /** 第三方用户 ID */
  providerUserId: string;
  /** 用户名 */
  username: string;
  /** 邮箱 */
  email: string;
  /** 显示名称 */
  displayName?: string;
  /** 头像 URL */
  avatarUrl?: string;
  /** 访问令牌 */
  accessToken: string;
  /** 刷新令牌 */
  refreshToken?: string;
  /** 令牌过期时间 */
  expiresAt?: number;
}

/**
 * OAuth 配置
 */
export interface OAuthConfig {
  /** 客户端 ID */
  clientId: string;
  /** 客户端密钥 */
  clientSecret: string;
  /** 回调 URL */
  callbackUrl: string;
  /** 权限范围 */
  scopes: string[];
  /** OAuth 授权 URL */
  authUrl: string;
  /** Token 交换 URL */
  tokenUrl: string;
  /** 用户信息 API URL */
  userInfoUrl: string;
  /** Webhook 密钥（可选，用于签名验证） */
  webhookSecret?: string;
}

/**
 * Webhook 事件类型
 */
export enum WebhookEventType {
  // GitHub 事件
  GITHUB_PUSH = 'push',
  GITHUB_PULL_REQUEST = 'pull_request',
  GITHUB_ISSUE_COMMENT = 'issue_comment',
  GITHUB_CREATE = 'create',
  GITHUB_DELETE = 'delete',
  GITHUB_RELEASE = 'release',

  // GitLab 事件
  GITLAB_PUSH = 'Push Hook',
  GITLAB_MERGE_REQUEST = 'Merge Request Hook',
  GITLAB_NOTE = 'Note Hook',
  GITLAB_TAG_PUSH = 'Tag Push Hook',
  GITLAB_RELEASE = 'Release Hook',
  GITLAB_PIPELINE = 'Pipeline Hook',
}

/**
 * Webhook 事件载荷基类
 */
export interface WebhookPayload {
  /** 事件类型 */
  eventType: WebhookEventType;
  /** 提供商类型 */
  provider: OAuthProvider;
  /** 仓库信息 */
  repository: {
    name: string;
    fullName: string;
    url: string;
    defaultBranch: string;
  };
  /** 发送者信息 */
  sender: {
    username: string;
    id: string;
  };
  /** 原始事件时间 */
  timestamp?: string;
}

/**
 * GitHub Push 事件载荷
 */
export interface GitHubPushPayload extends WebhookPayload {
  eventType: WebhookEventType.GITHUB_PUSH;
  ref: string;
  before: string;
  after: string;
  commits: Array<{
    id: string;
    message: string;
    author: { name: string; email: string };
    url: string;
    added?: string[];
    removed?: string[];
    modified?: string[];
  }>;
}

/**
 * GitHub Pull Request 事件载荷
 */
export interface GitHubPullRequestPayload extends WebhookPayload {
  eventType: WebhookEventType.GITHUB_PULL_REQUEST;
  action: string;
  number: number;
  pullRequest: {
    title: string;
    body?: string;
    state: string;
    merged: boolean;
    head: { ref: string; sha: string };
    base: { ref: string; sha: string };
  };
}

/**
 * GitLab Push 事件载荷
 */
export interface GitLabPushPayload extends WebhookPayload {
  eventType: WebhookEventType.GITLAB_PUSH;
  ref: string;
  before: string;
  after: string;
  commits: Array<{
    id: string;
    message: string;
    author: { name: string; email: string };
    url: string;
    added?: string[];
    removed?: string[];
    modified?: string[];
  }>;
}

/**
 * GitLab Merge Request 事件载荷
 */
export interface GitLabMergeRequestPayload extends WebhookPayload {
  eventType: WebhookEventType.GITLAB_MERGE_REQUEST;
  objectKind: string;
  objectAttributes: {
    id: number;
    iid: number;
    title: string;
    description?: string;
    state: string;
    merged: boolean;
    sourceBranch: string;
    targetBranch: string;
    lastCommit?: {
      id: string;
    };
  };
}

/**
 * Webhook 处理结果
 */
export interface WebhookResult {
  /** 是否成功 */
  success: boolean;
  /** 消息 */
  message: string;
  /** 关联的任务 ID（如果有） */
  taskId?: string;
  /** 事件 ID */
  eventId?: string;
}

/**
 * OAuth 服务接口
 */
export interface OAuthService {
  /** 获取提供商类型 */
  getProvider(): OAuthProvider;
  /** 生成授权 URL */
  getAuthorizationUrl(state: string, redirectUrl?: string): string;
  /** 交换授权码获取 Token */
  exchangeCodeForToken(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }>;
  /** 获取用户信息 */
  getUserInfo(accessToken: string): Promise<OAuthUserInfo>;
  /** 刷新 Token */
  refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }>;
  /** 验证 Webhook 签名 */
  verifyWebhookSignature(payload: string, signature: string, secret?: string): boolean;
  /** 解析 Webhook 事件 */
  parseWebhookEvent(payload: object, headers: Record<string, string | undefined>): WebhookPayload | null;
}

/**
 * OAuth 路由配置
 */
export interface OAuthRoutesConfig {
  /** OAuth 服务实例 */
  service: OAuthService;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * Webhook 事件处理器接口
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

