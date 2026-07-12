/**
 * 执行器元信息接口
 * 定义执行器的基本属性和能力描述
 */

// 延迟导入 TaskExecutor 和 ValidationResult 以避免循环依赖
import type { TaskExecutor } from './task-executor';

export interface ExecutorCapability {
  /** 能力标识符，如 'code-generation', 'refactoring', 'code-review' */
  type: string;
  /** 能力描述 */
  description: string;
  /** 是否支持流式输出 */
  supportsStreaming?: boolean;
  /** 最大并发任务数 */
  maxConcurrency?: number;
  /** 环境要求 */
  environmentRequirements?: string[];
}

export interface ExecutorMeta {
  /** 执行器唯一名称，如 'opencode', 'claude-code', 'codex', 'gemini' */
  readonly name: string;
  /** 执行器显示名称 */
  readonly displayName: string;
  /** 执行器版本 */
  readonly version: string;
  /** 执行器描述 */
  readonly description: string;
  /** 执行器支持的能力列表 */
  readonly capabilities: ExecutorCapability[];
  /** 执行器支持的项目类型 */
  readonly supportedLanguages?: string[];
}

/**
 * 执行器工厂接口
 * 负责根据配置创建执行器实例
 */
export interface ExecutorFactory {
  /** 执行器元信息 */
  readonly meta: ExecutorMeta;
  /** 根据配置创建执行器实例 */
  create(config: ExecutorFactoryConfig): TaskExecutor;
  /** 验证配置是否有效 */
  validateConfig?(config: Record<string, unknown>): ValidationResult;
}

/**
 * 执行器注册表接口
 * 管理所有已注册的执行器工厂
 */
export interface ExecutorRegistry {
  /** 注册执行器工厂 */
  register(factory: ExecutorFactory): void;
  /** 获取执行器工厂 */
  get(name: string): ExecutorFactory | undefined;
  /** 获取所有已注册的执行器名称 */
  getRegisteredNames(): string[];
  /** 设置默认执行器 */
  setDefault(name: string): void;
  /** 获取默认执行器 */
  getDefault(): ExecutorFactory | undefined;
  /** 检查执行器是否已注册 */
  has(name: string): boolean;
}

/**
 * 验证结果接口
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * 执行器工厂配置接口
 * 用于传递执行器实例化所需的配置
 */
export interface ExecutorFactoryConfig {
  /** 执行器类型 */
  type: string;
  /** 执行器特定配置 */
  config: Record<string, unknown>;
  /** 节点引用 */
  node?: string;
  /** 是否允许降级到占位执行器 */
  fallbackToPlaceholder?: boolean;
}

// 重新导出 TaskExecutor 类型供外部使用
export type { TaskExecutor } from './task-executor';
