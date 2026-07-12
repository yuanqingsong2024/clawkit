/**
 * 监控与告警模块
 * 提供指标采集、告警规则、通知等功能
 */

// 导出所有公共接口和类
export { MetricsCollector } from './metrics-collector';
export type {
  TaskMetrics,
  SystemMetrics,
  WorkerMetrics,
  HttpMetrics,
  MetricsSnapshot,
  MetricsDataPoint,
  MetricsHistory,
  MetricsCollectorConfig,
} from './metrics-collector';

export { AlertRulesEngine, AlertLevel, AlertStatus } from './alert-rules';
export type {
  AlertConditionType,
  ComparisonOperator,
  AlertCondition,
  AlertRule,
  Alert,
  AlertEvent,
  AlertRulesConfig,
} from './alert-rules';

export { AlertNotificationService, NotificationChannel } from './alert-notifiers';
export type {
  NotificationConfig,
  WebhookNotificationConfig,
  EmailNotificationConfig,
  DingtalkNotificationConfig,
  LarkNotificationConfig,
  SlackNotificationConfig,
  NotificationRecord,
  AlertNotifier,
} from './alert-notifiers';
