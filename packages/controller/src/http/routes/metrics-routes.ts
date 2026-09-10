import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { register, collectDefaultMetrics } from 'prom-client';
import { sendSuccess } from '../types/api-response';
import type { MetricsCollector } from '../../metrics/metrics-collector';
import type { AlertRulesEngine } from '../../metrics/alert-rules';
import type { AlertNotificationService } from '../../metrics/alert-notifiers';

// 收集默认指标（进程信息、内存等）
collectDefaultMetrics();

/**
 * 指标服务上下文
 */
export interface MetricsServiceContext {
  metricsCollector: MetricsCollector;
  alertRulesEngine: AlertRulesEngine;
  notificationService: AlertNotificationService;
}

/**
 * 构建指标路由
 */
export function buildMetricsRoutes(context: MetricsServiceContext): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    const { metricsCollector, alertRulesEngine, notificationService } = context;

    // Prometheus 指标端点
    app.get('/prometheus', async (_request, reply) => {
      reply.header('Content-Type', register.contentType);
      return register.metrics();
    });

    // 获取当前指标快照
    app.get('/', async (_request, reply) => {
      const snapshot = metricsCollector.getSnapshot();
      sendSuccess(reply, {
        code: 'metrics.fetched',
        message: '指标查询成功',
        data: snapshot,
      });
    });

    // 获取任务指标
    app.get('/task', async (_request, reply) => {
      const metrics = metricsCollector.getTaskMetrics();
      sendSuccess(reply, {
        code: 'metrics.task_fetched',
        message: '任务指标查询成功',
        data: metrics,
      });
    });

    // 获取系统指标
    app.get('/system', async (_request, reply) => {
      const metrics = metricsCollector.getSystemMetrics();
      sendSuccess(reply, {
        code: 'metrics.system_fetched',
        message: '系统指标查询成功',
        data: metrics,
      });
    });

    // 获取 Worker 指标
    app.get('/worker', async (_request, reply) => {
      const metrics = metricsCollector.getWorkerMetrics();
      sendSuccess(reply, {
        code: 'metrics.worker_fetched',
        message: 'Worker 指标查询成功',
        data: metrics,
      });
    });

    // 获取 HTTP 指标
    app.get('/http', async (_request, reply) => {
      const metrics = metricsCollector.getHttpMetrics();
      sendSuccess(reply, {
        code: 'metrics.http_fetched',
        message: 'HTTP 指标查询成功',
        data: metrics,
      });
    });

    // 获取指标历史
    app.get<{ Params: { metricName: string } }>('/history/:metricName', async (request, reply) => {
      const { metricName } = request.params;
      const history = metricsCollector.getMetricsHistory(metricName);
      
      sendSuccess(reply, {
        code: 'metrics.history_fetched',
        message: '指标历史查询成功',
        data: history,
      });
    });

    // 获取所有指标历史名称
    app.get('/history', async (_request, reply) => {
      const names = metricsCollector.getMetricHistoryNames();
      sendSuccess(reply, {
        code: 'metrics.history_names_fetched',
        message: '指标历史名称查询成功',
        data: { names },
      });
    });

    // 重置指标
    app.post('/reset', async (_request, reply) => {
      metricsCollector.reset();
      sendSuccess(reply, {
        code: 'metrics.reset',
        message: '指标已重置',
        data: null,
      });
    });

    // 获取告警规则列表
    app.get('/alerts/rules', async (_request, reply) => {
      const rules = alertRulesEngine.getAllRules();
      sendSuccess(reply, {
        code: 'alerts.rules_fetched',
        message: '告警规则查询成功',
        data: { rules },
      });
    });

    // 获取活跃告警
    app.get('/alerts/active', async (_request, reply) => {
      const alerts = alertRulesEngine.getActiveAlerts();
      sendSuccess(reply, {
        code: 'alerts.active_fetched',
        message: '活跃告警查询成功',
        data: { alerts },
      });
    });

    // 获取告警历史
    app.get<{ Querystring: { limit?: string } }>('/alerts/history', async (request, reply) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : undefined;
      const history = alertRulesEngine.getAlertHistory(limit);
      sendSuccess(reply, {
        code: 'alerts.history_fetched',
        message: '告警历史查询成功',
        data: { history },
      });
    });

    // 获取告警统计
    app.get('/alerts/stats', async (_request, reply) => {
      const counts = alertRulesEngine.getAlertCounts();
      sendSuccess(reply, {
        code: 'alerts.stats_fetched',
        message: '告警统计查询成功',
        data: counts,
      });
    });

    // 确认告警
    app.post<{ Body: { alertId: string; acknowledgedBy?: string } }>('/alerts/acknowledge', async (request, reply) => {
      const { alertId, acknowledgedBy } = request.body;
      const success = alertRulesEngine.acknowledgeAlert(alertId, acknowledgedBy);
      
      sendSuccess(reply, {
        code: success ? 'alerts.acknowledged' : 'alerts.acknowledge_failed',
        message: success ? '告警已确认' : '告警确认失败',
        data: { success },
      });
    });

    // 启用/禁用告警规则
    app.post<{ Body: { ruleId: string; enabled: boolean } }>('/alerts/rules/toggle', async (request, reply) => {
      const { ruleId, enabled } = request.body;
      
      if (enabled) {
        alertRulesEngine.enableRule(ruleId);
      } else {
        alertRulesEngine.disableRule(ruleId);
      }
      
      sendSuccess(reply, {
        code: 'alerts.rule_toggled',
        message: `告警规则 ${enabled ? '已启用' : '已禁用'}`,
        data: { ruleId, enabled },
      });
    });

    // 获取通知记录
    app.get('/notifications', async (_request, reply) => {
      const records = notificationService.getRecentRecords();
      sendSuccess(reply, {
        code: 'notifications.fetched',
        message: '通知记录查询成功',
        data: { records },
      });
    });

    // 获取通知统计
    app.get('/notifications/stats', async (_request, reply) => {
      const stats = notificationService.getStats();
      sendSuccess(reply, {
        code: 'notifications.stats_fetched',
        message: '通知统计查询成功',
        data: stats,
      });
    });
  };
}
