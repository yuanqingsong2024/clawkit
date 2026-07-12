/**
 * OpenCode Executor 工厂
 * 用于创建 OpenCodeExecutor 实例
 */

import type { ExecutorFactory, ExecutorMeta, ExecutorFactoryConfig, TaskExecutor } from '@clawkit/shared';

import type { WorkerConfig } from '../config';
import { OpenCodeExecutor } from './open-code-executor';

/**
 * OpenCode Executor 元信息
 */
const OPENCODE_META: ExecutorMeta = {
  name: 'opencode',
  displayName: 'OpenCode 服务',
  version: '1.0.0',
  description: '使用 OpenCode 服务执行任务',
  capabilities: [
    {
      type: 'code-generation',
      description: '代码生成和修改',
      supportsStreaming: true,
    },
    {
      type: 'refactoring',
      description: '代码重构',
      supportsStreaming: true,
    },
    {
      type: 'code-review',
      description: '代码审查',
    },
    {
      type: 'testing',
      description: '测试生成和运行',
    },
  ],
  supportedLanguages: ['typescript', 'javascript', 'python', 'go', 'rust', 'java', 'cpp', 'c', 'csharp', 'ruby', 'php'],
};

/**
 * OpenCode Executor 工厂实现
 */
export class OpenCodeExecutorFactory implements ExecutorFactory {
  readonly meta = OPENCODE_META;

  create(config: ExecutorFactoryConfig): TaskExecutor {
    // 将通用配置转换为 WorkerConfig 格式
    const workerConfig = this.buildWorkerConfig(config);
    return new OpenCodeExecutor(workerConfig);
  }

  validateConfig(config: Record<string, unknown>): { valid: boolean; errors?: string[]; warnings?: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // port 是可选的，但如果是正整数
    if (config.port !== undefined) {
      if (typeof config.port !== 'number' || config.port <= 0 || config.port > 65535) {
        errors.push('port 必须是 1-65535 之间的整数');
      }
    }

    // timeoutMs 是可选的，但如果是正整数
    if (config.timeoutMs !== undefined) {
      if (typeof config.timeoutMs !== 'number' || config.timeoutMs <= 0) {
        errors.push('timeoutMs 必须是正整数');
      }
    }

    // agent 是可选的
    if (config.agent !== undefined && typeof config.agent !== 'string') {
      errors.push('agent 必须是字符串');
    }

    // mode 是可选的
    if (config.mode !== undefined && typeof config.mode !== 'string') {
      errors.push('mode 必须是字符串');
    }

    // baseUrl 是可选的，但如果是 URL 必须有效
    if (config.baseUrl !== undefined) {
      if (typeof config.baseUrl !== 'string') {
        errors.push('baseUrl 必须是字符串');
      } else {
        try {
          new URL(config.baseUrl);
        } catch {
          errors.push('baseUrl 必须是有效的 URL');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * 将通用配置转换为 WorkerConfig 格式
   */
  private buildWorkerConfig(config: ExecutorFactoryConfig): WorkerConfig {
    const cfg = config.config || {};
    return {
      workerId: config.node || 'opencode-worker',
      name: 'OpenCode Worker',
      nodeName: 'local',
      connectMode: 'pull',
      tags: [],
      labels: {},
      capabilities: [],
      supportedProjects: [],
      controllerUrl: 'http://localhost:8787',
      heartbeatIntervalMs: 10000,
      pollIntervalMs: 5000,
      maxConcurrentTasks: 3,
      openCode: {
        server: {
          baseUrl: cfg.baseUrl as string | undefined,
          username: cfg.username as string | undefined,
          passwordEnv: cfg.passwordEnv as string | undefined,
        },
        mode: (cfg.mode as 'sdk' | 'cli') || 'sdk',
        timeoutMs: (cfg.timeoutMs as number) || 300000,
        fallbackToPlaceholder: config.fallbackToPlaceholder ?? false,
      },
    };
  }
}

// 导出工厂实例
export const opencodeExecutorFactory = new OpenCodeExecutorFactory();
