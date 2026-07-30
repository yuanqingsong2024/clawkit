/**
 * 通知路由
 * 提供通知服务的管理接口
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sendSuccess, sendFailure } from '../types/api-response';
import {
  NotificationService,
  createNotificationService,
  type NotificationServiceConfig,
  type NotificationMessage,
  type NotificationContext,
  type NotificationEventType,
} from '../../services/notification';

const logger = console;

// 通知配置 Schema
const NotificationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  notifiers: z.array(z.object({
    channel: z.enum(['dingtalk', 'feishu', 'slack', 'wecom', 'email', 'webhook']),
    webhookUrl: z.string().url(),
    secret: z.string().optional(),
    enabled: z.boolean().default(true),
    maxRetries: z.number().int().min(0).max(10).default(3),
    retryIntervalMs: z.number().int().min(100).max(60000).default(1000),
    timeoutMs: z.number().int().min(1000).max(60000).default(10000),
  })).default([]),
  logOnFailure: z.boolean().default(true),
});

// 全局通知服务实例
let notificationService: NotificationService | null = null;

/**
 * 获取通知服务实例
 */
export function getNotificationService(): NotificationService | null {
  return notificationService;
}

/**
 * 初始化通知服务
 */
export function initializeNotificationService(config?: Partial<NotificationServiceConfig>): NotificationService {
  const serviceConfig: NotificationServiceConfig = {
    enabled: config?.enabled ?? process.env.NOTIFICATION_ENABLED !== 'false',
    notifiers: config?.notifiers ?? [],
    logOnFailure: config?.logOnFailure ?? true,
  };

  // 从环境变量读取钉钉配置
  if (process.env.DINGTALK_WEBHOOK_URL && serviceConfig.enabled) {
    serviceConfig.notifiers.push({
      enabled: true,
      channel: 'dingtalk',
      webhookUrl: process.env.DINGTALK_WEBHOOK_URL,
      secret: process.env.DINGTALK_SECRET,
      maxRetries: 3,
      retryIntervalMs: 1000,
      timeoutMs: 10000,
    });
  }

  // 从环境变量读取飞书配置
  if (process.env.FEISHU_WEBHOOK_URL && serviceConfig.enabled) {
    serviceConfig.notifiers.push({
      enabled: true,
      channel: 'feishu',
      webhookUrl: process.env.FEISHU_WEBHOOK_URL,
      secret: process.env.FEISHU_SECRET,
      maxRetries: 3,
      retryIntervalMs: 1000,
      timeoutMs: 10000,
    });
  }

  notificationService = createNotificationService(serviceConfig);
  return notificationService;
}

/**
 * 注册通知路由
 */
export function buildNotifyRoutes(): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    // 初始化通知服务
    if (!notificationService) {
      initializeNotificationService();
    }

    // 获取服务状态
    app.get('/status', async (_request, reply) => {
      if (!notificationService) {
        return sendFailure(reply, {
          statusCode: 503,
          code: 'notification.service_not_initialized',
          message: '通知服务未初始化', details: null,
        });
      }

      return sendSuccess(reply, {
        code: 'notification.status_fetched',
        message: '通知服务状态查询成功',
        data: {
          enabled: notificationService.getEnabledChannels().length > 0,
          channels: notificationService.getEnabledChannels(),
        },
      });
    });

    // 配置通知服务
    app.post<{ Body: z.infer<typeof NotificationConfigSchema> }>('/config', async (request, reply) => {
      try {
        const config = NotificationConfigSchema.parse(request.body);
        notificationService = initializeNotificationService(config);

        return sendSuccess(reply, {
          code: 'notification.config_updated',
          message: '通知配置已更新',
          data: {
            enabled: config.enabled,
            channelCount: config.notifiers.filter(n => n.enabled).length,
          },
        });
      } catch (error) {
        return sendFailure(reply, {
          statusCode: 400,
          code: 'notification.config_invalid',
          message: '通知配置无效',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // 发送自定义通知
    app.post<{ Body: { title: string; content: string; channel?: string } }>('/send', async (request, reply) => {
      if (!notificationService) {
        return sendFailure(reply, {
          statusCode: 503,
          code: 'notification.service_not_initialized',
          message: '通知服务未初始化', details: null,
        });
      }

      const { title, content, channel } = request.body;

      const message: NotificationMessage = {
        title: title || 'ClawKit 通知',
        content: content || '',
        messageType: 'markdown',
      };

      let result;
      if (channel) {
        result = await notificationService.notifyTo(channel, message);
      } else {
        result = await notificationService.notify(message);
      }

      return sendSuccess(reply, {
        code: 'notification.sent',
        message: '通知发送完成',
        data: result,
      });
    });

    // 测试指定渠道
    app.post<{ Body: { channel: string } }>('/test', async (request, reply) => {
      if (!notificationService) {
        return sendFailure(reply, {
          statusCode: 503,
          code: 'notification.service_not_initialized',
          message: '通知服务未初始化', details: null,
        });
      }

      const { channel } = request.body;

      if (!notificationService.isChannelEnabled(channel)) {
        return sendFailure(reply, {
          statusCode: 400,
          code: 'notification.channel_not_enabled',
          message: `通知渠道未启用: ${channel}`, details: null,
        });
      }

      const result = await notificationService.testNotification(channel);

      return sendSuccess(reply, {
        code: 'notification.test_sent',
        message: result.success ? '测试通知发送成功' : '测试通知发送失败',
        data: result,
      });
    });

    // 发送任务事件通知
    app.post<{ Body: { event: NotificationEventType; context: NotificationContext } }>('/task-event', async (request, reply) => {
      if (!notificationService) {
        return sendFailure(reply, {
          statusCode: 503,
          code: 'notification.service_not_initialized',
          message: '通知服务未初始化', details: null,
        });
      }

      const { event, context } = request.body;
      const results = await notificationService.notifyTaskEvent(event, context);

      return sendSuccess(reply, {
        code: 'notification.task_event_sent',
        message: '任务事件通知发送完成',
        data: results,
      });
    });

    // 获取支持的渠道列表
    app.get('/channels', async (_request, reply) => {
      return sendSuccess(reply, {
        code: 'notification.channels_fetched',
        message: '支持的渠道列表',
        data: {
          channels: [
            { id: 'dingtalk', name: '钉钉', description: '钉钉群 Webhook 通知' },
            { id: 'feishu', name: '飞书', description: '飞书群 Webhook 通知' },
            { id: 'slack', name: 'Slack', description: 'Slack Webhook 通知' },
            { id: 'wecom', name: '企业微信', description: '企业微信群 Webhook 通知' },
            { id: 'email', name: '邮件', description: 'SMTP 邮件通知' },
            { id: 'webhook', name: '自定义 Webhook', description: '通用 HTTP Webhook' },
          ],
        },
      });
    });

    logger.log('[NotifyRoutes] 通知路由已注册');
  };
}
