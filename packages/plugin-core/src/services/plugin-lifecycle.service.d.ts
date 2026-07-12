/**
 * 插件生命周期服务
 * 管理插件的初始化、启动、停止等生命周期状态
 */
import { EventEmitter } from 'events';
import type { PluginLifecycleState, PluginMeta, PluginContext, PluginStats } from '../types/plugin.types';
/**
 * 生命周期状态转换事件
 */
export interface LifecycleTransitionEvent {
    pluginId: string;
    from: PluginLifecycleState;
    to: PluginLifecycleState;
    timestamp: number;
}
/**
 * 生命周期钩子接口
 */
export interface LifecycleHooks {
    onBeforeInitialize?: () => Promise<void>;
    onAfterInitialize?: () => Promise<void>;
    onBeforeStart?: () => Promise<void>;
    onAfterStart?: () => Promise<void>;
    onBeforeStop?: () => Promise<void>;
    onAfterStop?: () => Promise<void>;
    onError?: (error: Error) => Promise<void>;
    onStateChange?: (from: PluginLifecycleState, to: PluginLifecycleState) => Promise<void>;
}
/**
 * 插件生命周期服务
 * 负责管理单个插件的生命周期状态转换
 */
export declare class PluginLifecycleService extends EventEmitter {
    private readonly pluginId;
    private readonly pluginMeta;
    private readonly pluginContext;
    private state;
    private hooks;
    private stateHistory;
    private error;
    constructor(pluginId: string, pluginMeta: PluginMeta, pluginContext: PluginContext);
    /**
     * 获取当前状态
     */
    getState(): PluginLifecycleState;
    /**
     * 获取插件 ID
     */
    getPluginId(): string;
    /**
     * 获取插件元信息
     */
    getMeta(): PluginMeta;
    /**
     * 获取插件上下文
     */
    getContext(): PluginContext;
    /**
     * 获取插件统计信息
     */
    getStats(): PluginStats;
    /**
     * 获取启动时间
     */
    private getStartTime;
    /**
     * 获取状态历史
     */
    getStateHistory(): Array<{
        state: PluginLifecycleState;
        timestamp: number;
    }>;
    /**
     * 获取错误
     */
    getError(): Error | undefined;
    /**
     * 设置生命周期钩子
     */
    setHooks(hooks: LifecycleHooks): void;
    /**
     * 状态转换验证
     */
    private canTransitionTo;
    /**
     * 执行状态转换
     */
    private transitionTo;
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
     * 从错误状态恢复
     */
    recover(): Promise<void>;
    /**
     * 检查插件是否可执行
     */
    isExecutable(): boolean;
    /**
     * 检查插件是否已加载
     */
    isLoaded(): boolean;
    /**
     * 检查插件是否有错误
     */
    hasError(): boolean;
}
/**
 * 创建插件生命周期服务
 */
export declare function createLifecycleService(pluginId: string, pluginMeta: PluginMeta, pluginContext: PluginContext): PluginLifecycleService;
//# sourceMappingURL=plugin-lifecycle.service.d.ts.map