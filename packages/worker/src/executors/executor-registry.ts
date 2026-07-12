/**
 * 执行器注册表实现
 * 管理所有已注册的执行器工厂，支持动态选择和默认执行器
 */

import type {
  ExecutorFactory,
  ExecutorRegistry,
  ExecutorFactoryConfig,
  TaskExecutor,
  ExecutorMeta,
  ValidationResult,
} from '@clawkit/shared';

/**
 * 默认执行器注册表实现
 */
export class DefaultExecutorRegistry implements ExecutorRegistry {
  private readonly factories = new Map<string, ExecutorFactory>();
  private defaultName: string | undefined;

  register(factory: ExecutorFactory): void {
    this.factories.set(factory.meta.name, factory);
    
    // 如果还没有设置默认执行器，将第一个注册的设为默认
    if (!this.defaultName) {
      this.defaultName = factory.meta.name;
    }
  }

  get(name: string): ExecutorFactory | undefined {
    return this.factories.get(name);
  }

  getRegisteredNames(): string[] {
    return Array.from(this.factories.keys());
  }

  setDefault(name: string): void {
    if (!this.factories.has(name)) {
      throw new Error(`执行器 ${name} 未注册，无法设为默认`);
    }
    this.defaultName = name;
  }

  getDefault(): ExecutorFactory | undefined {
    if (!this.defaultName) {
      return undefined;
    }
    return this.factories.get(this.defaultName);
  }

  has(name: string): boolean {
    return this.factories.has(name);
  }

  /**
   * 根据配置创建执行器实例
   */
  createExecutor(config: ExecutorFactoryConfig): TaskExecutor {
    const factory = this.get(config.type);
    if (!factory) {
      throw new Error(`执行器类型 ${config.type} 未注册，可用类型：${this.getRegisteredNames().join(', ')}`);
    }
    return factory.create(config);
  }

  /**
   * 获取所有已注册执行器的元信息
   */
  getAllMeta(): ExecutorMeta[] {
    return Array.from(this.factories.values()).map((f) => f.meta);
  }
}

// 全局注册表实例
let globalRegistry: DefaultExecutorRegistry | undefined;

/**
 * 获取全局执行器注册表
 */
export function getExecutorRegistry(): DefaultExecutorRegistry {
  if (!globalRegistry) {
    globalRegistry = new DefaultExecutorRegistry();
  }
  return globalRegistry;
}

/**
 * 设置全局执行器注册表（用于测试或自定义注册表）
 */
export function setExecutorRegistry(registry: DefaultExecutorRegistry): void {
  globalRegistry = registry;
}

/**
 * 注册执行器工厂到全局注册表
 */
export function registerExecutorFactory(factory: ExecutorFactory): void {
  getExecutorRegistry().register(factory);
}

/**
 * 创建执行器实例（使用全局注册表）
 */
export function createExecutor(config: ExecutorFactoryConfig): TaskExecutor {
  return (getExecutorRegistry() as DefaultExecutorRegistry).createExecutor(config);
}

/**
 * 注册并创建执行器
 */
export function registerAndCreateExecutor(factory: ExecutorFactory, config: ExecutorFactoryConfig): TaskExecutor {
  registerExecutorFactory(factory);
  return factory.create(config);
}
