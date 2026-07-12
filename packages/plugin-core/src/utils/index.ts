/**
 * 工具函数模块导出
 */

export {
  isPluginOfType,
  isExecutorPlugin,
  isTriggerPlugin,
  isNotifierPlugin,
  compareVersions,
  isVersionCompatible,
  isValidPluginName,
  normalizePluginName,
  getPluginTypeDisplayName,
  getLifecycleStateDisplayName,
  isTerminalState,
  isStartable,
  isStoppable,
  formatPluginInfo,
  generatePluginId,
  parsePluginId,
  mergePluginConfig,
  deepCloneConfig,
  filterSensitiveConfig,
  validateDependencies,
} from './plugin.utils';
