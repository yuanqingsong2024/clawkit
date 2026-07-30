/**
 * 钉钉通知器实现
 * 支持文本、Markdown、Link、ActionCard 消息类型
 * 支持加签验证
 */

import * as crypto from 'crypto';
import { createLogger } from '@clawkit/shared';
import type {
  NotificationMessage,
  NotificationResult,
  NotificationContext,
  NotificationChannelType,
} from './notification.types';
import { BaseNotifier } from './base-notifier';

const logger = createLogger('notification.dingtalk');

/**
 * 钉钉通知器
 */
export class DingTalkNotifier extends BaseNotifier {
  readonly channel: NotificationChannelType = 'dingtalk';
  private webhookUrl: string;
  private secret?: string;

  constructor(webhookUrl: string, secret?: string) {
    super();
    this.webhookUrl = webhookUrl;
    this.secret = secret;
  }

  /**
   * 发送通知
   */
  async send(message: NotificationMessage, context?: NotificationContext): Promise<NotificationResult> {
    const startTime = Date.now();

    try {
      // 构建请求体
      const body = this.buildMessage(message);

      // 添加签名（如果配置了 secret）
      let url = this.webhookUrl;
      if (this.secret) {
        const timestamp = Date.now();
        const sign = this.generateSign(timestamp);
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
      }

      // 发送请求
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const result = await response.json() as { errcode?: number; errmsg?: string };

      if (result.errcode === 0 || result.errmsg === 'ok') {
        logger.info('钉钉通知发送成功', { context });
        return {
          success: true,
          channel: 'dingtalk',
          timestamp: new Date(),
          response: result,
        };
      } else {
        logger.error('钉钉通知发送失败', { error: result.errmsg, context });
        return {
          success: false,
          channel: 'dingtalk',
          error: result.errmsg,
          timestamp: new Date(),
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('钉钉通知发送异常', { error: errorMsg, context });
      return {
        success: false,
        channel: 'dingtalk',
        error: errorMsg,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 构建钉钉消息体
   */
  private buildMessage(message: NotificationMessage): Record<string, unknown> {
    const base = {
      msgtype: message.messageType,
    };

    switch (message.messageType) {
      case 'text':
        return {
          ...base,
          text: {
            content: this.formatTextContent(message),
          },
        };

      case 'markdown':
        return {
          ...base,
          markdown: {
            title: message.title,
            text: this.formatMarkdownContent(message),
          },
        };

      case 'link':
        return {
          ...base,
          link: {
            title: message.title,
            text: message.content,
            picUrl: '',
            messageUrl: message.link?.url || '',
          },
        };

      case 'action_card':
        return {
          ...base,
          actionCard: {
            title: message.title,
            text: message.content,
            hideAvatar: '0',
            btnOrientation: message.buttons && message.buttons.length > 1 ? '1' : '0',
            singleTitle: message.buttons?.[0]?.text || '查看详情',
            singleURL: message.buttons?.[0]?.actionUrl || message.link?.url || '',
          },
        };

      default:
        return {
          ...base,
          text: {
            content: `${message.title}\n${message.content}`,
          },
        };
    }
  }

  /**
   * 格式化文本内容
   */
  private formatTextContent(message: NotificationMessage): string {
    const lines = [
      `【${message.title}】`,
      message.content,
    ];
    
    if (message.link) {
      lines.push(`链接: ${message.link.text} - ${message.link.url}`);
    }

    return lines.join('\n');
  }

  /**
   * 格式化 Markdown 内容
   */
  private formatMarkdownContent(message: NotificationMessage): string {
    const lines = [
      `### ${message.title}`,
      '',
      message.content,
    ];

    if (message.link) {
      lines.push('', `[${message.link.text}](${message.link.url})`);
    }

    return lines.join('\n');
  }

  /**
   * 生成钉钉签名
   */
  private generateSign(timestamp: number): string {
    if (!this.secret) return '';

    const stringToSign = `${timestamp}\n${this.secret}`;
    const hmac = crypto.createHmac('sha256', this.secret);
    hmac.update(stringToSign);
    return hmac.digest('base64');
  }

  /**
   * 验证配置是否有效
   */
  validate(): boolean {
    return Boolean(this.webhookUrl) && this.webhookUrl.startsWith('https://');
  }
}

/**
 * 创建钉钉通知器实例
 */
export function createDingTalkNotifier(webhookUrl: string, secret?: string): DingTalkNotifier {
  return new DingTalkNotifier(webhookUrl, secret);
}
