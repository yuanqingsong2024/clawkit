/**
 * 基础插件接口
 * 定义所有插件类型的通用接口
 */

import type { PluginMeta, PluginConfig, PluginContext, PluginValidationResult } from '../types/plugin.types';

/**
 * 基础插件接口
 * 所有插件类型都必须实现此接口
 */
export interface Plugin {
  /** 插件元信息 */
  readonly meta: PluginMeta;
  
  /**
   * 初始化插件
   * @param config 插件配置
   * @param context 插件上下文
   */
  initialize(config: PluginConfig, context: PluginContext): Promise<void>;
  
  /**
   * 启动插件
   * 插件进入运行状态前的准备工作
   */
  start(): Promise<void>;
  
  /**
   * 停止插件
   * 插件进入停止状态前的清理工作
   */
  stop(): Promise<void>;
  
  /**
   * 销毁插件
   * 完全卸载插件前的清理工作
   */
  dispose(): Promise<void>;
  
  /**
   * 验证配置
   * @param config 配置对象
   */
  validateConfig(config: Record<string, unknown>): PluginValidationResult;
  
  /**
   * 健康检查
   * @returns 插件是否健康
   */
  healthCheck(): Promise<boolean>;
}

/**
 * 插件工厂接口
 * 用于创建插件实例
 */
export interface PluginFactory {
  /** 工厂名称 */
  readonly name: string;
  /** 工厂版本 */
  readonly version: string;
  
  /**
   * 创建插件实例
   * @param config 插件配置
   * @param context 插件上下文
   */
  create(config: PluginConfig, context: PluginContext): Promise<Plugin>;
  
  /**
   * 验证插件配置
   * @param config 配置对象
   */
  validatePluginConfig(config: Record<string, unknown>): PluginValidationResult;
}

/**
 * 插件注册表接口
 * 管理插件的注册和获取
 */
export interface PluginRegistry {
  /** 注册插件 */
  register(plugin: Plugin): void;
  
  /** 注册插件工厂 */
  registerFactory(factory: PluginFactory): void;
  
  /** 获取插件 */
  get(name: string): Plugin | undefined;
  
  /** 检查插件是否存在 */
  has(name: string): boolean;
  
  /** 获取所有已注册的插件名称 */
  getRegisteredNames(): string[];
  
  /** 获取所有插件 */
  getAll(): Plugin[];
  
  /** 设置默认插件 */
  setDefault(name: string): void;
  
  /** 获取默认插件 */
  getDefault(): Plugin | undefined;
  
  /** 移除插件 */
  remove(name: string): void;
  
  /** 清空所有插件 */
  clear(): void;
}

/**
 * 插件发现器接口
 * 用于发现可用插件
 */
export interface PluginDiscoverer {
  /**
   * 发现插件
   * @param options 发现选项
   */
  discover(options?: Record<string, unknown>): Promise<PluginMeta[]>;
  
  /**
   * 获取已发现插件的详细信息
   * @param meta 插件元信息
   */
  getDetails(meta: PluginMeta): Promise<unknown>;
}

/**
 * 插件安装器接口
 * 用于安装插件
 */
export interface PluginInstaller {
  /**
   * 安装插件
   * @param source 插件来源
   * @param options 安装选项
   */
  install(source: string, options?: Record<string, unknown>): Promise<PluginMeta>;
  
  /**
   * 卸载插件
   * @param name 插件名称
   */
  uninstall(name: string): Promise<void>;
  
  /**
   * 更新插件
   * @param name 插件名称
   * @param version 目标版本
   */
  update(name: string, version?: string): Promise<PluginMeta>;
}
