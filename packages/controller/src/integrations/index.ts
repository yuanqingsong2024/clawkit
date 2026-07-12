/**
 * GitHub/GitLab OAuth 集成模块
 * 
 * 提供 OAuth 2.0 登录认证和 Webhook 事件处理
 * 
 * @module integrations
 */

// 类型定义
export {
  OAuthProvider,
  OAuthState,
  OAuthUserInfo,
  OAuthConfig,
  WebhookEventType,
  WebhookPayload,
  GitHubPushPayload,
  GitHubPullRequestPayload,
  GitLabPushPayload,
  GitLabMergeRequestPayload,
  WebhookResult,
  OAuthService,
  OAuthRoutesConfig,
} from './oauth.types';

export type { GitHubOAuthConfig } from './github-oauth.service';
export type { GitLabOAuthConfig } from './gitlab-oauth.service';
export type { OAuthManagerConfig, OAuthSession, OAuthAuthorizationResult } from './oauth-manager.service';
export type { WebhookHandler, WebhookManagerConfig } from './webhook-manager.service';
export type { TaskCreator, WebhookTaskHandlerConfig } from './webhook-task-handler';

// 服务类
export { GitHubOAuthService } from './github-oauth.service';
export { GitLabOAuthService } from './gitlab-oauth.service';
export { OAuthManager } from './oauth-manager.service';
export { WebhookManager } from './webhook-manager.service';
export { WebhookTaskHandler } from './webhook-task-handler';
