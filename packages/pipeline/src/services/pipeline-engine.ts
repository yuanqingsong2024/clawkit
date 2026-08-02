/**
 * 流水线引擎
 * 流水线编排的核心引擎，负责整体调度
 */

import {
  PipelineDefinition,
  PipelineStatus,
  PipelineExecutionState,
  PipelineExecutionContext,
  PipelineExecutionOptions,
  PipelineEvent,
  PipelineEventType,
  NodeStatus,
} from '../types/pipeline.types';
import { DAGScheduler } from './dag-scheduler';
import { NodeExecutor } from './node-executor';
import { RetryManager } from './retry-manager';
import { PipelineValidator, ValidationResult } from './pipeline-validator';
import { PipelineSerializer } from './pipeline-serializer';

/**
 * 流水线引擎配置
 */
export interface PipelineEngineConfig {
  /** 最大并发任务数 */
  maxConcurrency: number;
  /** 是否启用并行执行 */
  enableParallel: boolean;
  /** 默认节点超时时间 */
  defaultNodeTimeout: number;
  /** 是否启用重试 */
  enableRetry: boolean;
  /** 默认重试次数 */
  defaultRetries: number;
}

/**
 * 流水线引擎事件处理器
 */
export type PipelineEventHandler = (event: PipelineEvent) => void;

/**
 * 流水线引擎
 */
export class PipelineEngine {
  private config: Required<PipelineEngineConfig>;
  private validator: PipelineValidator;
  private serializer: PipelineSerializer;
  private retryManager: RetryManager;
  private nodeExecutor: NodeExecutor;
  private eventHandlers: PipelineEventHandler[] = [];
  private runningExecutions: Map<string, DAGScheduler> = new Map();
  private completedExecutions: Map<string, PipelineExecutionState> = new Map();

  constructor(config?: Partial<PipelineEngineConfig>) {
    this.config = {
      maxConcurrency: config?.maxConcurrency ?? 5,
      enableParallel: config?.enableParallel ?? true,
      defaultNodeTimeout: config?.defaultNodeTimeout ?? 300000,
      enableRetry: config?.enableRetry ?? true,
      defaultRetries: config?.defaultRetries ?? 3,
    };

    this.validator = new PipelineValidator();
    this.serializer = new PipelineSerializer();
    this.retryManager = new RetryManager({ maxRetries: this.config.defaultRetries });
    this.nodeExecutor = new NodeExecutor();
  }

