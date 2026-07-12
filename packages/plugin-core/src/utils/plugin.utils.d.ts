/**
 * 插件工具函数
 * 提供插件相关的常用工具函数
 */
import type { PluginMeta, PluginType, PluginLifecycleState } from '../types/plugin.types';
/**
 * 检查插件是否为指定类型
 */
export declare function isPluginOfType(meta: PluginMeta, type: PluginType): boolean;
/**
 * 检查插件是否为执行器类型
 */
export declare function isExecutorPlugin(meta: PluginMeta): boolean;
/**
 * 检查插件是否为触发器类型
 */
export declare function isTriggerPlugin(meta: PluginMeta): boolean;
/**
 * 检查插件是否为通知器类型
 */
export declare function isNotifierPlugin(meta: PluginMeta): boolean;
/**
 * 比较插件版本
 * @returns
 *   -1: v1 < v2
 *    0: v1 === v2
 *    1: v1 > v2
 */
export declare function compareVersions(v1: string, v2: string): -1 | 0 | 1;
/**
 * 检查插件版本是否兼容
 */
export declare function isVersionCompatible(pluginVersion: string, requiredVersion: string): boolean;
/**
 * 验证插件名称格式
 */
export declare function isValidPluginName(name: string): boolean;
/**
 * 规范化插件名称
 */
export declare function normalizePluginName(name: string): string;
/**
 * 获取插件类型的显示名称
 */
export declare function getPluginTypeDisplayName(type: PluginType): string;
/**
 * 获取生命周期状态的显示名称
 */
export declare function getLifecycleStateDisplayName(state: PluginLifecycleState): string;
/**
 * 判断插件是否处于终态
 */
export declare function isTerminalState(state: PluginLifecycleState): boolean;
/**
 * 判断插件是否可启动
 */
export declare function isStartable(state: PluginLifecycleState): boolean;
/**
 * 判断插件是否可停止
 */
export declare function isStoppable(state: PluginLifecycleState): boolean;
/**
 * 格式化插件信息
 */
export declare function formatPluginInfo(meta: PluginMeta): string;
/**
 * 生成插件唯一标识符
 */
export declare function generatePluginId(name: string, version: string): string;
/**
 * 解析插件标识符
 */
export declare function parsePluginId(id: string): {
    name: string;
    version: string;
} | null;
/**
 * 合并插件配置
 */
export declare function mergePluginConfig(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown>;
/**
 * 深拷贝插件配置
 */
export declare function deepCloneConfig<T extends Record<string, unknown>>(config: T): T;
/**
 * 过滤敏感配置项
 */
export declare function filterSensitiveConfig(config: Record<string, unknown>, sensitiveKeys?: string[]): Record<string, unknown>;
/**
 * 验证插件依赖
 */
export declare function validateDependencies(dependencies: string[], availablePlugins: Set<string>): {
    valid: boolean;
    missing: string[];
};
//# sourceMappingURL=plugin.utils.d.ts.map