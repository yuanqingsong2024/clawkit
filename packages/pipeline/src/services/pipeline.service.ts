/**
 * 流水线服务
 * 管理流水线的创建、更新、删除和执行
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type {
  PipelineDefinition,
  PipelineExecution,
  PipelineStatus,
  PipelineEvent,
  PipelineStats,
  PipelineValidationResult,
} from '../types/pipeline.types';
import { DAGExecutionEngine, createDAGExecutionEngine } from '../engine/dag-engine';

/**
 * 流水线存储接口
 */
export interface PipelineStore {
  save(pipeline: PipelineDefinition): Promise<void>;
  get(id: string): Promise<PipelineDefinition | undefined>;
  delete(id: string): Promise<boolean>;
  list(projectKey?: string): Promise<PipelineDefinition[]>;
}

/**
 * 执行记录存储接口
 */
export interface ExecutionStore {
  save(execution: PipelineExecution): Promise<void>;
  get(id: string): Promise<PipelineExecution | undefined>;
  list(pipelineId: string, limit?: number): Promise<PipelineExecution[]>;
  getLatest(pipelineId: string): Promise<PipelineExecution | undefined>;
}

/**
 * 流水线服务选项
 */
export interface PipelineServiceOptions {
  /** 存储实现 */
  store?: PipelineStore;
  /** 执行记录存储 */
  executionStore?: ExecutionStore;
  /** 默认超时时间（毫秒） */
  defaultTimeout?: number;
  /** 最大并发执行数 */
  maxConcurrentExecutions?: number;
}

/**
 * 流水线服务
 */
export class PipelineService extends EventEmitter {
  private store: PipelineStore;
  private executionStore: ExecutionStore;
  private maxConcurrentExecutions: number;
  private runningExecutions: Map<string, PipelineExecution> = new Map();
  private engine: DAGExecutionEngine;

  constructor(options: PipelineServiceOptions = {}) {
    super();
    this.store = options.store || new InMemoryPipelineStore();
    this.executionStore = options.executionStore || new InMemoryExecutionStore();
    this.maxConcurrentExecutions = options.maxConcurrentExecutions || 10;
    this.engine = createDAGExecutionEngine();

    // 设置引擎事件转发
    this.engine.addEventListener('*', (event) => {
      this.emit(event.type, event);
    });
  }

