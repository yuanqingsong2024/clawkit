/**
 * 插件注册表服务
 * 负责管理本地已安装插件的注册和查询
 */
import type { PluginConfig } from '../types/market.types';
import type { MarketEntry } from '../types/market.types';
/** 插件类型 */
export type PluginType = 'executor' | 'trigger' | 'notifier';
/**
 * 已安装插件信息
 */
export interface InstalledPlugin {
    /** 插件唯一标识 */
    id: string;
    /** 插件名称 */
    name: string;
    /** 插件类型 */
    type: PluginType;
    /** 插件版本 */
    version: string;
    /** 插件描述 */
    description?: string;
    /** 安装路径 */
    installPath: string;
    /** 插件状态 */
    status: PluginStatus;
    /** 启用状态 */
    enabled: boolean;
    /** 插件配置 */
    config?: PluginConfig;
    /** 安装时间 */
    installedAt: number;
    /** 最后更新时间 */
    updatedAt: number;
    /** 依赖列表 */
    dependencies: string[];
    /** 原始市场条目 */
    marketEntry?: MarketEntry;
}
/**
 * 插件状态
 */
export type PluginStatus = 'installed' | 'updating' | 'uninstalling' | 'error';
/**
 * 插件注册表
 */
export interface PluginRegistry {
    /** 注册插件 */
    register(plugin: InstalledPlugin): void;
    /** 注销插件 */
    unregister(id: string): boolean;
    /** 获取插件 */
    get(id: string): InstalledPlugin | undefined;
    /** 检查插件是否已注册 */
    has(id: string): boolean;
    /** 获取所有已注册的插件 */
    getAll(): InstalledPlugin[];
    /** 按类型获取插件 */
    getByType(type: PluginType): InstalledPlugin[];
    /** 获取已启用的插件 */
    getEnabled(): InstalledPlugin[];
    /** 更新插件状态 */
    updateStatus(id: string, status: PluginStatus): void;
    /** 启用插件 */
    enable(id: string): boolean;
    /** 禁用插件 */
    disable(id: string): boolean;
    /** 更新插件配置 */
    updateConfig(id: string, config: PluginConfig): void;
    /** 获取插件数量 */
    size(): number;
}
/**
 * 默认插件注册表实现
 */
export declare class DefaultPluginRegistry implements PluginRegistry {
    private readonly plugins;
    register(plugin: InstalledPlugin): void;
    unregister(id: string): boolean;
    get(id: string): InstalledPlugin | undefined;
    has(id: string): boolean;
    getAll(): InstalledPlugin[];
    getByType(type: PluginType): InstalledPlugin[];
    getEnabled(): InstalledPlugin[];
    updateStatus(id: string, status: PluginStatus): void;
    enable(id: string): boolean;
    disable(id: string): boolean;
    updateConfig(id: string, config: PluginConfig): void;
    size(): number;
}
/**
 * 获取全局插件注册表
 */
export declare function getPluginRegistry(): DefaultPluginRegistry;
/**
 * 设置全局插件注册表
 */
export declare function setPluginRegistry(registry: DefaultPluginRegistry): void;
//# sourceMappingURL=plugin-registry.service.d.ts.map