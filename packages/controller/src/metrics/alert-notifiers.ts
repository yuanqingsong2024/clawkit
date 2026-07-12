import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { AlertLevel, type Alert, type AlertEvent } from './alert-rules';

/**
 * 通知渠道类型
 */
export enum NotificationChannel {
  CONSOLE = 'console',       // 控制台日志
  WEBHOOK = 'webhook',       // Webhook
  EMAIL = 'email',           // 邮件
  DINGTALK = 'dingtalk',     // 钉钉
  LARK = 'lark',             // 飞书
  SLACK = 'slack',           // Slack
}

/**
 * 通知配置基类
 */
export interface NotificationConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 通知级别（只发送此级别及以上的告警） */
  minLevel?: AlertLevel;
  /** 消息模板 */
  template?: string;
}

/**
 * Webhook 通知配置
 */
export interface WebhookNotificationConfig extends NotificationConfig {
  type: NotificationChannel.WEBHOOK;
  url: string;
  method?: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  secret?: string; // 用于签名
}

/**
 * 邮件通知配置
 */
export interface EmailNotificationConfig extends NotificationConfig {
  type: NotificationChannel.EMAIL;
  smtp: {
    host: string;
    port: number;
    secure?: boolean;
    user: string;
    password: string;
  };
  from: string;
  to: string[];
  subject?: string;
}

/**
 * 钉钉通知配置
 */
export interface DingtalkNotificationConfig extends NotificationConfig {
  type: NotificationChannel.DINGTALK;
  webhookUrl: string;
  secret?: string; // 签名密钥
}

/**
 * 飞书通知配置
 */
export interface LarkNotificationConfig extends NotificationConfig {
  type: NotificationChannel.LARK;
  webhookUrl: string;
}

/**
 * Slack 通知配置
 */
export interface SlackNotificationConfig extends NotificationConfig {
  type: NotificationChannel.SLACK;
  webhookUrl: string;
  channel?: string;
  username?: string;
}

/**
 * 通知记录
 */
export interface NotificationRecord {
  id: string;
  alertId: string;
  channel: NotificationChannel;
  recipient: string;
  status: 'sent' | 'failed' | 'pending';
  sentAt?: Date;
  error?: string;
  response?: string;
}

/**
 * 通知服务
 * 发送告警通知到各种渠道
 */
export class AlertNotificationService extends EventEmitter {
  private readonly notifiers: Map<NotificationChannel, AlertNotifier> = new Map();
  private readonly records: NotificationRecord[] = [];
  private readonly instanceId: string;

  constructor(instanceId: string) {
    super();
    this.instanceId = instanceId;
  }

  /**
   * 注册通知器
   */
  registerNotifier(channel: NotificationChannel, notifier: AlertNotifier): void {
    this.notifiers.set(channel, notifier);
  }

  /**
   * 移除通知器
   */
  removeNotifier(channel: NotificationChannel): boolean {
    return this.notifiers.delete(channel);
  }

  /**
   * 配置 Webhook 通知
   */
  configureWebhook(config: WebhookNotificationConfig): void {
    const notifier = new WebhookNotifier(config);
    this.registerNotifier(NotificationChannel.WEBHOOK, notifier);
  }

  /**
   * 配置钉钉通知
   */
  configureDingtalk(config: DingtalkNotificationConfig): void {
    const notifier = new DingtalkNotifier(config);
    this.registerNotifier(NotificationChannel.DINGTALK, notifier);
  }

  /**
   * 配置飞书通知
   */
  configureLark(config: LarkNotificationConfig): void {
    const notifier = new LarkNotifier(config);
    this.registerNotifier(NotificationChannel.LARK, notifier);
  }

  /**
   * 发送告警通知
   */
  async sendAlert(alert: Alert): Promise<NotificationRecord[]> {
    const results: NotificationRecord[] = [];

    for (const [channel, notifier] of this.notifiers) {
      const record = await this.sendToNotifier(channel, notifier, alert);
      results.push(record);
    }

    return results;
  }

  /**
   * 发送到指定通知器
   */
  private async sendToNotifier(
    channel: NotificationChannel,
    notifier: AlertNotifier,
    alert: Alert,
  ): Promise<NotificationRecord> {
    const record: NotificationRecord = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      alertId: alert.id,
      channel,
      recipient: notifier.getRecipient(),
      status: 'pending',
    };

    try {
      await notifier.send(alert, this.instanceId);
      record.status = 'sent';
      record.sentAt = new Date();

      this.emit('notification_sent', record);
    } catch (error) {
      record.status = 'failed';
      record.error = (error as Error).message;

      this.emit('notification_failed', record);
    }

    this.records.push(record);
    return record;
  }

  /**
   * 获取通知记录
   */
  getRecords(alertId?: string): NotificationRecord[] {
    if (alertId) {
      return this.records.filter((r) => r.alertId === alertId);
    }
    return [...this.records];
  }

  /**
   * 获取最近的通知记录
   */
  getRecentRecords(limit: number = 100): NotificationRecord[] {
    return this.records
      .slice(-limit)
      .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0));
  }

  /**
   * 清除通知记录
   */
  clearRecords(): void {
    this.records.length = 0;
  }

  /**
   * 获取统计信息
   */
  getStats(): { total: number; sent: number; failed: number } {
    return {
      total: this.records.length,
      sent: this.records.filter((r) => r.status === 'sent').length,
      failed: this.records.filter((r) => r.status === 'failed').length,
    };
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.notifiers.clear();
    this.records.length = 0;
    this.removeAllListeners();
  }
}