  /**
   * 创建流水线
   */
  async create(definition: Omit<PipelineDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<PipelineDefinition> {
    const pipeline: PipelineDefinition = {
      ...definition,
      id: randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 验证流水线
    const validation = this.engine.validatePipeline(pipeline);
    if (!validation.valid) {
      throw new Error(`流水线验证失败: ${validation.errors.join(', ')}`);
    }

    await this.store.save(pipeline);
    return pipeline;
  }

  /**
   * 更新流水线
   */
  async update(id: string, updates: Partial<PipelineDefinition>): Promise<PipelineDefinition> {
    const existing = await this.store.get(id);
    if (!existing) {
      throw new Error(`流水线 ${id} 不存在`);
    }

    // 检查是否有正在运行的执行
    const runningExecution = await this.executionStore.getLatest(id);
    if (runningExecution && runningExecution.status === 'running') {
      throw new Error(`流水线 ${id} 正在运行，无法更新`);
    }

    const updated: PipelineDefinition = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };

    // 重新验证
    const validation = this.engine.validatePipeline(updated);
    if (!validation.valid) {
      throw new Error(`流水线验证失败: ${validation.errors.join(', ')}`);
    }

    await this.store.save(updated);
    return updated;
  }

  /**
   * 删除流水线
   */
  async delete(id: string): Promise<boolean> {
    // 检查是否有正在运行的执行
    const runningExecution = await this.executionStore.getLatest(id);
    if (runningExecution && runningExecution.status === 'running') {
      throw new Error(`流水线 ${id} 正在运行，无法删除`);
    }

    return this.store.delete(id);
  }

  /**
   * 获取流水线
   */
  async get(id: string): Promise<PipelineDefinition | undefined> {
    return this.store.get(id);
  }

  /**
   * 列出流水线
   */
  async list(projectKey?: string): Promise<PipelineDefinition[]> {
    return this.store.list(projectKey);
  }

  /**
   * 验证流水线
   */
  validate(definition: PipelineDefinition): PipelineValidationResult {
    const result = this.engine.validatePipeline(definition);
    return {
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings || [],
    };
  }

  /**
   * 执行流水线
   */
  async execute(
    pipelineId: string,
    trigger?: PipelineExecution['trigger'],
    variables?: Record<string, unknown>,
  ): Promise<PipelineExecution> {
    const pipeline = await this.store.get(pipelineId);
    if (!pipeline) {
      throw new Error(`流水线 ${pipelineId} 不存在`);
    }

    // 检查并发限制
    if (this.runningExecutions.size >= this.maxConcurrentExecutions) {
      throw new Error('已达到最大并发执行数，请稍后再试');
    }

    // 检查是否已有运行中的执行
    const latestExecution = await this.executionStore.getLatest(pipelineId);
    if (latestExecution && latestExecution.status === 'running') {
      throw new Error(`流水线 ${pipelineId} 已有执行正在运行`);
    }

    // 创建执行记录
    const execution: PipelineExecution = {
      id: randomUUID(),
      pipelineId,
      pipelineVersion: pipeline.version,
      status: 'running',
      trigger: trigger || { type: 'manual' },
      startTime: Date.now(),
      nodeResults: new Map(),
      context: {
        executionId: '',
        variables: variables || {},
        nodeOutputs: new Map(),
        history: [],
      },
      triggeredBy: trigger?.source,
    };
    execution.context.executionId = execution.id;

    // 保存执行记录
    await this.executionStore.save(execution);
    this.runningExecutions.set(execution.id, execution);

    // 异步执行
    this.executePipeline(pipeline, execution).catch((err) => {
      console.error(`流水线 ${pipelineId} 执行失败:`, err);
    });

    return execution;
  }

  /**
   * 执行流水线（内部方法）
   */
  private async executePipeline(pipeline: PipelineDefinition, execution: PipelineExecution): Promise<void> {
    try {
      const result = await this.engine.execute(pipeline, execution);
      
      // 更新执行记录
      result.status = result.status === 'running' ? 'completed' : result.status;
      result.endTime = Date.now();
      result.duration = result.endTime - (result.startTime || result.endTime);
      
      await this.executionStore.save(result);
      this.runningExecutions.delete(execution.id);
    } catch (err) {
      execution.status = 'failed';
      execution.error = err instanceof Error ? err.message : String(err);
      execution.endTime = Date.now();
      execution.duration = execution.endTime - (execution.startTime || execution.endTime);
      
      await this.executionStore.save(execution);
      this.runningExecutions.delete(execution.id);
    }
  }

  /**
   * 获取执行记录
   */
  async getExecution(id: string): Promise<PipelineExecution | undefined> {
    return this.executionStore.get(id);
  }

  /**
   * 获取流水线执行历史
   */
  async getExecutionHistory(pipelineId: string, limit?: number): Promise<PipelineExecution[]> {
    return this.executionStore.list(pipelineId, limit);
  }

  /**
   * 取消执行
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.runningExecutions.get(executionId);
    if (!execution) {
      return false;
    }

    execution.status = 'cancelled';
    execution.endTime = Date.now();
    execution.duration = execution.endTime - (execution.startTime || execution.endTime);

    await this.executionStore.save(execution);
    this.runningExecutions.delete(executionId);

    this.emit('pipeline:cancelled', {
      type: 'pipeline:cancelled',
      executionId,
      pipelineId: execution.pipelineId,
      timestamp: execution.endTime,
    } as PipelineEvent);

    return true;
  }

  /**
   * 暂停执行
   */
  async pauseExecution(executionId: string): Promise<boolean> {
    const execution = this.runningExecutions.get(executionId);
    if (!execution) {
      return false;
    }

    execution.status = 'paused';
    await this.executionStore.save(execution);

    this.emit('pipeline:paused', {
      type: 'pipeline:paused',
      executionId,
      pipelineId: execution.pipelineId,
      timestamp: Date.now(),
    } as PipelineEvent);

    return true;
  }

  /**
   * 恢复执行
   */
  async resumeExecution(executionId: string): Promise<boolean> {
    const execution = await this.executionStore.get(executionId);
    if (!execution || execution.status !== 'paused') {
      return false;
    }

    // 更新状态为运行中
    execution.status = 'running';
    await this.executionStore.save(execution);
    this.runningExecutions.set(executionId, execution);

    // 获取流水线并继续执行
    const pipeline = await this.store.get(execution.pipelineId);
    if (pipeline) {
      this.executePipeline(pipeline, execution).catch((err) => {
        console.error(`流水线 ${execution.pipelineId} 恢复执行失败:`, err);
      });
    }

    return true;
  }

  /**
   * 获取流水线统计信息
   */
  async getStats(pipelineId: string): Promise<PipelineStats> {
    const executions = await this.executionStore.list(pipelineId);
    
    let successCount = 0;
    let failedCount = 0;
    let totalDuration = 0;
    let lastExecution: number | undefined;
    let lastStatus: PipelineStatus | undefined;

    for (const exec of executions) {
      if (exec.status === 'completed') {
        successCount++;
      } else if (exec.status === 'failed') {
        failedCount++;
      }

      if (exec.duration) {
        totalDuration += exec.duration;
      }

      if (!lastExecution || (exec.startTime && exec.startTime > lastExecution)) {
        lastExecution = exec.startTime;
        lastStatus = exec.status;
      }
    }

    return {
      pipelineId,
      totalExecutions: executions.length,
      successCount,
      failedCount,
      avgDuration: executions.length > 0 ? totalDuration / executions.length : 0,
      lastExecution,
      lastStatus,
    };
  }

  /**
   * 获取正在运行的执行数
   */
  getRunningCount(): number {
    return this.runningExecutions.size;
  }
}

/**
 * 内存存储实现（默认）
 */
class InMemoryPipelineStore implements PipelineStore {
  private pipelines = new Map<string, PipelineDefinition>();

