/**
 * 飞书通知器实现
 * 支持文本、Markdown、Post 消息类型
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

const logger = createLogger('notification.feishu');

/**
 * 飞书通知器
 */
export class FeishuNotifier extends BaseNotifier {
  readonly channel: NotificationChannelType = 'feishu';
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
        const timestamp = Math.floor(Date.now() / 1000);
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

      const result = await response.json() as { code?: number; msg?: string; message?: string; StatusCode?: number };

      if (result.code === 0 || result.StatusCode === 0) {
        logger.info('飞书通知发送成功', { context });
        return {
          success: true,
          channel: 'feishu',
          timestamp: new Date(),
          response: result,
        };
      } else {
        logger.error('飞书通知发送失败', { error: result.msg || result.message, context });
        return {
          success: false,
          channel: 'feishu',
          error: result.msg || result.message || '发送失败',
          timestamp: new Date(),
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('飞书通知发送异常', { error: errorMsg, context });
      return {
        success: false,
        channel: 'feishu',
        error: errorMsg,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 构建飞书消息体
   */
  private buildMessage(message: NotificationMessage): Record<string, unknown> {
    const base = {
      msg_type: this.mapMessageType(message.messageType),
    };

    switch (message.messageType) {
      case 'text':
        return {
          ...base,
          content: {
            text: this.formatTextContent(message),
          },
        };

      case 'markdown':
        return {
          ...base,
          content: {
            text: this.formatMarkdownContent(message),
          },
        };

      case 'link':
        return {
          ...base,
          content: {
            tag: 'a',
            text: message.title,
            href: message.link?.url || '',
          },
        };

      case 'action_card':
        return {
          msg_type: 'interactive',
          card: {
            header: {
              title: {
                tag: 'plain_text',
                content: message.title,
              },
              template: 'blue',
            },
            elements: [
              {
                tag: 'div',
                text: {
                  tag: 'lark_md',
                  content: message.content,
                },
              },
              ...this.buildCardActions(message),
            ],
          },
        };

      default:
        return {
          ...base,
          content: {
            text: `${message.title}\n${message.content}`,
          },
        };
    }
  }

  /**
   * 构建卡片按钮
   */
  private buildCardActions(message: NotificationMessage): Array<Record<string, unknown>> {
    if (!message.buttons || message.buttons.length === 0) {
      return [];
    }

    if (message.buttons.length === 1) {
      return [{
        tag: 'action',
        actions: [{
          tag: 'button',
          text: {
            tag: 'plain_text',
            content: message.buttons![0].text,
          },
          type: 'primary',
          url: message.buttons![0].actionUrl,
        }],
      }];
    }

    return [{
      tag: 'action',
      actions: message.buttons.map((btn) => ({
        tag: 'button',
        text: {
          tag: 'plain_text',
          content: btn.text,
        },
        type: 'primary',
        url: btn.actionUrl,
      })),
    }];
  }

  /**
   * 映射消息类型
   */
  private mapMessageType(messageType: string): string {
    const typeMap: Record<string, string> = {
      text: 'text',
      markdown: 'text', // 飞书使用 text 类型发送 markdown
      link: 'post',
      action_card: 'interactive',
    };
    return typeMap[messageType] || 'text';
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
      lines.push(`链接: ${message.link.text}`);
    }

    return lines.join('\n');
  }

  /**
   * 格式化 Markdown 内容
   */
  private formatMarkdownContent(message: NotificationMessage): string {
    const lines = [
      `**${message.title}**`,
      '',
      message.content,
    ];

    if (message.link) {
      lines.push('', `[${message.link.text}](${message.link.url})`);
    }

    return lines.join('\n');
  }

  /**
   * 生成飞书签名
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
    return Boolean(this.webhookUrl) && (
      this.webhookUrl.startsWith('https://open.feishu.cn') ||
      this.webhookUrl.startsWith('https://applink.feishu.cn')
    );
  }
}

/**
 * 创建飞书通知器实例
 */
export function createFeishuNotifier(webhookUrl: string, secret?: string): FeishuNotifier {
  return new FeishuNotifier(webhookUrl, secret);
}
