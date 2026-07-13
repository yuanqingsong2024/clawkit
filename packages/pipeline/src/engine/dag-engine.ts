/**
 * DAG 执行引擎
 * 负责根据依赖关系调度和执行流水线阶段
 */

import type { PipelineStage, StageStatus, StageError } from '../models';
import { EventEmitter } from 'events';

export interface StageExecutionContext {
  stage: PipelineStage;
  inputs: Map<string, unknown>;
  outputs: Map<string, unknown>;
  status: StageStatus;
  startedAt?: Date;
  completedAt?: Date;
  error?: StageError;
}

export interface DAGExecutionOptions {
  /** 最大并发数 */
  maxConcurrency?: number;
  /** 阶段执行超时（毫秒） */
  stageTimeout?: number;
  /** 是否在失败时继续执行独立阶段 */
  continueOnFailure?: boolean;
}

export interface StageExecutionResult {
  success: boolean;
  output?: { stdout?: string; stderr?: string; exitCode?: number; message?: string; data?: Record<string, unknown>; artifacts?: string[]; duration?: number };
  error?: StageError;
  duration?: number;
}

export interface DAGExecutionResult {
  success: boolean;
  executedStages: string[];
  failedStages: string[];
  skippedStages: string[];
  totalDuration?: number;
  stageResults: Map<string, StageExecutionResult>;
}

export interface StageExecutor {
  execute(stage: PipelineStage, context: StageExecutionContext): Promise<StageExecutionResult>;
}

const DEFAULT_OPTIONS: Required<DAGExecutionOptions> = {
  maxConcurrency: 4,
  stageTimeout: 300000, // 5分钟
  continueOnFailure: false,
};

/**
 * DAG 执行引擎
 * 支持拓扑排序、并发执行、失败重试
 */
export class DAGEngine extends EventEmitter {
  private readonly options: Required<DAGExecutionOptions>;
  private executor?: StageExecutor;
  private executionContexts = new Map<string, StageExecutionContext>();
  private runningStages = new Set<string>();
  private completedStages = new Set<string>();
  private failedStages = new Set<string>();
  private skippedStages = new Set<string>();