  async save(pipeline: PipelineDefinition): Promise<void> {
    this.pipelines.set(pipeline.id, { ...pipeline });
  }

  async get(id: string): Promise<PipelineDefinition | undefined> {
    return this.pipelines.get(id);
  }

  async delete(id: string): Promise<boolean> {
    return this.pipelines.delete(id);
  }

  async list(projectKey?: string): Promise<PipelineDefinition[]> {
    const all = Array.from(this.pipelines.values());
    if (projectKey) {
      return all.filter((p) => p.projectKey === projectKey);
    }
    return all;
  }
}

/**
 * 内存执行记录存储实现（默认）
 */
class InMemoryExecutionStore implements ExecutionStore {
  private executions = new Map<string, PipelineExecution>();
  private byPipeline = new Map<string, string[]>();

  async save(execution: PipelineExecution): Promise<void> {
    this.executions.set(execution.id, { ...execution });

    // 维护 pipeline 到 execution 的映射
    const ids = this.byPipeline.get(execution.pipelineId) || [];
    if (!ids.includes(execution.id)) {
      ids.push(execution.id);
      this.byPipeline.set(execution.pipelineId, ids);
    }
  }

  async get(id: string): Promise<PipelineExecution | undefined> {
    return this.executions.get(id);
  }

  async list(pipelineId: string, limit?: number): Promise<PipelineExecution[]> {
    const ids = this.byPipeline.get(pipelineId) || [];
    const results = ids
      .map((id) => this.executions.get(id))
      .filter((e): e is PipelineExecution => e !== undefined)
      .sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

    return limit ? results.slice(0, limit) : results;
  }

  async getLatest(pipelineId: string): Promise<PipelineExecution | undefined> {
    const executions = await this.list(pipelineId, 1);
    return executions[0];
  }
}

/**
 * 创建流水线服务
 */
export function createPipelineService(options?: PipelineServiceOptions): PipelineService {
  return new PipelineService(options);
}
