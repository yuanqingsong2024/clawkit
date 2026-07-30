/**
 * 通知器基类
 * 提供通用的 HTTP 请求和重试逻辑
 */

import type {
  NotificationMessage,
  NotificationResult,
  NotificationContext,
  NotificationChannelType,
} from './notification.types';

/**
 * 通知器接口
 */
export interface Notifier {
  /** 渠道类型 */
  readonly channel: NotificationChannelType;
  /** 发送通知 */
  send(message: NotificationMessage, context?: NotificationContext): Promise<NotificationResult>;
  /** 验证配置是否有效 */
  validate(): boolean;
}

/**
 * 通知器基类
 */
export abstract class BaseNotifier implements Notifier {
  abstract readonly channel: NotificationChannelType;

  /** 最大重试次数 */
  protected maxRetries = 3;
  /** 重试间隔（毫秒） */
  protected retryIntervalMs = 1000;
  /** 超时时间（毫秒） */
  protected timeoutMs = 10000;

  /**
   * 发送通知
   */
  abstract send(message: NotificationMessage, context?: NotificationContext): Promise<NotificationResult>;

  /**
   * 验证配置是否有效
   */
  abstract validate(): boolean;

  /**
   * 带重试的 fetch 请求
   */
  protected async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = this.maxRetries,
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 如果响应成功，直接返回
        if (response.ok || response.status === 200) {
          return response;
        }

        // 如果是服务器错误且还有重试机会
        if (response.status >= 500 && attempt < retries) {
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          await this.delay(this.retryIntervalMs * (attempt + 1));
          continue;
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 如果不是网络错误，不重试
        if (!(lastError.name === 'AbortError' || lastError.message.includes('fetch'))) {
          throw lastError;
        }

        // 还有重试机会
        if (attempt < retries) {
          await this.delay(this.retryIntervalMs * (attempt + 1));
        }
      }
    }

    throw lastError || new Error('请求失败');
  }

  /**
   * 延迟
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