  constructor(options: DAGExecutionOptions = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 设置阶段执行器
   */
  setExecutor(executor: StageExecutor): void {
    this.executor = executor;
  }

  /**
   * 执行流水线
   */
  async execute(stages: PipelineStage[]): Promise<DAGExecutionResult> {
    if (!this.executor) {
      throw new Error('未设置阶段执行器');
    }

    // 重置状态
    this.reset();
    const startTime = Date.now();

    // 验证依赖
    const cycleError = this.detectCycle(stages);
    if (cycleError) {
      return this.createErrorResult(cycleError, stages, startTime);
    }

    // 计算入度
    const inDegree = this.calculateInDegree(stages);
    const executableStages = this.getExecutableStages(stages, inDegree);

    this.emit('start', { totalStages: stages.length });

    // 执行流水线
    await this.executeStages(stages, inDegree, executableStages);

    const totalDuration = Date.now() - startTime;

    return this.createResult(totalDuration);
  }

  /**
   * 重置执行状态
   */
  private reset(): void {
    this.executionContexts.clear();
    this.runningStages.clear();
    this.completedStages.clear();
    this.failedStages.clear();
    this.skippedStages.clear();
  }

  /**
   * 检测循环依赖
   */
  private detectCycle(stages: PipelineStage[]): string | null {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const stageMap = new Map(stages.map(s => [s.id, s]));

    const dfs = (stageId: string): string | null => {
      visited.add(stageId);
      recursionStack.add(stageId);

      const stage = stageMap.get(stageId);
      if (stage?.dependencies) {
        for (const depId of stage.dependencies) {
          if (!visited.has(depId)) {
            const cycle = dfs(depId);
            if (cycle) return cycle;
          } else if (recursionStack.has(depId)) {
            return `检测到循环依赖: ${stageId} -> ${depId}`;
          }
        }
      }

      recursionStack.delete(stageId);
      return null;
    };

    for (const stage of stages) {
      if (!visited.has(stage.id)) {
        const cycle = dfs(stage.id);
        if (cycle) return cycle;
      }
    }

    return null;
  }

  /**
   * 计算入度
   */
  private calculateInDegree(stages: PipelineStage[]): Map<string, number> {
    const inDegree = new Map<string, number>();
    const stageMap = new Map(stages.map(s => [s.id, s]));

    // 初始化入度
    for (const stage of stages) {
      inDegree.set(stage.id, 0);
    }

    // 统计每个节点的依赖数
    for (const stage of stages) {
      if (stage.dependencies) {
        for (const depId of stage.dependencies) {
          if (stageMap.has(depId)) {
            inDegree.set(stage.id, (inDegree.get(stage.id) || 0) + 1);
          }
        }
      }
    }

    return inDegree;
  }

  /**
   * 获取可执行的阶段
   */
  private getExecutableStages(
    _stages: PipelineStage[],
    inDegree: Map<string, number>
  ): Set<string> {
    const executable = new Set<string>();
    for (const [stageId, degree] of inDegree) {
      if (degree === 0 && !this.completedStages.has(stageId) && !this.runningStages.has(stageId)) {
        executable.add(stageId);
      }
    }
    return executable;
  }

  /**
   * 执行阶段
   */
  private async executeStages(
    stages: PipelineStage[],
    inDegree: Map<string, number>,
    initialExecutable: Set<string>
  ): Promise<void> {
    const stageMap = new Map(stages.map(s => [s.id, s]));
    const pendingQueue = [...initialExecutable];
    const executing: Promise<void>[] = [];

    while (pendingQueue.length > 0 || executing.length > 0) {
      // 填充执行槽
      while (pendingQueue.length > 0 && executing.length < this.options.maxConcurrency) {
        const stageId = pendingQueue.shift()!;
        executing.push(this.executeStage(stageId, stageMap, inDegree, pendingQueue));
      }

      if (executing.length > 0) {
        await Promise.race(executing);
        // 移除已完成的 promise
        for (let i = executing.length - 1; i >= 0; i--) {
          const promise = executing[i];
          const done = await Promise.race([
            promise.then(() => true),
            Promise.resolve(false),
          ]);
          if (done) {
            executing.splice(i, 1);
          }
        }
      }

      // 检查是否需要停止
      if (this.failedStages.size > 0 && !this.options.continueOnFailure) {
        // 标记未完成的阶段为跳过
        for (const stage of stages) {
          if (!this.completedStages.has(stage.id) && !this.failedStages.has(stage.id)) {
            this.markSkipped(stage.id);
          }
        }
        break;
      }
    }
  }

  /**
   * 执行单个阶段
   */
  private async executeStage(
    stageId: string,
    stageMap: Map<string, PipelineStage>,
    inDegree: Map<string, number>,
    pendingQueue: string[]
  ): Promise<void> {
    const stage = stageMap.get(stageId);
    if (!stage) return;

    this.runningStages.add(stageId);
    this.emit('stageStart', { stageId, stageName: stage.name });

    const context: StageExecutionContext = {
      stage,
      inputs: this.collectInputs(stage, stageMap),
      outputs: new Map(),
      status: 'running',
      startedAt: new Date(),
    };

    this.executionContexts.set(stageId, context);

    try {
      // 执行阶段
      const result = await this.executeWithTimeout(stage, context);

      if (result.success) {
        this.markCompleted(stageId, result);
      } else {
        this.markFailed(stageId, result);
      }
    } catch (error) {
      this.markFailed(stageId, {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : '阶段执行失败',
        },
      });
    } finally {
      this.runningStages.delete(stageId);
      this.updatePendingQueue(stageId, stageMap, inDegree, pendingQueue);
    }
  }

  /**
   * 超时控制执行
   */
  private async executeWithTimeout(
    stage: PipelineStage,
    context: StageExecutionContext
  ): Promise<StageExecutionResult> {
    return Promise.race([
      this.executor!.execute(stage, context),
      new Promise<StageExecutionResult>((_, reject) =>
        setTimeout(
          () => reject(new Error(`阶段 ${stage.name} 执行超时`)),
          this.options.stageTimeout
        )
      ),
    ]);
  }

