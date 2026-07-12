/**
 * 接口模块导出
 * 定义插件系统的标准接口
 */

// 基础插件接口
export type {
  Plugin,
  PluginFactory,
  PluginRegistry,
} from './plugin.interface';

// 执行器插件接口
export type {
  ExecutorPlugin,
  ExecutorPluginMeta,
  ExecutorPluginConfig,
  ExecutorPluginRegistry,
  ExecutorPluginFactory,
} from './executor-plugin.interface';

// 触发器插件接口
export type {
  TriggerPlugin,
  TriggerPluginMeta,
  TriggerPluginConfig,
  TriggerAuthConfig,
  TriggerEventFilter,
  TriggerEvent,
  TriggerEventHandler,
  TriggerPluginRegistry,
  TriggerPluginFactory,
} from './trigger-plugin.interface';

// 通知器插件接口
export type {
  NotifierPlugin,
  NotifierPluginMeta,
  NotifierPluginConfig,
  NotifierDefaultOptions,
  NotificationType,
  NotificationPriority,
  NotificationTarget,
  NotificationContent,
  Notification,
  NotificationResult,
  NotifierPluginRegistry,
  NotifierPluginFactory,
} from './notifier-plugin.interface';
