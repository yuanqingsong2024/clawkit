/**
 * 重试管理器
 * 负责管理节点执行失败后的重试逻辑
 */

import { PipelineNodeConfig, NodeStatus, NodeExecutionResult } from '../types/pipeline.types';

/**
 * 重试策略
 */
export enum RetryStrategy {
  /** 固定间隔 */
  FIXED = 'fixed',
  /** 指数退避 */
  EXPONENTIAL = 'exponential',
  /** 线性退避 */
  LINEAR = 'linear',
  /** 斐波那契退避 */
  FIBONACCI = 'fibonacci',
}

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试策略 */
  strategy: RetryStrategy;
  /** 基础重试间隔（毫秒） */
  baseDelay: number;
  /** 最大重试间隔（毫秒） */
  maxDelay: number;
  /** 是否使用抖动 */
  jitter: boolean;
  /** 重试条件 */
  retryCondition?: (error: string, attempt: number) => boolean;
}

/**
 * 重试结果
 */
export interface RetryResult {
  /** 是否成功 */
  success: boolean;
  /** 最终结果 */
  result: NodeExecutionResult;
  /** 总重试次数 */
  totalRetries: number;
  /** 总执行时间 */
  totalDuration: number;
  /** 重试历史 */
  history: Array<{
    attempt: number;
    startTime: number;
    endTime: number;
    error?: string;
  }>;
}

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  strategy: RetryStrategy.EXPONENTIAL,
  baseDelay: 1000,
  maxDelay: 60000,
  jitter: true,
};

/**
 * 重试管理器
 */
export class RetryManager {
  private defaultConfig: RetryConfig;

  constructor(defaultConfig?: Partial<RetryConfig>) {
    this.defaultConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...defaultConfig,
    };
  }

  /**
   * 执行带重试的操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    nodeConfig: PipelineNodeConfig,
    customConfig?: Partial<RetryConfig>
  ): Promise<RetryResult> {
    const config = this.getEffectiveConfig(nodeConfig, customConfig);
    const startTime = Date.now();
    const history: RetryResult['history'] = [];

    let lastError: string | undefined;
    let attempt = 0;

    while (attempt <= config.maxRetries) {
      const attemptStartTime = Date.now();

      try {
        const result = await operation();

        // 如果操作成功，直接返回
        const duration = Date.now() - startTime;
        return {
          success: true,
          result: result as unknown as NodeExecutionResult,
          totalRetries: attempt,
          totalDuration: duration,
          history,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        
        history.push({
          attempt,
          startTime: attemptStartTime,
          endTime: Date.now(),
          error: lastError,
        });

        // 检查是否应该重试
        if (config.retryCondition && !config.retryCondition(lastError, attempt)) {
          break;
        }

        // 如果还有重试次数，等待后重试
        if (attempt < config.maxRetries) {
          const delay = this.calculateDelay(attempt, config);
          console.log(`[RetryManager] 重试 ${attempt + 1}/${config.maxRetries}，等待 ${delay}ms，错误: ${lastError}`);
          await this.sleep(delay);
        }

        attempt++;
      }
    }

    // 所有重试都失败了
    const duration = Date.now() - startTime;
    return {
      success: false,
      result: {
        nodeId: nodeConfig.id,
        status: NodeStatus.FAILED,
        startTime,
        endTime: Date.now(),
        duration,
        error: lastError,
        retryCount: attempt,
      },
      totalRetries: attempt,
      totalDuration: duration,
      history,
    };
  }

  /**
   * 获取有效的重试配置
   */
  private getEffectiveConfig(
    nodeConfig: PipelineNodeConfig,
    customConfig?: Partial<RetryConfig>
  ): RetryConfig {
    return {
      ...this.defaultConfig,
      maxRetries: nodeConfig.retries ?? this.defaultConfig.maxRetries,
      retryDelay: nodeConfig.retryDelay ?? this.defaultConfig.baseDelay,
      ...customConfig,
    };
  }

  /**
   * 计算重试延迟
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay: number;

    switch (config.strategy) {
      case RetryStrategy.FIXED:
        delay = config.baseDelay;
        break;

      case RetryStrategy.EXPONENTIAL:
        delay = config.baseDelay * Math.pow(2, attempt);
        break;

      case RetryStrategy.LINEAR:
        delay = config.baseDelay * (attempt + 1);
        break;

      case RetryStrategy.FIBONACCI:
        delay = config.baseDelay * this.fibonacci(attempt + 1);
        break;

      default:
        delay = config.baseDelay;
    }

    // 限制最大延迟
    delay = Math.min(delay, config.maxDelay);

    // 添加抖动
    if (config.jitter) {
      delay = this.addJitter(delay);
    }

    return delay;
  }

  /**
   * 斐波那契数列
   */
  private fibonacci(n: number): number {
    if (n <= 1) return 1;
    let a = 1, b = 1;
    for (let i = 2; i < n; i++) {
      const temp = a + b;
      a = b;
      b = temp;
    }
    return b;
  }

  /**
   * 添加抖动
   */
  private addJitter(delay: number): number {
    const jitterFactor = 0.2; // 20% 的抖动范围
    const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  }

  /**
   * 等待指定时间
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 检查是否应该重试
   */
  shouldRetry(error: string, attempt: number, config?: RetryConfig): boolean {
    const effectiveConfig = config || this.defaultConfig;
    
    if (attempt >= effectiveConfig.maxRetries) {
      return false;
    }

    if (effectiveConfig.retryCondition) {
      return effectiveConfig.retryCondition(error, attempt);
    }

    return true;
  }

  /**
   * 获取重试统计
   */
  getRetryStatistics(results: RetryResult[]): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    totalRetries: number;
    avgRetries: number;
    successRate: number;
  } {
    const totalExecutions = results.length;
    const successfulExecutions = results.filter(r => r.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    const totalRetries = results.reduce((sum, r) => sum + r.totalRetries, 0);
    const avgRetries = totalExecutions > 0 ? totalRetries / totalExecutions : 0;
    const successRate = totalExecutions > 0 ? successfulExecutions / totalExecutions : 0;

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      totalRetries,
      avgRetries,
      successRate,
    };
  }
}

/**
 * 快速失败错误
 * 用于表示不应该重试的错误
 */
export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

/**
 * 超时错误
 */
export class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`操作超时 (${timeout}ms)`);
    this.name = 'TimeoutError';
  }
}

/**
 * 创建可重试的 Promise 包装器
 */
export function withRetry<T>(
  promise: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  const manager = new RetryManager(config);
  
  // 这个函数需要进一步处理，实际使用应该配合 RetryManager.executeWithRetry
  return promise();
}