  /**
   * 收集输入数据
   */
  private collectInputs(
    stage: PipelineStage,
    _stageMap: Map<string, PipelineStage>
  ): Map<string, unknown> {
    const inputs = new Map<string, unknown>();

    if (stage.dependencies) {
      for (const depId of stage.dependencies) {
        const depContext = this.executionContexts.get(depId);
        if (depContext) {
          inputs.set(depId, depContext.outputs);
        }
      }
    }

    return inputs;
  }

  /**
   * 更新待执行队列
   */
  private updatePendingQueue(
    completedStageId: string,
    stageMap: Map<string, PipelineStage>,
    inDegree: Map<string, number>,
    pendingQueue: string[]
  ): void {
    for (const [stageId, degree] of inDegree) {
      if (degree > 0 && !this.completedStages.has(stageId) && !this.runningStages.has(stageId)) {
        // 减少入度
        const stage = stageMap.get(stageId);
        if (stage?.dependencies?.includes(completedStageId)) {
          inDegree.set(stageId, degree - 1);
          if (inDegree.get(stageId) === 0) {
            pendingQueue.push(stageId);
          }
        }
      }
    }
  }

  /**
   * 标记阶段完成
   */
  private markCompleted(stageId: string, result: StageExecutionResult): void {
    const context = this.executionContexts.get(stageId);
    if (context) {
      context.status = 'completed';
      context.completedAt = new Date();
      context.outputs.set('result', result.output);
    }
    this.completedStages.add(stageId);
    this.emit('stageComplete', { stageId, result });
  }

  /**
   * 标记阶段失败
   */
  private markFailed(stageId: string, result: StageExecutionResult): void {
    const context = this.executionContexts.get(stageId);
    if (context) {
      context.status = 'failed';
      context.completedAt = new Date();
      context.error = result.error;
    }
    this.failedStages.add(stageId);
    this.emit('stageFailed', { stageId, error: result.error });
  }

  /**
   * 标记阶段跳过
   */
  private markSkipped(stageId: string): void {
    const context = this.executionContexts.get(stageId);
    if (context) {
      context.status = 'skipped';
    }
    this.skippedStages.add(stageId);
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(
    _errorMessage: string,
    stages: PipelineStage[],
    _startTime: number
  ): DAGExecutionResult {
    return {
      success: false,
      executedStages: [],
      failedStages: [],
      skippedStages: stages.map(s => s.id),
      totalDuration: 0,
      stageResults: new Map(),
    };
  }

  /**
   * 创建执行结果
   */
  private createResult(totalDuration: number): DAGExecutionResult {
    const stageResults = new Map<string, StageExecutionResult>();

    for (const [stageId, context] of this.executionContexts) {
      const outputData = context.outputs.get('result') as { data?: Record<string, unknown>; artifacts?: string[]; duration?: number } | undefined;
      stageResults.set(stageId, {
        success: context.status === 'completed',
        output: outputData,
        error: context.error,
        duration: context.completedAt && context.startedAt
          ? context.completedAt.getTime() - context.startedAt.getTime()
          : undefined,
      });
    }

    return {
      success: this.failedStages.size === 0,
      executedStages: [...this.completedStages, ...this.failedStages],
      failedStages: [...this.failedStages],
      skippedStages: [...this.skippedStages],
      totalDuration,
      stageResults,
    };
  }

  /**
   * 获取执行上下文
   */
  getContext(stageId: string): StageExecutionContext | undefined {
    return this.executionContexts.get(stageId);
  }

  /**
   * 获取执行状态摘要
   */
  getStatusSummary(): {
    total: number;
    completed: number;
    running: number;
    failed: number;
  } {
    return {
      total: this.executionContexts.size,
      completed: this.completedStages.size,
      running: this.runningStages.size,
      failed: this.failedStages.size,
    };
  }
}
