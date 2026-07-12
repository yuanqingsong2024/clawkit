/**
 * 插件生命周期服务
 * 管理插件的完整生命周期：注册、初始化、启动、运行、停止、卸载
 */
import { EventEmitter } from 'events';
import type { PluginMeta, PluginLifecycleState, PluginContext, PluginConfig } from '../types/plugin.types';
/**
 * 插件生命周期钩子
 */
export interface PluginLifecycleHooks {
    onBeforeInit?: (meta: PluginMeta) => void | Promise<void>;
    onAfterInit?: (meta: PluginMeta) => void | Promise<void>;
    onBeforeStart?: (meta: PluginMeta) => void | Promise<void>;
    onAfterStart?: (meta: PluginMeta) => void | Promise<void>;
    onBeforeStop?: (meta: PluginMeta) => void | Promise<void>;
    onAfterStop?: (meta: PluginMeta) => void | Promise<void>;
    onError?: (meta: PluginMeta, error: Error) => void | Promise<void>;
    onStateChange?: (meta: PluginMeta, oldState: PluginLifecycleState, newState: PluginLifecycleState) => void;
}
/**
 * 插件生命周期记录
 */
export interface PluginLifecycleRecord {
    /** 插件元信息 */
    meta: PluginMeta;
    /** 当前状态 */
    state: PluginLifecycleState;
    /** 插件配置 */
    config: PluginConfig;
    /** 插件上下文 */
    context: PluginContext;
    /** 插件实例 */
    instance?: unknown;
    /** 状态变更历史 */
    stateHistory: Array<{
        from: PluginLifecycleState;
        to: PluginLifecycleState;
        timestamp: number;
        reason?: string;
    }>;
    /** 创建时间 */
    createdAt: number;
    /** 最后更新时间 */
    updatedAt: number;
    /** 错误信息 */
    error?: string;
}
/**
 * 插件生命周期服务
 * 管理单个插件的生命周期状态转换
 */
export declare class PluginLifecycleService extends EventEmitter {
    private record;
    private hooks;
    /**
     * 创建插件生命周期服务
     * @param meta 插件元信息
     * @param config 插件配置
     * @param context 插件上下文
     * @param hooks 生命周期钩子
     */
    constructor(meta: PluginMeta, config: PluginConfig, context: PluginContext, hooks?: PluginLifecycleHooks);
    /**
     * 获取插件元信息
     */
    getMeta(): PluginMeta;
    /**
     * 获取插件配置
     */
    getConfig(): PluginConfig;
    /**
     * 获取插件上下文
     */
    getContext(): PluginContext;
    /**
     * 获取当前状态
     */
    getState(): PluginLifecycleState;
    /**
     * 获取生命周期记录
     */
    getRecord(): PluginLifecycleRecord;
    /**
     * 获取状态历史
     */
    getStateHistory(): PluginLifecycleRecord['stateHistory'];
    /**
     * 设置插件实例
     */
    setInstance(instance: unknown): void;
    /**
     * 获取插件实例
     */
    getInstance<T = unknown>(): T | undefined;
    /**
     * 检查是否可以转换到目标状态
     */
    canTransitionTo(targetState: PluginLifecycleState): boolean;
    /**
     * 获取可用的状态转换
     */
    getAvailableTransitions(): PluginLifecycleState[];
    /**
     * 转换到目标状态
     */
    transitionTo(targetState: PluginLifecycleState, reason?: string): Promise<void>;
    /**
     * 初始化插件
     */
    initialize(): Promise<void>;
    /**
     * 启动插件
     */
    start(): Promise<void>;
    /**
     * 停止插件
     */
    stop(): Promise<void>;
    /**
     * 卸载插件
     */
    unload(): Promise<void>;
    /**
     * 重启插件
     */
    restart(): Promise<void>;
    /**
     * 检查插件是否处于活跃状态
     */
    isActive(): boolean;
    /**
     * 检查插件是否已加载
     */
    isLoaded(): boolean;
    /**
     * 检查插件是否有错误
     */
    hasError(): boolean;
    /**
     * 获取插件运行时间（毫秒）
     */
    getUptime(): number;
}
/**
 * 批量生命周期管理
 */
export declare class PluginLifecycleManager {
    private services;
    /**
     * 注册插件生命周期服务
     */
    register(meta: PluginMeta, config: PluginConfig, context: PluginContext): PluginLifecycleService;
    /**
     * 获取插件生命周期服务
     */
    get(name: string): PluginLifecycleService | undefined;
    /**
     * 获取所有插件生命周期服务
     */
    getAll(): PluginLifecycleService[];
    /**
     * 获取处于特定状态的插件
     */
    getByState(state: PluginLifecycleState): PluginLifecycleService[];
    /**
     * 获取处于活跃状态的插件
     */
    getActivePlugins(): PluginLifecycleService[];
    /**
     * 获取有错误的插件
     */
    getErrorPlugins(): PluginLifecycleService[];
    /**
     * 移除插件生命周期服务
     */
    remove(name: string): void;
    /**
     * 批量启动插件
     */
    startAll(): Promise<void>;
    /**
     * 批量停止插件
     */
    stopAll(): Promise<void>;
    /**
     * 获取统计信息
     */
    getStats(): {
        total: number;
        active: number;
        stopped: number;
        error: number;
        byState: Record<PluginLifecycleState, number>;
    };
}
//# sourceMappingURL=plugin-lifecycle.service.d.ts.map