/**
 * 告警通知器接口
 */
export interface AlertNotifier {
  send(alert: Alert, instanceId: string): Promise<void>;
  getRecipient(): string;
}

/**
 * Webhook 通知器
 */
class WebhookNotifier implements AlertNotifier {
  private readonly config: WebhookNotificationConfig;

  constructor(config: WebhookNotificationConfig) {
    this.config = config;
  }

  async send(alert: Alert, instanceId: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const body = this.buildBody(alert, instanceId);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };

    // 如果配置了签名，添加签名
    if (this.config.secret) {
      const signature = this.generateSignature(JSON.stringify(body));
      headers['X-Signature'] = signature;
    }

    const response = await fetch(this.config.url, {
      method: this.config.method ?? 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Webhook 请求失败: ${response.status} ${response.statusText}`);
    }
  }

  private buildBody(alert: Alert, instanceId: string): object {
    return {
      alertId: alert.id,
      ruleId: alert.ruleId,
      name: alert.name,
      level: alert.level,
      status: alert.status,
      message: alert.message,
      metricValue: alert.metricValue,
      threshold: alert.threshold,
      triggeredAt: alert.triggeredAt.toISOString(),
      tags: alert.tags,
      instanceId,
    };
  }

  private generateSignature(data: string): string {
    return createHash('sha256').update(data + this.config.secret).digest('hex');
  }

  getRecipient(): string {
    return this.config.url;
  }
}

/**
 * 钉钉通知器
 */
class DingtalkNotifier implements AlertNotifier {
  private readonly config: DingtalkNotificationConfig;

  constructor(config: DingtalkNotificationConfig) {
    this.config = config;
  }

  async send(alert: Alert, instanceId: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    let webhookUrl = this.config.webhookUrl;

    // 如果配置了签名，添加签名参数
    if (this.config.secret) {
      const timestamp = Date.now();
      const sign = this.generateSign(timestamp);
      webhookUrl += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
    }

    const body = this.buildBody(alert, instanceId);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`钉钉通知失败: ${response.status}`);
    }

    const result = await response.json() as { errcode: number; errmsg: string };
    if (result.errcode !== 0) {
      throw new Error(`钉钉通知错误: ${result.errmsg}`);
    }
  }

  private buildBody(alert: Alert, instanceId: string): object {
    const levelEmoji: Record<AlertLevel, string> = {
      [AlertLevel.INFO]: 'ℹ️',
      [AlertLevel.WARNING]: '⚠️',
      [AlertLevel.ERROR]: '🚨',
      [AlertLevel.CRITICAL]: '🔴',
    };

    return {
      msgtype: 'markdown',
      markdown: {
        title: `${levelEmoji[alert.level]} ${alert.name}`,
        text: [
          `## ${levelEmoji[alert.level]} ${alert.name}`,
          `**级别**: ${alert.level}`,
          `**状态**: ${alert.status}`,
          `**消息**: ${alert.message}`,
          `**时间**: ${alert.triggeredAt.toLocaleString()}`,
          `**实例**: ${instanceId}`,
          alert.tags.length > 0 ? `**标签**: ${alert.tags.join(', ')}` : '',
        ].filter(Boolean).join('\n\n'),
      },
    };
  }

  private generateSign(timestamp: number): string {
    const stringToSign = `${timestamp}\n${this.config.secret}`;
    return createHash('sha256').update(stringToSign).digest('base64');
  }

  getRecipient(): string {
    return this.config.webhookUrl.split('?')[0];
  }
}

/**
 * 飞书通知器
 */
class LarkNotifier implements AlertNotifier {
  private readonly config: LarkNotificationConfig;

  constructor(config: LarkNotificationConfig) {
    this.config = config;
  }

  async send(alert: Alert, instanceId: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const body = this.buildBody(alert, instanceId);

    const response = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`飞书通知失败: ${response.status}`);
    }
  }

  private buildBody(alert: Alert, instanceId: string): object {
    return {
      msg_type: 'interactive',
      card: {
        header: {
          title: {
            tag: 'plain_text',
            content: `${alert.level.toUpperCase()}: ${alert.name}`,
          },
          template: this.getTemplateColor(alert.level),
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: alert.message,
            },
          },
          {
            tag: 'hr',
          },
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `**时间**: ${alert.triggeredAt.toLocaleString()}\n**实例**: ${instanceId}`,
            },
          },
        ],
      },
    };
  }

  private getTemplateColor(level: AlertLevel): string {
    switch (level) {
      case AlertLevel.INFO:
        return 'blue';
      case AlertLevel.WARNING:
        return 'yellow';
      case AlertLevel.ERROR:
        return 'orange';
      case AlertLevel.CRITICAL:
        return 'red';
      default:
        return 'grey';
    }
  }

  getRecipient(): string {
    return this.config.webhookUrl;
  }
}
