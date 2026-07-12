/**
 * OAuth 管理器服务
 * 
 * 统一管理多个 OAuth 提供商，提供状态存储和会话管理
 * 
 * @module integrations
 */

import crypto from 'node:crypto';

import type { 
  OAuthService, 
  OAuthProvider, 
  OAuthUserInfo, 
  OAuthState 
} from './oauth.types';
import { OAuthProvider as Provider } from './oauth.types';
import { GitHubOAuthService, type GitHubOAuthConfig } from './github-oauth.service';
import { GitLabOAuthService, type GitLabOAuthConfig } from './gitlab-oauth.service';

/**
 * OAuth 管理器配置
 */
export interface OAuthManagerConfig {
  /** GitHub OAuth 配置 */
  github?: GitHubOAuthConfig;
  /** GitLab OAuth 配置 */
  gitlab?: GitLabOAuthConfig;
  /** State 有效期（毫秒），默认 10 分钟 */
  stateTtlMs?: number;
  /** 会话有效期（毫秒），默认 24 小时 */
  sessionTtlMs?: number;
}

/**
 * OAuth 会话信息
 */
export interface OAuthSession {
  /** 会话 ID */
  sessionId: string;
  /** 提供商类型 */
  provider: OAuthProvider;
  /** 用户信息 */
  userInfo?: OAuthUserInfo;
  /** 创建时间 */
  createdAt: number;
  /** 过期时间 */
  expiresAt: number;
}

/**
 * OAuth 授权结果
 */
export interface OAuthAuthorizationResult {
  /** 是否成功 */
  success: boolean;
  /** 用户信息（成功时） */
  userInfo?: OAuthUserInfo;
  /** 错误信息（失败时） */
  error?: string;
  /** 会话 ID */
  sessionId?: string;
}

/**
 * OAuth 管理器服务
 * 
 * 负责管理 OAuth 授权流程、状态存储、会话管理
 */
export class OAuthManager {
  private readonly services: Map<OAuthProvider, OAuthService> = new Map();
  private readonly states: Map<string, OAuthState> = new Map();
  private readonly sessions: Map<string, OAuthSession> = new Map();
  private readonly stateTtlMs: number;
  private readonly sessionTtlMs: number;

  constructor(config: OAuthManagerConfig) {
    this.stateTtlMs = config.stateTtlMs || 10 * 60 * 1000; // 默认 10 分钟
    this.sessionTtlMs = config.sessionTtlMs || 24 * 60 * 60 * 1000; // 默认 24 小时

    // 初始化 GitHub 服务
    if (config.github?.clientId && config.github?.clientSecret) {
      this.services.set(Provider.GITHUB, new GitHubOAuthService(config.github));
    }

    // 初始化 GitLab 服务
    if (config.gitlab?.clientId && config.gitlab?.clientSecret) {
      this.services.set(Provider.GITLAB, new GitLabOAuthService(config.gitlab));
    }
  }

  /**
   * 获取所有已配置且启用的提供商
   */
  getEnabledProviders(): OAuthProvider[] {
    return Array.from(this.services.keys());
  }

  /**
   * 检查提供商是否已启用
   */
  isProviderEnabled(provider: OAuthProvider): boolean {
    return this.services.has(provider);
  }

  /**
   * 获取 OAuth 服务实例
   */
  getService(provider: OAuthProvider): OAuthService | undefined {
    return this.services.get(provider);
  }

  /**
   * 生成授权 URL 并存储 state
   */
  generateAuthorizationUrl(provider: OAuthProvider, redirectUrl?: string): string | null {
    const service = this.services.get(provider);
    if (!service) {
      return null;
    }

    // 生成随机 state
    const state = crypto.randomBytes(32).toString('hex');
    
    // 存储 state
    this.states.set(state, {
      provider,
      state,
      redirectUrl,
      createdAt: Date.now(),
    });

    // 清理过期 state
    this.cleanupExpiredStates();

    return service.getAuthorizationUrl(state, redirectUrl);
  }

  /**
   * 验证并使用授权码完成授权流程
   */
  async handleCallback(
    provider: OAuthProvider,
    code: string,
    state: string,
  ): Promise<OAuthAuthorizationResult> {
    // 验证 state
    const storedState = this.states.get(state);
    if (!storedState) {
      return { success: false, error: '无效的 state 参数或已过期' };
    }

    if (storedState.provider !== provider) {
      return { success: false, error: 'Provider 不匹配' };
    }

    if (Date.now() - storedState.createdAt > this.stateTtlMs) {
      this.states.delete(state);
      return { success: false, error: 'state 已过期，请重新授权' };
    }

    // 删除已使用的 state
    this.states.delete(state);

    // 获取服务并交换 token
    const service = this.services.get(provider);
    if (!service) {
      return { success: false, error: 'OAuth 服务未配置' };
    }

    try {
      const tokenResult = await service.exchangeCodeForToken(code);
      const userInfo = await service.getUserInfo(tokenResult.accessToken);

      // 创建会话
      const sessionId = crypto.randomBytes(32).toString('hex');
      const now = Date.now();
      
      this.sessions.set(sessionId, {
        sessionId,
        provider,
        userInfo: {
          ...userInfo,
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken,
          expiresAt: tokenResult.expiresIn 
            ? now + tokenResult.expiresIn * 1000 
            : undefined,
        },
        createdAt: now,
        expiresAt: now + this.sessionTtlMs,
      });

      return {
        success: true,
        userInfo,
        sessionId,
      };
    } catch (error) {
      return {
        success: false,
        error: `授权失败：${(error as Error).message}`,
      };
    }
  }

  /**
   * 通过会话 ID 获取用户信息
   */
  getSession(sessionId: string): OAuthSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * 验证会话并获取用户信息
   */
  validateSession(sessionId: string): OAuthUserInfo | null {
    const session = this.getSession(sessionId);
    return session?.userInfo || null;
  }

  /**
   * 销毁会话
   */
  destroySession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * 清理过期的 state
   */
  private cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [state, data] of this.states.entries()) {
      if (now - data.createdAt > this.stateTtlMs) {
        this.states.delete(state);
      }
    }
  }

  /**
   * 清理过期的会话
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    let count = 0;
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
        count++;
      }
    }
    return count;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    activeStates: number;
    activeSessions: number;
    enabledProviders: OAuthProvider[];
  } {
    return {
      activeStates: this.states.size,
      activeSessions: this.sessions.size,
      enabledProviders: this.getEnabledProviders(),
    };
  }
}
