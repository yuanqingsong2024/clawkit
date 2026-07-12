/**
 * 执行器工厂服务
 * 根据 executorType 动态创建执行器实例
 */

import { createLogger } from '@clawkit/shared';
import type { ExecutorFactoryConfig, TaskExecutor } from '@clawkit/shared';
import {
  getExecutorRegistry,
  registerExecutorFactory,
} from '../executors/executor-registry';

/**
 * 默认执行器类型映射
 * 支持多种别名
 */
const EXECUTOR_TYPE_MAPPING: Record<string, string> = {
  // OpenCode 相关
  'opencode': 'opencode',
  'open-code': 'opencode',
  
  // Claude Code CLI 相关
  'claude-code': 'claude-code',
  'claude_code': 'claude-code',
  'claude': 'claude-code',
  
  // Placeholder（用于链路验证）
  'placeholder': 'placeholder',
  
  // Codex CLI
  'codex': 'codex',
  'codex-cli': 'codex',
  
  // Gemini CLI
  'gemini': 'gemini',
  'gemini-cli': 'gemini',
};

export class ExecutorFactoryService {
  private readonly logger = createLogger('ExecutorFactoryService');
  private initialized = false;

  /**
   * 初始化执行器工厂服务
   * 注册所有内置执行器
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.logger.info('初始化执行器工厂服务...');

    // 动态导入并注册所有内置执行器
    this.registerBuiltinExecutors();

    const registeredTypes = this.getRegisteredExecutorTypes();
    this.logger.info(`执行器工厂服务初始化完成，已注册类型：${registeredTypes.join(', ')}`);
    
    this.initialized = true;
  }

  /**
   * 注册所有内置执行器
   */
  private registerBuiltinExecutors(): void {
    // Placeholder Executor - 始终注册（用于链路验证）
    try {
      const { PlaceholderExecutor } = require('../executors/placeholder-executor');
      const placeholderFactory = {
        meta: {
          name: 'placeholder',
          displayName: '占位执行器',
          version: '1.0.0',
          description: '用于链路验证的占位执行器，不执行真实任务',
          capabilities: [],
        },
        create: () => new PlaceholderExecutor(),
      };
      registerExecutorFactory(placeholderFactory);
      this.logger.debug('已注册 PlaceholderExecutor');
    } catch (err) {
      this.logger.warn(`注册 PlaceholderExecutor 失败: ${err}`);
    }

    // 注册 OpenCode 执行器
    try {
      const { opencodeExecutorFactory } = require('../executors/open-code-executor-factory');
      registerExecutorFactory(opencodeExecutorFactory);
      this.logger.debug('已注册 OpenCodeExecutor');
    } catch (err) {
      this.logger.warn(`注册 OpenCodeExecutor 失败: ${err}`);
    }

    // 注册 Claude Code 执行器
    try {
      const { claudeCodeExecutorFactory } = require('../executors/claude-code-executor');
      registerExecutorFactory(claudeCodeExecutorFactory);
      this.logger.debug('已注册 ClaudeCodeExecutor');
    } catch (err) {
      this.logger.warn(`注册 ClaudeCodeExecutor 失败: ${err}`);
    }

    // 其他执行器可以在这里继续添加...
  }

  /**
   * 获取规范化的执行器类型名
   */
  normalizeExecutorType(type: string): string {
    const normalized = EXECUTOR_TYPE_MAPPING[type.toLowerCase()];
    return normalized || type.toLowerCase();
  }

  /**
   * 获取已注册的执行器类型列表
   */
  getRegisteredExecutorTypes(): string[] {
    return getExecutorRegistry().getRegisteredNames();
  }

  /**
   * 检查执行器类型是否已注册
   */
  hasExecutor(type: string): boolean {
    const normalized = this.normalizeExecutorType(type);
    return getExecutorRegistry().has(normalized);
  }

  /**
   * 根据配置创建执行器实例
   * @param config 执行器工厂配置
   * @returns 执行器实例
   */
  createExecutor(config: ExecutorFactoryConfig): TaskExecutor {
    const normalizedType = this.normalizeExecutorType(config.type);
    const normalizedConfig = { ...config, type: normalizedType };

    try {
      const executor = getExecutorRegistry().createExecutor(normalizedConfig);
      this.logger.info(`创建执行器成功: ${normalizedType}`);
      return executor;
    } catch (error) {
      // 如果指定的执行器不存在，尝试使用默认执行器
      const defaultFactory = getExecutorRegistry().getDefault();
      if (defaultFactory && defaultFactory.meta.name !== normalizedType) {
        this.logger.warn(`执行器 ${normalizedType} 不存在，使用默认执行器 ${defaultFactory.meta.name}`);
        return defaultFactory.create({ ...normalizedConfig, type: defaultFactory.meta.name });
      }
      throw error;
    }
  }

  /**
   * 根据任务上下文创建执行器
   * 从 TaskExecutionContext 中提取 executorType 和 executorConfig
   */
  createExecutorFromContext(context: {
    executorType: string;
    executorConfig?: Record<string, unknown>;
  }): TaskExecutor {
    const normalizedType = this.normalizeExecutorType(context.executorType);
    
    const config: ExecutorFactoryConfig = {
      type: normalizedType,
      config: context.executorConfig || {},
    };

    return this.createExecutor(config);
  }
}

// 单例实例
let factoryServiceInstance: ExecutorFactoryService | undefined;

/**
 * 获取执行器工厂服务单例
 */
export function getExecutorFactoryService(): ExecutorFactoryService {
  if (!factoryServiceInstance) {
    factoryServiceInstance = new ExecutorFactoryService();
  }
  return factoryServiceInstance;
}

/**
 * 重置执行器工厂服务（用于测试）
 */
export function resetExecutorFactoryService(): void {
  factoryServiceInstance = undefined;
}
