/**
 * 插件加载器
 * 负责从文件系统或其他来源加载插件
 */
import type { PluginLoadResult, PluginMeta, PluginConfig, PluginContext, PluginType } from '../types/plugin.types';
import type { PluginManager } from './plugin-manager';
/**
 * 插件发现结果
 */
export interface DiscoveredPlugin {
    /** 插件路径 */
    path: string;
    /** 插件元信息 */
    meta: PluginMeta;
    /** 插件配置 */
    config: PluginConfig;
}
/**
 * 插件加载器选项
 */
export interface PluginLoaderOptions {
    /** 插件目录 */
    pluginDir?: string;
    /** 插件目录列表 */
    pluginDirs?: string[];
    /** 是否递归扫描子目录 */
    recursive?: boolean;
    /** 插件配置文件名 */
    configFileName?: string;
    /** 允许的插件类型 */
    allowedTypes?: PluginType[];
    /** 插件过滤器 */
    filter?: (meta: PluginMeta) => boolean;
}
/**
 * 插件加载器
 * 负责发现和加载插件
 */
export declare class PluginLoader {
    private options;
    private loadedPlugins;
    constructor(options?: PluginLoaderOptions);
    /**
     * 发现插件目录中的所有插件
     */
    discover(): Promise<DiscoveredPlugin[]>;
    /**
     * 在指定目录中发现插件
     */
    private discoverInDir;
    /**
     * 加载插件配置文件
     */
    private loadPluginConfig;
    /**
     * 加载插件模块
     */
    loadModule(pluginPath: string): Promise<unknown>;
    /**
     * 注册并加载发现的插件
     */
    registerDiscoveredPlugins(manager: PluginManager, context?: Partial<PluginContext>): Promise<PluginLoadResult[]>;
    /**
     * 从 package.json 发现 workspace 插件
     */
    discoverWorkspacePlugins(workspaceRoot: string): Promise<DiscoveredPlugin[]>;
    /**
     * 推断插件类型
     */
    private inferPluginType;
    /**
     * 验证插件路径安全性
     */
    validatePath(pluginPath: string, allowedPaths: string[]): Promise<boolean>;
    /**
     * 获取已加载的插件模块
     */
    getLoadedModule(pluginPath: string): unknown;
    /**
     * 清除加载缓存
     */
    clearCache(): void;
}
/**
 * 创建插件加载器
 */
export declare function createPluginLoader(options?: PluginLoaderOptions): PluginLoader;
/**
 * 从配置文件加载插件列表
 */
export declare function loadPluginManifest(manifestPath: string): Promise<DiscoveredPlugin[]>;
//# sourceMappingURL=plugin-loader.d.ts.map