  /**
   * 创建流水线
   */
  createPipeline(yamlOrJson?: string): PipelineDefinition {
    if (yamlOrJson) {
      if (yamlOrJson.trim().startsWith('{')) {
        return this.serializer.parseFromJson(yamlOrJson);
      } else {
        return this.serializer.parseFromYaml(yamlOrJson);
      }
    }

    return {
      id: `pipeline-${Date.now()}`,
      name: 'New Pipeline',
      version: 1,
      nodes: [],
      entryNodeId: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * 验证流水线
   */
  validate(pipeline: PipelineDefinition): ValidationResult {
    return this.validator.validate(pipeline);
  }

  /**
   * 序列化流水线
   */
  serialize(pipeline: PipelineDefinition, format: 'json' | 'yaml' = 'yaml'): string {
    return format === 'json'
      ? this.serializer.toJson(pipeline)
      : this.serializer.toYaml(pipeline);
  }

  /**
   * 执行流水线
   */
  async execute(
    pipeline: PipelineDefinition,
    options?: PipelineExecutionOptions
  ): Promise<PipelineExecutionState> {
    // 验证流水线
    const validationResult = this.validate(pipeline);
    if (!validationResult.valid) {
      return {
        executionId: `exec-${Date.now()}`,
        pipelineId: pipeline.id,
        pipelineVersion: pipeline.version,
        status: PipelineStatus.FAILED,
        nodeStates: new Map(),
        startTime: Date.now(),
        endTime: Date.now(),
        error: `流水线验证失败: ${validationResult.errors.map(e => e.message).join(', ')}`,
      };
    }

    // 创建执行上下文
    const executionId = `exec-${Date.now()}`;
    const context: PipelineExecutionContext = {
      executionId,
      pipeline,
      inputParams: options?.inputParams || {},
      triggerTime: Date.now(),
      triggerSource: options?.triggerSource,
      triggeredBy: options?.triggeredBy,
    };

    // 创建调度器
    const scheduler = new DAGScheduler(
      pipeline,
      context,
      this.createNodeExecutor(context),
      {
        maxConcurrency: this.config.maxConcurrency,
        enableParallel: this.config.enableParallel,
        defaultNodeTimeout: this.config.defaultNodeTimeout,
      }
    );

    this.runningExecutions.set(executionId, scheduler);

    // 发送开始事件
    this.emitEvent({
      eventId: `event-${Date.now()}`,
      type: PipelineEventType.PIPELINE_STARTED,
      executionId,
      pipelineId: pipeline.id,
      timestamp: Date.now(),
      data: {
        triggerSource: options?.triggerSource,
        triggeredBy: options?.triggeredBy,
      },
    });

    try {
      // 执行调度
      const state = await scheduler.schedule();

      // 保存执行状态
      this.completedExecutions.set(executionId, state);
      this.runningExecutions.delete(executionId);

      // 发送完成事件
      this.emitEvent({
        eventId: `event-${Date.now()}`,
        type: state.status === PipelineStatus.SUCCESS
          ? PipelineEventType.PIPELINE_COMPLETED
          : PipelineEventType.PIPELINE_FAILED,
        executionId,
        pipelineId: pipeline.id,
        timestamp: Date.now(),
        data: {
          status: state.status,
          duration: state.duration,
          output: state.output,
          error: state.error,
        },
      });

      return state;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const state: PipelineExecutionState = {
        executionId,
        pipelineId: pipeline.id,
        pipelineVersion: pipeline.version,
        status: PipelineStatus.FAILED,
        nodeStates: new Map(),
        startTime: Date.now(),
        endTime: Date.now(),
        error: errorMessage,
      };

      this.completedExecutions.set(executionId, state);
      this.runningExecutions.delete(executionId);

      this.emitEvent({
        eventId: `event-${Date.now()}`,
        type: PipelineEventType.PIPELINE_FAILED,
        executionId,
        pipelineId: pipeline.id,
        timestamp: Date.now(),
        data: { error: errorMessage },
      });

      return state;
    }
  }

  /**
   * 创建节点执行器（带重试）
   */
  private createNodeExecutor(context: PipelineExecutionContext) {
    return async (nodeContext: import('../types/pipeline.types').NodeExecutionContext) => {
      const { node } = nodeContext;

      // 发送节点开始事件
      this.emitEvent({
        eventId: `event-${Date.now()}`,
        type: PipelineEventType.NODE_STARTED,
        executionId: context.executionId,
        pipelineId: context.pipeline.id,
        nodeId: node.id,
        timestamp: Date.now(),
      });

      try {
        let result: import('../types/pipeline.types').NodeExecutionResult;

        if (this.config.enableRetry && node.retries !== undefined && node.retries > 0) {
          // 使用重试管理器
          const retryResult = await this.retryManager.executeWithRetry(
            () => this.nodeExecutor.execute(nodeContext),
            node
          );
          result = retryResult.result;
        } else {
          // 直接执行
          result = await this.nodeExecutor.execute(nodeContext);
        }

        // 发送节点完成事件
        this.emitEvent({
          eventId: `event-${Date.now()}`,
          type: result.status === NodeStatus.SUCCESS
            ? PipelineEventType.NODE_COMPLETED
            : PipelineEventType.NODE_FAILED,
          executionId: context.executionId,
          pipelineId: context.pipeline.id,
          nodeId: node.id,
          timestamp: Date.now(),
          data: {
            status: result.status,
            duration: result.duration,
            output: result.output,
            error: result.error,
          },
        });

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        this.emitEvent({
          eventId: `event-${Date.now()}`,
          type: PipelineEventType.NODE_FAILED,
          executionId: context.executionId,
          pipelineId: context.pipeline.id,
          nodeId: node.id,
          timestamp: Date.now(),
          data: { error: errorMessage },
        });

        throw error;
      }
    };
  }

  /**
   * 取消执行
   */
  cancel(executionId: string): boolean {
    const scheduler = this.runningExecutions.get(executionId);
    if (!scheduler) {
      return false;
    }

    scheduler.cancel();

    const state = scheduler.getExecutionState();
    this.completedExecutions.set(executionId, state);
    this.runningExecutions.delete(executionId);

    this.emitEvent({
      eventId: `event-${Date.now()}`,
      type: PipelineEventType.PIPELINE_CANCELLED,
      executionId,
      pipelineId: state.pipelineId,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * 获取执行状态
   */
  getExecutionState(executionId: string): PipelineExecutionState | undefined {
    const scheduler = this.runningExecutions.get(executionId);
    if (scheduler) {
      return scheduler.getExecutionState();
    }
    return this.completedExecutions.get(executionId);
  }

  /**
   * 获取正在运行的执行
   */
  getRunningExecutions(): string[] {
    return Array.from(this.runningExecutions.keys());
  }

  /**
   * 注册事件处理器
   */
  onEvent(handler: PipelineEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const index = this.eventHandlers.indexOf(handler);
      if (index > -1) {
        this.eventHandlers.splice(index, 1);
      }
    };
  }

  /**
   * 发送事件
   */
  private emitEvent(event: PipelineEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('[PipelineEngine] 事件处理器错误:', error);
      }
    }
  }

  /**
   * 转换为 DAG 可视化数据
   */
  toDAGVisualData(pipeline: PipelineDefinition) {
    return this.serializer.toDAGVisualData(pipeline);
  }

  /**
   * 从 DAG 可视化数据创建流水线
   */
  fromDAGVisualData(visualData: import('../types/pipeline.types').DAGVisualData) {
    return this.serializer.fromDAGVisualData(visualData, `pipeline-${Date.now()}`);
  }

  /**
   * 清理完成的执行
   */
  cleanup(completedBefore?: number): number {
    const before = completedBefore || Date.now();
    let count = 0;

    for (const [executionId, state] of this.completedExecutions) {
      if (state.startTime < before) {
        this.completedExecutions.delete(executionId);
        count++;
      }
    }

    return count;
  }

  /**
   * 获取引擎配置
   */
  getConfig(): PipelineEngineConfig {
    return { ...this.config };
  }

  /**
   * 更新引擎配置
   */
  updateConfig(config: Partial<PipelineEngineConfig>): void {
    Object.assign(this.config, config);
  }
}
