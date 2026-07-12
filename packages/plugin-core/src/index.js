/**
 * ClawKit 插件系统核心模块
 * 提供插件管理、生命周期管理和加载能力
 */
// 类型定义
export * from './types/plugin.types';
// 服务
export { PluginLifecycleService, createLifecycleService, } from './services/plugin-lifecycle.service';
export { PluginManager, getPluginManager, setPluginManager, createPluginManager, } from './services/plugin-manager';
export { PluginLoader, createPluginLoader, loadPluginManifest, } from './services/plugin-loader';
//# sourceMappingURL=index.js.map