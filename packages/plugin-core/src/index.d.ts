/**
 * ClawKit 插件系统核心模块
 * 提供插件的发现、加载、生命周期管理和调度能力
 */
export type { PluginType, PluginLifecycleState, PluginMeta, PluginConfig, PluginContext, PluginSource, PluginLoadResult, PluginValidationResult, PluginEvent, PluginSandboxConfig, PluginStats, } from './types/plugin.types';
export type { Plugin, PluginFactory, PluginRegistry, } from './interfaces/plugin.interface';
export type { ExecutorPlugin, ExecutorPluginMeta, ExecutorPluginConfig, ExecutorPluginRegistry, ExecutorPluginFactory, } from './interfaces/executor-plugin.interface';
export type { TriggerPlugin, TriggerPluginMeta, TriggerPluginConfig, TriggerPluginRegistry, TriggerPluginFactory, } from './interfaces/trigger-plugin.interface';
export type { NotifierPlugin, NotifierPluginMeta, NotifierPluginConfig, Notification, NotificationContent, NotificationTarget, NotificationType, NotificationPriority, NotificationResult, NotifierPluginRegistry, NotifierPluginFactory, } from './interfaces/notifier-plugin.interface';
export { PluginManager, createPluginManager, getPluginManager, setPluginManager, type PluginManagerOptions, type PluginStatus, type PluginManagerEvent, } from './services/plugin-manager';
export { DefaultPluginLoader, createPluginLoader, type PluginDiscoveryOptions, type PluginLoadOptions, } from './services/plugin-loader';
export { PluginLifecycleService, PluginLifecycleManager, type PluginLifecycleHooks, type PluginLifecycleRecord, } from './services/plugin-lifecycle.service';
import * as pluginUtils from './utils/plugin.utils';
export { pluginUtils };
export { PluginManager as default } from './services/plugin-manager';
//# sourceMappingURL=index.d.ts.map