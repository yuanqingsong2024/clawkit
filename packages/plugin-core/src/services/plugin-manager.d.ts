/**
 * 插件管理器
 * 插件系统的核心组件，负责插件的注册、加载、生命周期管理和调度
 */
import { EventEmitter } from 'events';
import type { PluginMeta, PluginType, PluginConfig, PluginContext, PluginSource, PluginLoadResult, PluginValidationResult, PluginStats, PluginSandboxConfig } from '../types/plugin.types';
import { PluginLifecycleManager } from './plugin-lifecycle.service';
import { DefaultPluginLoader, type PluginDiscoveryOptions } from './plugin-loader';
/**
 * 插件管理器选项
 */
export interface PluginManagerOptions {
    /** 插件目录 */
    pluginDir?: string;
    /** 数据目录 */
    dataDir?: string;
    /** 插件配置目录 */
    configDir?: string;
    /** 是否启用热更新 */
    enableHotReload?: boolean;
    /** 沙箱配置 */
    sandbox?: PluginSandboxConfig;
    /** 自动加载内置插件 */
    autoLoadBuiltin?: boolean;
    /** 插件加载优先级 */
    loadPriority?: ('executor' | 'trigger' | 'notifier')[];
}
/**
 * 插件状态信息
 */
export interface PluginStatus {
    /** 插件元信息 */
    meta: PluginMeta;
    /** 插件配置 */
    config: PluginConfig;
    /** 当前状态 */
    state: string;
    /** 是否已加载 */
    loaded: boolean;
    /** 是否活跃 */
    active: boolean;
    /** 是否启用 */
    enabled: boolean;
    /** 加载时间 */
    loadedAt?: number;
    /** 错误信息 */
    error?: string;
    /** 运行时间（毫秒） */
    uptime?: number;
}
/**
 * 插件管理器事件
 */
export type PluginManagerEvent = 'plugin:discovered' | 'plugin:loaded' | 'plugin:unloaded' | 'plugin:enabled' | 'plugin:disabled' | 'plugin:error' | 'plugin:stateChange';
/**
 * 插件管理器
 * 统一管理所有类型的插件
 */
export declare class PluginManager extends EventEmitter {
    private options;
    private lifecycleManager;
    private loader;
    private pluginConfigs;
    private pluginInstances;
    constructor(options?: PluginManagerOptions);
    /**
     * 确保必要目录存在
     */
    private ensureDirectories;
    /**
     * 设置生命周期事件监听
     */
    private setupLifecycleEvents;
    /**
     * 设置热更新事件监听
     */
    private setupHotReloadEvents;
    /**
     * 创建插件上下文
     */
    createContext(pluginMeta: PluginMeta): PluginContext;
    /**
     * 发现插件
     */
    discoverPlugins(options?: PluginDiscoveryOptions): Promise<PluginMeta[]>;
    /**
     * 加载插件
     */
    loadPlugin(source: PluginSource, config?: PluginConfig, meta?: PluginMeta): Promise<PluginLoadResult>;
    /**
     * 从来源获取插件元信息
     */
    private getPluginMetaFromSource;
    /**
     * 卸载插件
     */
    unloadPlugin(name: string): Promise<void>;
    /**
     * 重新加载插件
     */
    reloadPlugin(name: string): Promise<PluginLoadResult>;
    /**
     * 启用插件
     */
    enablePlugin(name: string): Promise<void>;
    /**
     * 禁用插件
     */
    disablePlugin(name: string): Promise<void>;
    /**
     * 验证插件
     */
    validatePlugin(meta: PluginMeta): Promise<PluginValidationResult>;
    /**
     * 获取插件状态
     */
    getPluginStatus(name: string): PluginStatus | null;
    /**
     * 获取所有插件状态
     */
    getAllPluginStatus(): PluginStatus[];
    /**
     * 获取指定类型的插件
     */
    getPluginsByType(type: PluginType): PluginStatus[];
    /**
     * 获取插件实例
     */
    getPlugin<T = unknown>(name: string): T | undefined;
    /**
     * 检查插件是否存在
     */
    hasPlugin(name: string): boolean;
    /**
     * 检查插件是否已加载
     */
    isPluginLoaded(name: string): boolean;
    /**
     * 获取插件元信息
     */
    getPluginMeta(name: string): PluginMeta | undefined;
    /**
     * 获取插件配置
     */
    getPluginConfig(name: string): PluginConfig | undefined;
    /**
     * 获取插件统计信息
     */
    getStats(): PluginStats;
    /**
     * 启动所有插件
     */
    startAll(): Promise<void>;
    /**
     * 停止所有插件
     */
    stopAll(): Promise<void>;
    /**
     * 加载所有已配置的插件
     */
    loadConfiguredPlugins(): Promise<void>;
    /**
     * 保存插件配置
     */
    savePluginConfig(name: string): void;
    /**
     * 获取插件加载器
     */
    getLoader(): DefaultPluginLoader;
    /**
     * 获取生命周期管理器
     */
    getLifecycleManager(): PluginLifecycleManager;
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
 * 创建插件管理器
 */
export declare function createPluginManager(options?: PluginManagerOptions): PluginManager;
//# sourceMappingURL=plugin-manager.d.ts.map