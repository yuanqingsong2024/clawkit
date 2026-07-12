/**
 * 执行器插件接口
 * 定义任务执行器插件的标准接口
 */
import type { ExecutorMeta, ExecutorFactory, ExecutorFactoryConfig, TaskExecutor } from '@clawkit/shared';
import type { PluginMeta, PluginConfig, PluginContext, PluginValidationResult } from '../types/plugin.types';
/**
 * 执行器插件配置
 */
export interface ExecutorPluginConfig extends PluginConfig {
    /** 执行器类型 */
    executorType: string;
    /** 默认执行选项 */
    defaultOptions?: ExecutorDefaultOptions;
}
/**
 * 执行器默认选项
 */
export interface ExecutorDefaultOptions {
    /** 超时时间（毫秒） */
    timeout?: number;
    /** 工作目录 */
    cwd?: string;
    /** 环境变量 */
    env?: Record<string, string>;
    /** 最大重试次数 */
    maxRetries?: number;
}
/**
 * 执行器插件元信息
 */
export interface ExecutorPluginMeta extends PluginMeta {
    /** 插件类型固定为 'executor' */
    readonly type: 'executor';
    /** 执行器元信息 */
    readonly executorMeta: ExecutorMeta;
}
/**
 * 执行器插件接口
 */
export interface ExecutorPlugin {
    /** 插件元信息 */
    readonly meta: ExecutorPluginMeta;
    /**
     * 初始化插件
     * @param config 插件配置
     * @param context 插件上下文
     */
    initialize(config: ExecutorPluginConfig, context: PluginContext): Promise<void>;
    /**
     * 获取执行器工厂
     */
    getFactory(): ExecutorFactory;
    /**
     * 创建执行器实例
     * @param config 执行器配置
     */
    createExecutor(config: ExecutorFactoryConfig): TaskExecutor;
    /**
     * 验证配置
     * @param config 配置对象
     */
    validateConfig(config: Record<string, unknown>): PluginValidationResult;
    /**
     * 健康检查
     */
    healthCheck(): Promise<boolean>;
}
/**
 * 执行器插件工厂
 */
export interface ExecutorPluginFactory {
    /** 创建执行器插件实例 */
    create(config: ExecutorPluginConfig, context: PluginContext): Promise<ExecutorPlugin>;
    /** 获取插件元信息 */
    getMeta(): ExecutorPluginMeta;
    /** 验证插件配置 */
    validatePluginConfig(config: Record<string, unknown>): PluginValidationResult;
}
/**
 * 执行器插件注册器
 */
export interface ExecutorPluginRegistry {
    /** 注册执行器插件 */
    register(plugin: ExecutorPlugin): void;
    /** 注册执行器插件工厂 */
    registerFactory(factory: ExecutorPluginFactory): void;
    /** 获取执行器插件 */
    get(name: string): ExecutorPlugin | undefined;
    /** 检查执行器是否已注册 */
    has(name: string): boolean;
    /** 获取所有已注册的执行器名称 */
    getRegisteredNames(): string[];
    /** 获取所有执行器插件 */
    getAll(): ExecutorPlugin[];
    /** 获取执行器工厂 */
    getFactory(name: string): ExecutorFactory | undefined;
    /** 设置默认执行器 */
    setDefault(name: string): void;
    /** 获取默认执行器 */
    getDefault(): ExecutorPlugin | undefined;
}
//# sourceMappingURL=executor-plugin.interface.d.ts.map