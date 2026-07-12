/**
 * 插件加载器
 * 负责插件的发现、加载、验证和初始化
 */
import { EventEmitter } from 'events';
import type { PluginMeta, PluginConfig, PluginContext, PluginSource, PluginLoadResult, PluginValidationResult, PluginSandboxConfig } from '../types/plugin.types';
import type { PluginLifecycleService } from './plugin-lifecycle.service';
/**
 * 插件发现配置
 */
export interface PluginDiscoveryOptions {
    /** 插件搜索路径 */
    paths?: string[];
    /** 插件类型过滤 */
    types?: ('executor' | 'trigger' | 'notifier')[];
    /** 是否递归搜索子目录 */
    recursive?: boolean;
    /** 插件文件模式 */
    filePattern?: RegExp;
    /** 是否加载内置插件 */
    includeBuiltin?: boolean;
}
/**
 * 插件加载配置
 */
export interface PluginLoadOptions {
    /** 插件来源 */
    source: PluginSource;
    /** 插件配置 */
    config?: PluginConfig;
    /** 插件上下文 */
    context: PluginContext;
    /** 沙箱配置 */
    sandbox?: PluginSandboxConfig;
    /** 是否启用热更新 */
    hotReload?: boolean;
    /** 依赖的其他插件 */
    dependencies?: string[];
    /** 优先级（数字越大优先级越高） */
    priority?: number;
}
/**
 * 插件加载器接口
 */
export interface PluginLoader {
    /**
     * 发现可用插件
     */
    discover(options?: PluginDiscoveryOptions): Promise<PluginMeta[]>;
    /**
     * 加载插件
     */
    load(options: PluginLoadOptions): Promise<PluginLoadResult>;
    /**
     * 卸载插件
     */
    unload(name: string): Promise<void>;
    /**
     * 重新加载插件
     */
    reload(name: string): Promise<PluginLoadResult>;
    /**
     * 验证插件
     */
    validate(meta: PluginMeta): Promise<PluginValidationResult>;
}
/**
 * 默认插件加载器
 */
export declare class DefaultPluginLoader extends EventEmitter implements PluginLoader {
    private loadedPlugins;
    private discoveryOptions;
    private hotReloadWatchers;
    private sandbox;
    constructor(options?: PluginDiscoveryOptions);
    /**
     * 设置沙箱配置
     */
    setSandbox(config: PluginSandboxConfig): void;
    /**
     * 获取沙箱配置
     */
    getSandbox(): PluginSandboxConfig | undefined;
    /**
     * 发现可用插件
     */
    discover(options?: PluginDiscoveryOptions): Promise<PluginMeta[]>;
    /**
     * 在目录中搜索插件
     */
    private searchDirectory;
    /**
     * 加载插件元信息
     */
    private loadPluginMeta;
    /**
     * 检查插件类型是否匹配
     */
    private matchType;
    /**
     * 加载插件
     */
    load(options: PluginLoadOptions): Promise<PluginLoadResult>;
    /**
     * 加载内置插件
     */
    private loadBuiltinPlugin;
    /**
     * 加载 npm 包插件
     */
    private loadNpmPlugin;
    /**
     * 加载本地插件
     */
    private loadLocalPlugin;
    /**
     * 加载远程插件
     */
    private loadRemotePlugin;
    /**
     * 设置热更新监视
     */
    private setupHotReload;
    /**
     * 卸载插件
     */
    unload(name: string): Promise<void>;
    /**
     * 重新加载插件
     */
    reload(name: string): Promise<PluginLoadResult>;
    /**
     * 验证插件
     */
    validate(meta: PluginMeta): Promise<PluginValidationResult>;
    /**
     * 获取已加载的插件
     */
    getLoadedPlugins(): Map<string, {
        meta: PluginMeta;
        config: PluginConfig;
    }>;
    /**
     * 检查插件是否已加载
     */
    isLoaded(name: string): boolean;
    /**
     * 获取插件实例
     */
    getPluginInstance<T = unknown>(name: string): T | undefined;
    /**
     * 设置插件生命周期服务
     */
    setLifecycle(name: string, lifecycle: PluginLifecycleService): void;
    /**
     * 获取插件生命周期服务
     */
    getLifecycle(name: string): PluginLifecycleService | undefined;
}
/**
 * 创建插件加载器实例
 */
export declare function createPluginLoader(options?: PluginDiscoveryOptions): PluginLoader;
//# sourceMappingURL=plugin-loader.d.ts.map