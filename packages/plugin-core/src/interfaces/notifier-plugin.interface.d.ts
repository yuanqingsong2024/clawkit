/**
 * 通知器插件接口
 * 定义任务通知器插件的标准接口
 */
import type { PluginMeta, PluginConfig, PluginContext, PluginValidationResult } from '../types/plugin.types';
/**
 * 通知器插件配置
 */
export interface NotifierPluginConfig extends PluginConfig {
    /** 通知器类型 */
    notifierType: string;
    /** 默认通知选项 */
    defaultOptions?: NotifierDefaultOptions;
}
/**
 * 通知器默认选项
 */
export interface NotifierDefaultOptions {
    /** 超时时间（毫秒） */
    timeout?: number;
    /** 重试次数 */
    retries?: number;
    /** 格式化模板 */
    template?: string;
}
/**
 * 通知器类型
 */
export type NotificationType = 'task_created' | 'task_approved' | 'task_rejected' | 'task_started' | 'task_completed' | 'task_failed' | 'task_cancelled' | 'task_progress' | 'system_alert' | 'custom';
/**
 * 通知优先级
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
/**
 * 通知目标
 */
export interface NotificationTarget {
    /** 目标类型 */
    type: 'user' | 'group' | 'channel' | 'email' | 'webhook' | 'broadcast';
    /** 目标标识 */
    id: string;
    /** 目标名称 */
    name?: string;
}
/**
 * 通知内容
 */
export interface NotificationContent {
    /** 标题 */
    title: string;
    /** 正文 */
    body: string;
    /** 摘要 */
    summary?: string;
    /** 详情链接 */
    url?: string;
    /** 图片 URL */
    imageUrl?: string;
    /** 额外数据 */
    metadata?: Record<string, unknown>;
}
/**
 * 通知消息
 */
export interface Notification {
    /** 通知 ID */
    id: string;
    /** 通知类型 */
    type: NotificationType;
    /** 优先级 */
    priority: NotificationPriority;
    /** 通知内容 */
    content: NotificationContent;
    /** 通知目标 */
    target: NotificationTarget;
    /** 任务 ID（如果有） */
    taskId?: string;
    /** 项目标识 */
    projectKey?: string;
    /** 时间戳 */
    timestamp: number;
    /** 过期时间 */
    expiresAt?: number;
}
/**
 * 通知结果
 */
export interface NotificationResult {
    /** 是否成功 */
    success: boolean;
    /** 通知 ID */
    notificationId?: string;
    /** 错误信息 */
    error?: string;
    /** 详细结果 */
    details?: Record<string, unknown>;
}
/**
 * 通知器插件元信息
 */
export interface NotifierPluginMeta extends PluginMeta {
    /** 插件类型固定为 'notifier' */
    readonly type: 'notifier';
    /** 支持的通知类型列表 */
    readonly supportedTypes: NotificationType[];
    /** 支持的目标类型列表 */
    readonly supportedTargets: NotificationTarget['type'][];
}
/**
 * 通知器插件接口
 */
export interface NotifierPlugin {
    /** 插件元信息 */
    readonly meta: NotifierPluginMeta;
    /**
     * 初始化插件
     * @param config 插件配置
     * @param context 插件上下文
     */
    initialize(config: NotifierPluginConfig, context: PluginContext): Promise<void>;
    /**
     * 发送通知
     * @param notification 通知消息
     */
    send(notification: Notification): Promise<NotificationResult>;
    /**
     * 批量发送通知
     * @param notifications 通知消息列表
     */
    sendBatch(notifications: Notification[]): Promise<NotificationResult[]>;
    /**
     * 发送测试通知
     * @param target 测试目标
     */
    sendTest(target: NotificationTarget): Promise<NotificationResult>;
    /**
     * 验证配置
     * @param config 配置对象
     */
    validateConfig(config: Record<string, unknown>): PluginValidationResult;
    /**
     * 检查是否支持特定通知类型
     * @param type 通知类型
     */
    supportsType(type: NotificationType): boolean;
    /**
     * 检查是否支持特定目标类型
     * @param targetType 目标类型
     */
    supportsTarget(targetType: NotificationTarget['type']): boolean;
    /**
     * 健康检查
     */
    healthCheck(): Promise<boolean>;
}
/**
 * 通知器插件工厂
 */
export interface NotifierPluginFactory {
    /** 创建通知器插件实例 */
    create(config: NotifierPluginConfig, context: PluginContext): Promise<NotifierPlugin>;
    /** 获取插件元信息 */
    getMeta(): NotifierPluginMeta;
    /** 验证插件配置 */
    validatePluginConfig(config: Record<string, unknown>): PluginValidationResult;
}
/**
 * 通知器插件注册器
 */
export interface NotifierPluginRegistry {
    /** 注册通知器插件 */
    register(plugin: NotifierPlugin): void;
    /** 注册通知器插件工厂 */
    registerFactory(factory: NotifierPluginFactory): void;
    /** 获取通知器插件 */
    get(name: string): NotifierPlugin | undefined;
    /** 检查通知器是否已注册 */
    has(name: string): boolean;
    /** 获取所有已注册的通知器名称 */
    getRegisteredNames(): string[];
    /** 获取所有通知器插件 */
    getAll(): NotifierPlugin[];
    /** 设置默认通知器 */
    setDefault(name: string): void;
    /** 获取默认通知器 */
    getDefault(): NotifierPlugin | undefined;
    /** 发送通知到指定通知器 */
    send(name: string, notification: Notification): Promise<NotificationResult>;
    /** 广播通知到所有通知器 */
    broadcast(notification: Notification): Promise<Map<string, NotificationResult>>;
}
//# sourceMappingURL=notifier-plugin.interface.d.ts.map