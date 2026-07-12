/**
 * 触发器插件接口
 * 定义任务触发器插件的标准接口
 */

import type { TriggerMeta, TriggerAdapter, ParsedTriggerRequest, ValidationResult } from '@clawkit/shared';
import type { PluginMeta, PluginConfig, PluginContext, PluginValidationResult } from '../types/plugin.types';

/**
 * 触发器插件配置
 */
export interface TriggerPluginConfig extends PluginConfig {
  /** 触发器类型 */
  triggerType: string;
  /** Webhook 路径前缀 */
  webhookPath?: string;
  /** 认证配置 */
  auth?: TriggerAuthConfig;
  /** 事件过滤配置 */
  eventFilter?: TriggerEventFilter;
}

/**
 * 触发器认证配置
 */
export interface TriggerAuthConfig {
  /** 认证类型 */
  type: 'none' | 'token' | 'basic' | 'bearer' | 'signature';
  /** Token 或密钥 */
  secret?: string;
  /** 签名算法 */
  signatureAlgorithm?: 'sha256' | 'sha512';
  /** 签名头名 */
  signatureHeader?: string;
}

/**
 * 触发器事件过滤器
 */
export interface TriggerEventFilter {
  /** 允许的事件类型 */
  allowedEvents?: string[];
  /** 拒绝的事件类型 */
  deniedEvents?: string[];
  /** 允许的项目 */
  allowedProjects?: string[];
  /** 拒绝的项目 */
  deniedProjects?: string[];
  /** 最小触发间隔（毫秒） */
  minInterval?: number;
}

/**
 * 触发器插件元信息
 */
export interface TriggerPluginMeta extends PluginMeta {
  /** 插件类型固定为 'trigger' */
  readonly type: 'trigger';
  /** 触发器元信息 */
  readonly triggerMeta: TriggerMeta;
}

/**
 * 触发器事件
 */
export interface TriggerEvent {
  /** 事件 ID */
  id: string;
  /** 触发器名称 */
  triggerName: string;
  /** 事件类型 */
  eventType: string;
  /** 事件源 */
  source?: string;
  /** 事件数据 */
  data: unknown;
  /** 解析后的请求 */
  parsedRequest?: ParsedTriggerRequest;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 触发器处理器
 */
export type TriggerEventHandler = (event: TriggerEvent) => Promise<void> | void;

/**
 * 触发器插件接口
 */
export interface TriggerPlugin {
  /** 插件元信息 */
  readonly meta: TriggerPluginMeta;
  
  /**
   * 初始化插件
   * @param config 插件配置
   * @param context 插件上下文
   */
  initialize(config: TriggerPluginConfig, context: PluginContext): Promise<void>;
  
  /**
   * 获取触发器适配器
   */
  getAdapter(): TriggerAdapter;
  
  /**
   * 处理传入的请求
   * @param request 原始请求
   * @param headers 请求头
   */
  handleRequest(request: unknown, headers?: Record<string, string>): Promise<ParsedTriggerRequest>;
  
  /**
   * 验证请求
   * @param request 原始请求
   * @param headers 请求头
   */
  validateRequest(request: unknown, headers?: Record<string, string>): Promise<ValidationResult>;
  
  /**
   * 验证认证
   * @param token 认证令牌
   */
  validateAuth(token: string): Promise<ValidationResult>;
  
  /**
   * 注册事件处理器
   * @param handler 事件处理器
   */
  onTrigger(handler: TriggerEventHandler): void;
  
  /**
   * 取消事件处理
   * @param taskId 任务 ID
   */
  onCancel?(taskId: string): Promise<void>;
  
  /**
   * 健康检查
   */
  healthCheck(): Promise<boolean>;
}

/**
 * 触发器插件工厂
 */
export interface TriggerPluginFactory {
  /** 创建触发器插件实例 */
  create(config: TriggerPluginConfig, context: PluginContext): Promise<TriggerPlugin>;
  /** 获取插件元信息 */
  getMeta(): TriggerPluginMeta;
  /** 验证插件配置 */
  validatePluginConfig(config: Record<string, unknown>): PluginValidationResult;
}

/**
 * 触发器插件注册器
 */
export interface TriggerPluginRegistry {
  /** 注册触发器插件 */
  register(plugin: TriggerPlugin): void;
  /** 注册触发器插件工厂 */
  registerFactory(factory: TriggerPluginFactory): void;
  /** 获取触发器插件 */
  get(name: string): TriggerPlugin | undefined;
  /** 检查触发器是否已注册 */
  has(name: string): boolean;
  /** 获取所有已注册的触发器名称 */
  getRegisteredNames(): string[];
  /** 获取所有触发器插件 */
  getAll(): TriggerPlugin[];
  /** 获取触发器适配器 */
  getAdapter(name: string): TriggerAdapter | undefined;
}
