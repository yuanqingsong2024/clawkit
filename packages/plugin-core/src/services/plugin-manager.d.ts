/**
 * 插件管理器
 * 统一管理所有类型插件的注册、加载和生命周期
 */
import { EventEmitter } from 'events';
import { PluginLifecycleService, type LifecycleHooks } from './plugin-lifecycle.service';
import type { PluginType, PluginLifecycleState, PluginMeta, PluginContext, PluginConfig, PluginStats, PluginLoadResult, PluginSandboxConfig } from '../types/plugin.types';
import type { ExecutorPlugin, ExecutorPluginRegistry } from '../interfaces/executor-plugin.interface';
import type { TriggerPlugin, TriggerPluginRegistry } from '../interfaces/trigger-plugin.interface';
import type { NotifierPlugin, NotifierPluginRegistry } from '../interfaces/notifier-plugin.interface';
/**
 * 插件注册信息
 */
export interface PluginRegistration {
    pluginId: string;
    type: PluginType;
    name: string;
    version: string;
    meta: PluginMeta;
    instance?: ExecutorPlugin | TriggerPlugin | NotifierPlugin;
    lifecycle: PluginLifecycleService;
    config: PluginConfig;
    enabled: boolean;
}
/**
 * 插件管理器选项
 */
export interface PluginManagerOptions {
    /** 默认数据目录 */
    defaultDataDir?: string;
    /** 默认日志目录 */
    defaultLogDir?: string;
    /** 插件沙箱配置 */
    sandbox?: PluginSandboxConfig;
    /** 生命周期钩子 */
    hooks?: Record<string, LifecycleHooks>;
}
/**
 * 插件管理器
 * 管理所有插件的注册、加载、卸载和生命周期
 */
export declare class PluginManager extends EventEmitter {
    private plugins;
    private options;
    private executorRegistry;
    private triggerRegistry;
    private notifierRegistry;
    constructor(options?: PluginManagerOptions);
    /**
     * 获取默认沙箱配置
     */
    private getDefaultSandboxConfig;
    /**
     * 创建执行器注册表
     */
    private createExecutorRegistry;
    /**
     * 创建触发器注册表
     */
    private createTriggerRegistry;
    /**
     * 创建通知器注册表
     */
    private createNotifierRegistry;
    /**
     * 注册插件
     */
    register(type: PluginType, name: string, version: string, config: PluginConfig, context?: Partial<PluginContext>): PluginLoadResult;
    /**
     * 加载插件
     */
    load(pluginId: string): Promise<PluginLoadResult>;
    /**
     * 启动插件
     */
    start(pluginId: string): Promise<PluginLoadResult>;
    /**
     * 停止插件
     */
    stop(pluginId: string): Promise<PluginLoadResult>;
    /**
     * 卸载插件
     */
    unload(pluginId: string): Promise<PluginLoadResult>;
    /**
     * 获取插件
     */
    get(pluginId: string): PluginRegistration | undefined;
    /**
     * 获取插件元信息
     */
    getMeta(pluginId: string): PluginMeta | undefined;
    /**
     * 获取插件生命周期服务
     */
    getLifecycle(pluginId: string): PluginLifecycleService | undefined;
    /**
     * 获取插件状态
     */
    getState(pluginId: string): PluginLifecycleState | undefined;
    /**
     * 获取插件统计信息
     */
    getStats(pluginId: string): PluginStats | undefined;
    /**
     * 获取所有已注册的插件
     */
    getAllPlugins(): PluginMeta[];
    /**
     * 按类型获取插件
     */
    getPluginsByType(type: PluginType): PluginMeta[];
    /**
     * 获取所有插件的统计信息
     */
    getAllStats(): PluginStats[];
    /**
     * 获取执行器注册表
     */
    getExecutorRegistry(): ExecutorPluginRegistry;
    /**
     * 获取触发器注册表
     */
    getTriggerRegistry(): TriggerPluginRegistry;
    /**
     * 获取通知器注册表
     */
    getNotifierRegistry(): NotifierPluginRegistry;
    /**
     * 检查插件是否存在
     */
    has(pluginId: string): boolean;
    /**
     * 批量加载插件
     */
    loadAll(): Promise<PluginLoadResult[]>;
    /**
     * 批量启动插件
     */
    startAll(): Promise<PluginLoadResult[]>;
    /**
     * 批量停止插件
     */
    stopAll(): Promise<PluginLoadResult[]>;
    /**
     * 获取运行中的插件数量
     */
    getRunningCount(): number;
    /**
     * 获取错误状态的插件
     */
    getErrorPlugins(): PluginStats[];
    /**
     * 设置生命周期钩子
     */
    setHooks(pluginId: string, hooks: LifecycleHooks): void;
    /**
     * 清理所有插件
     */
    clear(): Promise<void>;
}
/**
 * 获取全局插件管理器
 */
export declare function getPluginManager(): PluginManager;
/**
 * 设置全局插件管理器
 */
export declare function setPluginManager(manager: PluginManager): void;
/**
 * 创建新的插件管理器
 */
export declare function createPluginManager(options?: PluginManagerOptions): PluginManager;
//# sourceMappingURL=plugin-manager.d.ts.map