/**
 * DAG 执行引擎
 * 负责根据依赖关系调度和执行流水线阶段
 */

import type { PipelineDefinition, PipelineExecution, PipelineValidationResult, DAGGraph, DAGNode, PipelineNodeStatus } from '../types/pipeline.types';
import { EventEmitter } from 'events';

// ============================================================================
// 原始接口（向后兼容）
// ============================================================================

export interface StageExecutionContext {
  stage: {
    id: string;
    name: string;
    dependencies?: string[];
  };
  inputs: Map<string, unknown>;
  outputs: Map<string, unknown>;
  status: PipelineNodeStatus;
  startedAt?: Date;
  completedAt?: Date;
  error?: { code: string; message: string };
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
  error?: { code: string; message: string };
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
  execute(stage: { id: string; name: string; dependencies?: string[] }, context: StageExecutionContext): Promise<StageExecutionResult>;
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
  async execute(stages: Array<{ id: string; name: string; dependencies?: string[] }>): Promise<DAGExecutionResult> {
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
  private detectCycle(stages: Array<{ id: string; dependencies?: string[] }>): string | null {
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
  private calculateInDegree(stages: Array<{ id: string; dependencies?: string[] }>): Map<string, number> {
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
    _stages: Array<{ id: string }>,
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
    stages: Array<{ id: string; name: string; dependencies?: string[] }>,
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
    stageMap: Map<string, { id: string; name: string; dependencies?: string[] }>,
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
    stage: { id: string; name: string; dependencies?: string[] },
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
    stage: { id: string; dependencies?: string[] },
    _stageMap: Map<string, { id: string }>
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
    stageMap: Map<string, { id: string; dependencies?: string[] }>,
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
    stages: Array<{ id: string }>,
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

// ============================================================================
// 测试需要的接口（基于 PipelineDefinition）
// ============================================================================

export interface DAGExecutionEngine extends EventEmitter {
  // 验证流水线
  validatePipeline(pipeline: PipelineDefinition): PipelineValidationResult;
  // 构建 DAG 图
  buildDAGGraph(pipeline: PipelineDefinition): DAGGraph;
  // 执行流水线
  execute(pipeline: PipelineDefinition, execution: PipelineExecution): Promise<PipelineExecution>;
  // 设置节点执行器
  setNodeExecutor(executor: NodeExecutor): void;
}

/**
 * 节点执行器函数类型
 */
export type NodeExecutor = (req: NodeExecutionRequest) => Promise<NodeExecutionResponse>;

export interface NodeExecutionRequest {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  config: Record<string, unknown>;
  context: PipelineExecution['context'];
  dependencies: Array<{ nodeId: string; output: unknown }>;
}

export interface NodeExecutionResponse {
  success: boolean;
  nodeId: string;
  result?: unknown;
  error?: string;
  startTime: number;
  endTime: number;
  status: PipelineNodeStatus;
}

/**
 * DAG 执行引擎实现（基于 PipelineDefinition）
 */
export class DefaultDAGExecutionEngine extends EventEmitter implements DAGExecutionEngine {
  private nodeExecutor?: NodeExecutor;

  constructor() {
    super();
  }

  /**
   * 兼容浏览器 addEventListener API
   */
  addEventListener(event: string, handler: (...args: unknown[]) => void): void {
    this.on(event, handler);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(event: string, handler: (...args: unknown[]) => void): void {
    this.off(event, handler);
  }

  /**
   * 设置节点执行器
   */
  setNodeExecutor(executor: NodeExecutor): void {
    this.nodeExecutor = executor;
  }

  /**
   * 验证流水线配置
   */
  validatePipeline(pipeline: PipelineDefinition): PipelineValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查是否至少有节点
    if (!pipeline.nodes || pipeline.nodes.length === 0) {
      errors.push('至少需要一个节点');
      return { valid: false, errors, warnings };
    }

    // 检查重复的节点 ID
    const nodeIds = new Set<string>();
    for (const node of pipeline.nodes) {
      if (nodeIds.has(node.id)) {
        errors.push(`节点 ID 重复: ${node.id}`);
      }
      nodeIds.add(node.id);
    }

    // 检查依赖节点是否存在
    for (const node of pipeline.nodes) {
      if (node.dependsOn) {
        for (const depId of node.dependsOn) {
          if (!nodeIds.has(depId)) {
            errors.push(`节点 ${node.id} 依赖的节点 ${depId} 不存在`);
          }
          // 检查自循环
          if (depId === node.id) {
            errors.push(`节点 ${node.id} 依赖于自身`);
          }
        }
      }
    }

    // 检测循环依赖
    const cycleError = this.detectCycle(pipeline.nodes);
    if (cycleError) {
      errors.push(cycleError);
    }

    // 检测孤立节点
    const connectedNodes = this.findConnectedNodes(pipeline.nodes);
    for (const node of pipeline.nodes) {
      if (!connectedNodes.has(node.id)) {
        warnings.push(`节点 ${node.id} 是孤立节点，不被任何其他节点依赖也不依赖任何节点`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 检测循环依赖
   */
  private detectCycle(nodes: PipelineDefinition['nodes']): string | null {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    const dfs = (nodeId: string, path: string[]): string | null => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = nodeMap.get(nodeId);
      if (node?.dependsOn) {
        for (const depId of node.dependsOn) {
          if (!visited.has(depId)) {
            const cycle = dfs(depId, [...path, nodeId]);
            if (cycle) return cycle;
          } else if (recursionStack.has(depId)) {
            return `检测到循环依赖: ${[...path, nodeId, depId].join(' -> ')}`;
          }
        }
      }

      recursionStack.delete(nodeId);
      return null;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        const cycle = dfs(node.id, []);
        if (cycle) return cycle;
      }
    }

    return null;
  }

  /**
   * 查找连接的节点
   */
  private findConnectedNodes(nodes: PipelineDefinition['nodes']): Set<string> {
    const connected = new Set<string>();

    // 添加所有被依赖的节点
    for (const node of nodes) {
      if (node.dependsOn) {
        for (const depId of node.dependsOn) {
          connected.add(depId);
          connected.add(node.id);
        }
      }
    }

    return connected;
  }

  /**
   * 构建 DAG 图
   */
  buildDAGGraph(pipeline: PipelineDefinition): DAGGraph {
    const nodes = new Map<string, DAGNode>();
    const edges: Array<[string, string]> = [];
    const levels = new Map<string, number>();

    // 构建节点映射（使用类型定义的 DAGNode）
    for (const node of pipeline.nodes) {
      nodes.set(node.id, {
        id: node.id,
        inDegree: 0,
        outDegree: 0,
        dependencies: node.dependsOn || [],
        dependents: [],
        config: node.config || {},
      });
    }

    // 构建边和计算层级
    for (const node of pipeline.nodes) {
      if (node.dependsOn) {
        for (const depId of node.dependsOn) {
          edges.push([depId, node.id]);

          // 更新入度和出度
          const depNode = nodes.get(depId);
          const currentNode = nodes.get(node.id);
          if (depNode && currentNode) {
            depNode.outDegree++;
            currentNode.inDegree++;
          }

          // 计算层级：子节点的层级 = 父节点层级 + 1
          const parentLevel = levels.get(depId) || 1;
          const currentLevel = levels.get(node.id) || 1;
          levels.set(node.id, Math.max(currentLevel, parentLevel + 1));
        }
      } else if (!levels.has(node.id)) {
        levels.set(node.id, 1);
      }
    }

    // 拓扑排序
    const topologicalOrder = this.topologicalSort(pipeline.nodes);

    return {
      nodes,
      topologicalOrder,
      levels,
    };
  }

  /**
   * 拓扑排序
   */
  private topologicalSort(nodes: PipelineDefinition['nodes']): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    const dfs = (nodeId: string): void => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = nodeMap.get(nodeId);
      if (node?.dependsOn) {
        for (const depId of node.dependsOn) {
          dfs(depId);
        }
      }

      result.push(nodeId);
    };

    for (const node of nodes) {
      dfs(node.id);
    }

    return result;
  }

  /**
   * 执行流水线
   */
  async execute(pipeline: PipelineDefinition, execution: PipelineExecution): Promise<PipelineExecution> {
    if (!this.nodeExecutor) {
      throw new Error('未设置节点执行器');
    }

    this.emit('pipeline:started', { pipeline, execution });

    // 按层级分组执行
    const graph = this.buildDAGGraph(pipeline);
    const levels = new Map<number, string[]>();
    for (const [nodeId, level] of graph.levels) {
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level)!.push(nodeId);
    }

    // 按层级顺序执行
    const sortedLevels = [...levels.keys()].sort((a, b) => a - b);

    for (const level of sortedLevels) {
      const nodesAtLevel = levels.get(level)!;

      // 同一层级的节点可以并行执行
      const promises = nodesAtLevel.map(async (nodeId) => {
        const node = pipeline.nodes.find(n => n.id === nodeId)!;
        
        // 收集依赖输出
        const dependencies: Array<{ nodeId: string; output: unknown }> = [];
        if (node.dependsOn) {
          for (const depId of node.dependsOn) {
            const depResult = execution.nodeResults.get(depId);
            if (depResult) {
              dependencies.push({ nodeId: depId, output: depResult });
            }
          }
        }

        this.emit('pipeline:node:started', { nodeId, node });

        const response = await this.nodeExecutor!({
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          config: node.config || {},
          context: execution.context,
          dependencies,
        });

        execution.nodeResults.set(nodeId, response);

        this.emit('pipeline:node:completed', { nodeId, response });

        return response;
      });

      const results = await Promise.all(promises);

      // 检查是否有失败
      const hasFailure = results.some(r => !r.success);
      if (hasFailure) {
        execution.status = 'failed';
        const failedNode = results.find(r => !r.success);
        execution.error = `节点 ${failedNode?.nodeId} 执行失败: ${failedNode?.error}`;
        this.emit('pipeline:failed', { execution, error: execution.error });
        return execution;
      }
    }

    execution.status = 'completed';
    this.emit('pipeline:completed', { execution });

    return execution;
  }
}

/**
 * 创建 DAG 执行引擎实例
 */
export function createDAGExecutionEngine(): DAGExecutionEngine {
  return new DefaultDAGExecutionEngine();
}
