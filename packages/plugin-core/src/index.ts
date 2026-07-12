/**
 * ClawKit 插件系统核心模块
 * 提供插件管理、生命周期管理和加载能力
 */

// 类型定义
export * from './types/plugin.types';

// 插件接口
export {
  type ExecutorPlugin,
  type ExecutorPluginConfig,
  type ExecutorPluginMeta,
  type ExecutorPluginFactory,
  type ExecutorPluginRegistry,
  type ExecutorDefaultOptions,
} from './interfaces/executor-plugin.interface';

// 从 @clawkit/shared 重新导出执行器相关类型
export type {
  ExecutorFactory,
  ExecutorFactoryConfig,
  TaskExecutor,
  ExecutorMeta,
} from '@clawkit/shared';

export {
  type TriggerPlugin,
  type TriggerPluginConfig,
  type TriggerPluginMeta,
  type TriggerPluginFactory,
  type TriggerPluginRegistry,
  type TriggerEvent,
  type TriggerEventHandler,
  type TriggerAuthConfig,
  type TriggerEventFilter,
} from './interfaces/trigger-plugin.interface';

// 从 @clawkit/shared 重新导出触发器相关类型
export type {
  TriggerAdapter,
  ParsedTriggerRequest,
  TriggerMeta,
} from '@clawkit/shared';

export {
  type NotifierPlugin,
  type NotifierPluginConfig,
  type NotifierPluginMeta,
  type NotifierPluginFactory,
  type NotifierPluginRegistry,
  type Notification,
  type NotificationResult,
  type NotificationType,
  type NotificationPriority,
  type NotificationTarget,
  type NotificationContent,
  type NotifierDefaultOptions,
} from './interfaces/notifier-plugin.interface';

// 服务
export {
  PluginLifecycleService,
  createLifecycleService,
} from './services/plugin-lifecycle.service';
export type {
  LifecycleHooks,
  LifecycleTransitionEvent,
} from './services/plugin-lifecycle.service';

export {
  PluginManager,
  getPluginManager,
  setPluginManager,
  createPluginManager,
} from './services/plugin-manager';
export type {
  PluginManagerOptions,
  PluginRegistration,
} from './services/plugin-manager';

export {
  PluginLoader,
  createPluginLoader,
  loadPluginManifest,
} from './services/plugin-loader';
export type {
  PluginLoaderOptions,
  DiscoveredPlugin,
} from './services/plugin-loader';
