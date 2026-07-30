/**
 * 通知服务管理器
 * 统一管理多种通知渠道
 */

import { createLogger } from '@clawkit/shared';
import type {
  NotificationMessage,
  NotificationResult,
  NotificationContext,
  NotificationServiceConfig,
  NotificationEventType,
} from './notification.types';
import { Notifier } from './base-notifier';
import { DingTalkNotifier } from './dingtalk-notifier';
import { FeishuNotifier } from './feishu-notifier';

const logger = createLogger('notification.service');

/**
 * 通知服务
 */
export class NotificationService {
  private notifiers: Map<string, Notifier> = new Map();
  private config: NotificationServiceConfig;
  private eventListeners: Map<NotificationEventType, Array<(event: NotificationContext) => void>> = new Map();

  constructor(config: NotificationServiceConfig) {
    this.config = config;
    this.initializeNotifiers();
  }

  /**
   * 初始化通知器
   */
  private initializeNotifiers(): void {
    if (!this.config.enabled) {
      logger.info('通知服务已禁用');
      return;
    }

    for (const notifierConfig of this.config.notifiers) {
      if (!notifierConfig.enabled) {
        continue;
      }

      try {
        const notifier = this.createNotifier(notifierConfig);
        if (notifier.validate()) {
          this.notifiers.set(notifierConfig.channel, notifier);
          logger.info(`通知器已初始化: ${notifierConfig.channel}`);
        } else {
          logger.warn(`通知器配置无效: ${notifierConfig.channel}`);
        }
      } catch (error) {
        logger.error(`通知器初始化失败: ${notifierConfig.channel}`, { error });
      }
    }

    logger.info(`通知服务已初始化，共 ${this.notifiers.size} 个通知器`);
  }

  /**
   * 创建通知器实例
   */
  private createNotifier(config: { channel: string; webhookUrl: string; secret?: string }): Notifier {
    switch (config.channel) {
      case 'dingtalk':
        return new DingTalkNotifier(config.webhookUrl, config.secret);
      case 'feishu':
        return new FeishuNotifier(config.webhookUrl, config.secret);
      default:
        throw new Error(`不支持的通知渠道: ${config.channel}`);
    }
  }

  /**
   * 发送通知到所有启用的渠道
   */
  async notify(message: NotificationMessage, context?: NotificationContext): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const [channel, notifier] of this.notifiers) {
      try {
        const result = await notifier.send(message, context);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          channel: channel as any,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * 发送通知到指定渠道
   */
  async notifyTo(channel: string, message: NotificationMessage, context?: NotificationContext): Promise<NotificationResult> {
    const notifier = this.notifiers.get(channel);
    if (!notifier) {
      return {
        success: false,
        channel: channel as any,
        error: `通知渠道未配置: ${channel}`,
        timestamp: new Date(),
      };
    }

    return notifier.send(message, context);
  }

  /**
   * 发送任务相关通知
   */
  async notifyTaskEvent(eventType: NotificationEventType, context: NotificationContext): Promise<NotificationResult[]> {
    const message = this.buildTaskNotification(eventType, context);
    return this.notify(message, context);
  }

  /**
   * 构建任务通知消息
   */
  private buildTaskNotification(eventType: NotificationEventType, context: NotificationContext): NotificationMessage {
    const eventLabels: Record<NotificationEventType, { title: string; content: string }> = {
      'task.created': {
        title: '📝 新任务创建',
        content: `项目: ${context.projectKey || '未知'}\n操作人: ${context.operator || '系统'}\n任务ID: ${context.taskId || '未知'}`,
      },
      'task.approved': {
        title: '✅ 任务已确认',
        content: `任务已确认，等待派发执行\n项目: ${context.projectKey || '未知'}\n操作人: ${context.operator || '系统'}`,
      },
      'task.revised': {
        title: '🔄 任务已修改',
        content: `任务草案已修改\n项目: ${context.projectKey || '未知'}\n操作人: ${context.operator || '系统'}`,
      },
      'task.cancelled': {
        title: '❌ 任务已取消',
        content: `任务已被取消\n项目: ${context.projectKey || '未知'}\n操作人: ${context.operator || '系统'}`,
      },
      'task.dispatched': {
        title: '🚀 任务已派发',
        content: `任务已派发给 Worker 执行\n项目: ${context.projectKey || '未知'}`,
      },
      'task.started': {
        title: '▶️ 任务开始执行',
        content: `任务已开始执行\n项目: ${context.projectKey || '未知'}`,
      },
      'task.completed': {
        title: '🎉 任务已完成',
        content: `项目: ${context.projectKey || '未知'}\n结果: ${context.result?.message || '成功'}`,
      },
      'task.failed': {
        title: '💥 任务执行失败',
        content: `项目: ${context.projectKey || '未知'}\n错误: ${context.result?.error || '未知错误'}`,
      },
      'worker.registered': {
        title: '🖥️ Worker 已注册',
        content: `新的 Worker 已注册上线\n项目亲和: ${context.projectKey || '全部'}`,
      },
      'worker.offline': {
        title: '⚠️ Worker 已离线',
        content: `Worker 已断开连接\n项目: ${context.projectKey || '未知'}`,
      },
      'system.error': {
        title: '🔴 系统错误',
        content: `系统发生错误\n详情: ${context.result?.message || '未知'}`,
      },
      'system.warning': {
        title: '⚠️ 系统警告',
        content: `系统发生警告\n详情: ${context.result?.message || '未知'}`,
      },
    };

    const label = eventLabels[eventType] || { title: '通知', content: '' };

    return {
      title: label.title,
      content: label.content,
      messageType: 'markdown',
      priority: eventType.startsWith('task.failed') || eventType.startsWith('system.error') ? 'high' : 'normal',
    };
  }

  /**
   * 注册事件监听器
   */
  on(eventType: NotificationEventType, handler: (context: NotificationContext) => void): void {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.push(handler);
    this.eventListeners.set(eventType, listeners);
  }

  /**
   * 移除事件监听器
   */
  off(eventType: NotificationEventType, handler: (context: NotificationContext) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(handler);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   */
  async emit(eventType: NotificationEventType, context: NotificationContext): Promise<void> {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      for (const handler of listeners) {
        try {
          await handler(context);
        } catch (error) {
          logger.error(`事件处理器执行失败: ${eventType}`, { error });
        }
      }
    }
  }

  /**
   * 获取已注册的通知渠道列表
   */
  getEnabledChannels(): string[] {
    return Array.from(this.notifiers.keys());
  }

  /**
   * 检查渠道是否启用
   */
  isChannelEnabled(channel: string): boolean {
    return this.notifiers.has(channel);
  }

  /**
   * 测试通知
   */
  async testNotification(channel: string): Promise<NotificationResult> {
    const message: NotificationMessage = {
      title: '🧪 通知测试',
      content: '这是一条测试消息，用于验证通知渠道配置是否正确。\n\n如果收到此消息，说明通知服务配置成功！',
      messageType: 'markdown',
    };

    return this.notifyTo(channel, message);
  }
}

/**
 * 创建通知服务
 */
export function createNotificationService(config: NotificationServiceConfig): NotificationService {
  return new NotificationService(config);
}
