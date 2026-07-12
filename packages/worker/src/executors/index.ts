/**
 * 执行器模块导出
 * 包含所有内置执行器和执行器注册表
 */

// 从本地 executor-registry 模块导入
import {
  DefaultExecutorRegistry,
  getExecutorRegistry,
  setExecutorRegistry,
  registerExecutorFactory,
  createExecutor,
} from './executor-registry';

// 执行器类型
import type { ExecutorRegistry } from '@clawkit/shared';
export type { ExecutorRegistry };

// OpenCode 执行器
export { OpenCodeExecutor } from './open-code-executor';
export { OpenCodeExecutorFactory, opencodeExecutorFactory } from './open-code-executor-factory';

// Claude Code 执行器
export { ClaudeCodeExecutor, ClaudeCodeExecutorFactory, claudeCodeExecutorFactory } from './claude-code-executor';

// 占位执行器
export { PlaceholderExecutor } from './placeholder-executor';

/**
 * 初始化所有内置执行器
 * 调用此函数将注册所有内置执行器到全局注册表
 */
export function initializeBuiltinExecutors(): void {
  // 导入工厂实例
  const { opencodeExecutorFactory } = require('./open-code-executor-factory');
  const { claudeCodeExecutorFactory } = require('./claude-code-executor');
  
  // 注册 Claude Code 执行器
  registerExecutorFactory(claudeCodeExecutorFactory);
  
  // 注册 OpenCode 执行器
  registerExecutorFactory(opencodeExecutorFactory);
}

/**
 * 创建指定类型的执行器
 */
export function createExecutorByType(
  type: string,
  config: Record<string, unknown>,
  node?: string,
  fallbackToPlaceholder?: boolean,
): import('@clawkit/shared').TaskExecutor {
  return createExecutor({
    type,
    config: config || {},
    node,
    fallbackToPlaceholder,
  });
}

// 重新导出注册表相关函数
export { getExecutorRegistry, setExecutorRegistry };
