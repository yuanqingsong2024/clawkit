/**
 * DAG 执行引擎
 * 实现流水线 DAG 拓扑排序和执行
 */

import type {
  PipelineDefinition,
  PipelineNodeConfig,
  PipelineExecution,
  PipelineExecutionContext,
  PipelineEvent,
  DAGGraph,
  DAGNode,
  NodeOutput,
  NodeExecutionRequest,
  NodeExecutionResponse,
} from '../types/pipeline.types';

/**
 * DAG 验证结果
 */
interface DAGValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 节点执行器函数类型
 */
type NodeExecutorFn = (request: NodeExecutionRequest) => Promise<NodeExecutionResponse>;

/**
 * 条件解析器函数类型
 */
type ConditionEvaluatorFn = (condition: string, context: Record<string, unknown>) => boolean;

/**
 * DAG 执行引擎
 */
export class DAGExecutionEngine {
  private executorFn?: NodeExecutorFn;
  private conditionEvaluatorFn?: ConditionEvaluatorFn;
  private eventListeners: Map<string, Set<(event: PipelineEvent) => void>> = new Map();

  /**
   * 设置节点执行器
   */
  setNodeExecutor(fn: NodeExecutorFn): void {
    this.executorFn = fn;
  }

  /**
   * 设置条件解析器
   */
  setConditionEvaluator(fn: ConditionEvaluatorFn): void {
    this.conditionEvaluatorFn = fn;
  }

  /**
   * 添加事件监听器
   */
  addEventListener(type: string, listener: (event: PipelineEvent) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(type: string, listener: (event: PipelineEvent) => void): void {
    this.eventListeners.get(type)?.delete(listener);
  }

  /**
   * 发射事件
   */
  private emit(event: PipelineEvent): void {
    this.eventListeners.get(event.type)?.forEach((listener) => listener(event));
    // 触发通配符监听器
    this.eventListeners.get('*')?.forEach((listener) => listener(event));
  }

  /**
   * 验证 DAG 是否有环
   */
  private validateDAG(nodes: PipelineNodeConfig[]): DAGValidationResult {
    const errors: string[] = [];

    // 检查重复节点 ID
    const nodeIds = new Set<string>();
    for (const node of nodes) {
      if (nodeIds.has(node.id)) {
        errors.push(`节点 ID 重复: ${node.id}`);
      }
      nodeIds.add(node.id);
    }

    // 检查自循环
    for (const node of nodes) {
      if (node.dependsOn?.includes(node.id)) {
        errors.push(`节点 ${node.id} 依赖于自身`);
      }
    }

    // 检查循环依赖（使用 DFS）
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const adjacencyList = new Map<string, string[]>();

    // 构建邻接表
    for (const node of nodes) {
      adjacencyList.set(node.id, node.dependsOn || []);
    }

    // DFS 检测环
    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const dependencies = adjacencyList.get(nodeId) || [];
      for (const dep of dependencies) {
        if (!visited.has(dep)) {
          if (hasCycle(dep)) {
            return true;
          }
        } else if (recursionStack.has(dep)) {
          errors.push(`检测到循环依赖: ${nodeId} -> ${dep}`);
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        hasCycle(node.id);
      }
    }

    // 检查缺失的依赖节点
    for (const node of nodes) {
      if (node.dependsOn) {
        for (const dep of node.dependsOn) {
          if (!nodeIds.has(dep)) {
            errors.push(`节点 ${node.id} 依赖的节点 ${dep} 不存在`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 构建 DAG 图
   */
  buildDAGGraph(definition: PipelineDefinition): DAGGraph {
    const nodes = new Map<string, DAGNode>();
    const dependents = new Map<string, string[]>();

    // 初始化节点
    for (const config of definition.nodes) {
      nodes.set(config.id, {
        id: config.id,
        inDegree: 0,
        outDegree: 0,
        dependencies: config.dependsOn || [],
        dependents: [],
        config,
      });
      dependents.set(config.id, []);
    }

    // 计算入度和出度
    for (const config of definition.nodes) {
      const node = nodes.get(config.id)!;
      node.dependencies = config.dependsOn || [];

      for (const dep of node.dependencies) {
        const depNode = nodes.get(dep);
        if (depNode) {
          depNode.outDegree++;
          node.inDegree++;

          // 添加后续节点引用
          const depDependents = dependents.get(dep) || [];
          depDependents.push(config.id);
          dependents.set(dep, depDependents);
        }
      }
    }

    // 拓扑排序（Kahn 算法）
    const topologicalOrder: string[] = [];
    const queue: string[] = [];

    // 找到所有入度为 0 的节点
    for (const [nodeId, node] of nodes) {
      if (node.inDegree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      topologicalOrder.push(nodeId);

      const nodeDependents = dependents.get(nodeId) || [];
      for (const dependentId of nodeDependents) {
        const dependentNode = nodes.get(dependentId)!;
        dependentNode.inDegree--;

        if (dependentNode.inDegree === 0) {
          queue.push(dependentId);
        }
      }
    }

    // 计算层级（用于并行优化）
    const levels = new Map<string, number>();
    for (const nodeId of topologicalOrder) {
      const node = nodes.get(nodeId)!;
      let maxDepLevel = 0;

      for (const dep of node.dependencies) {
        const depLevel = levels.get(dep) || 0;
        maxDepLevel = Math.max(maxDepLevel, depLevel);
      }

      levels.set(nodeId, maxDepLevel + 1);
    }

    return {
      nodes,
      topologicalOrder,
      levels,
    };
  }

  /**
   * 验证流水线定义
   */
  validatePipeline(definition: PipelineDefinition): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 基本验证
    if (!definition.id) {
      errors.push('缺少流水线 ID');
    }
    if (!definition.name) {
      errors.push('缺少流水线名称');
    }
    if (!definition.nodes || definition.nodes.length === 0) {
      errors.push('流水线至少需要一个节点');
    }

    // DAG 验证
    const dagResult = this.validateDAG(definition.nodes);
    errors.push(...dagResult.errors);

    // 检查孤立节点
    const connectedNodes = new Set<string>();
    for (const node of definition.nodes) {
      if (node.dependsOn) {
        connectedNodes.add(node.id);
        node.dependsOn.forEach((dep) => connectedNodes.add(dep));
      }
    }
    for (const node of definition.nodes) {
      if (!connectedNodes.has(node.id) && definition.nodes.length > 1) {
        warnings.push(`节点 ${node.id} 没有依赖关系，可能是孤立节点`);
      }
    }

    // 检查触发器节点
    const hasTrigger = definition.nodes.some((n) => n.type === 'trigger');
    if (!hasTrigger) {
      warnings.push('流水线没有触发器节点，将自动开始执行');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 创建执行上下文
   */
  createExecutionContext(execution: PipelineExecution): PipelineExecutionContext {
    return {
      executionId: execution.id,
      variables: { ...execution.context?.variables || {} },
      nodeOutputs: new Map(),
      history: [],
    };
  }

  /**
   * 获取可执行的节点
   */
  private getExecutableNodes(
    graph: DAGGraph,
    completedNodes: Set<string>,
    runningNodes: Set<string>,
    context: PipelineExecutionContext,
  ): string[] {
    const executable: string[] = [];

    for (const [nodeId, node] of graph.nodes) {
      // 跳过已完成的节点
      if (completedNodes.has(nodeId)) {
        continue;
      }

      // 跳过正在运行的节点
      if (runningNodes.has(nodeId)) {
        continue;
      }

      // 检查所有依赖是否已完成
      const allDependenciesMet = node.dependencies.every((dep) => completedNodes.has(dep));

      if (allDependenciesMet) {
        // 如果是条件节点，检查条件
        if (node.config.type === 'condition' && node.config.condition) {
          if (this.conditionEvaluatorFn) {
            const conditionMet = this.conditionEvaluatorFn(
              node.config.condition,
              context.variables as Record<string, unknown>,
            );
            if (!conditionMet) {
              completedNodes.add(nodeId); // 条件不满足，跳过
              continue;
            }
          }
        }

        executable.push(nodeId);
      }
    }

    return executable;
  }

  /**
   * 执行节点
   */
  private async executeNode(
    nodeId: string,
    context: PipelineExecutionContext,
    execution: PipelineExecution,
  ): Promise<NodeOutput> {
    const startTime = Date.now();

    this.emit({
      type: 'pipeline:node:started',
      executionId: execution.id,
      pipelineId: execution.pipelineId,
      nodeId,
      timestamp: startTime,
    });

    let result: unknown;
    let error: string | undefined;

    try {
      if (this.executorFn) {
        const response = await this.executorFn({
          executionId: execution.id,
          nodeId,
          config: execution.context ? { id: nodeId } as PipelineNodeConfig : { id: nodeId } as PipelineNodeConfig,
          context,
        });

        if (!response.success) {
          throw new Error(response.error || '节点执行失败');
        }

        result = response.result;
      } else {
        // 默认执行：模拟任务节点
        await new Promise((resolve) => setTimeout(resolve, 100));
        result = { message: '节点执行完成', nodeId };
      }

      context.history.push({
        nodeId,
        action: 'completed',
        timestamp: Date.now(),
      });

      this.emit({
        type: 'pipeline:node:completed',
        executionId: execution.id,
        pipelineId: execution.pipelineId,
        nodeId,
        timestamp: Date.now(),
        data: result,
      });

      return {
        nodeId,
        result,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        status: 'completed',
      };
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);

      this.emit({
        type: 'pipeline:node:failed',
        executionId: execution.id,
        pipelineId: execution.pipelineId,
        nodeId,
        timestamp: Date.now(),
        data: { error },
      });

      return {
        nodeId,
        error,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        status: 'failed',
      };
    }
  }

  /**
   * 执行流水线
   */
  async execute(
    definition: PipelineDefinition,
    execution: PipelineExecution,
  ): Promise<PipelineExecution> {
    const startTime = Date.now();

    this.emit({
      type: 'pipeline:started',
      executionId: execution.id,
      pipelineId: definition.id,
      timestamp: startTime,
    });

    // 验证流水线
    const validation = this.validatePipeline(definition);
    if (!validation.valid) {
      execution.status = 'failed';
      execution.error = `流水线验证失败: ${validation.errors.join(', ')}`;
      execution.endTime = Date.now();
      execution.duration = execution.endTime - startTime;
      return execution;
    }

    // 构建 DAG
    const graph = this.buildDAGGraph(definition);

    // 初始化上下文
    const context = this.createExecutionContext(execution);
    context.variables = { ...definition.variables, ...context.variables };

    // 跟踪执行状态
    const completedNodes = new Set<string>();
    const runningNodes = new Set<string>();
    const failedNodes = new Set<string>();
    const nodeOutputs = new Map<string, NodeOutput>();

    try {
      // 执行直到所有节点完成或失败
      while (completedNodes.size < definition.nodes.length) {
        // 获取可执行的节点
        const executableNodes = this.getExecutableNodes(graph, completedNodes, runningNodes, context);

        if (executableNodes.length === 0) {
          // 没有可执行的节点，但还有未完成的节点，检查是否有失败
          if (failedNodes.size > 0) {
            break; // 有失败节点，停止执行
          }
          break; // 理论上不应该到这里
        }

        // 并行执行可执行的节点（同一层级的）
        const promises = executableNodes.map(async (nodeId) => {
          runningNodes.add(nodeId);

          const output = await this.executeNode(nodeId, context, execution);

          runningNodes.delete(nodeId);
          nodeOutputs.set(nodeId, output);

          if (output.status === 'failed') {
            failedNodes.add(nodeId);
            completedNodes.add(nodeId);
          } else {
            completedNodes.add(nodeId);
            context.nodeOutputs.set(nodeId, output.result);
          }
        });

        await Promise.all(promises);
      }

      // 确定最终状态
      if (failedNodes.size > 0) {
        execution.status = 'failed';
        execution.error = `${failedNodes.size} 个节点执行失败`;
      } else {
        execution.status = 'completed';
      }
    } catch (err) {
      execution.status = 'failed';
      execution.error = err instanceof Error ? err.message : String(err);
    }

    execution.nodeResults = nodeOutputs;
    execution.endTime = Date.now();
    execution.duration = execution.endTime - startTime;

    if (execution.status === 'completed') {
      this.emit({
        type: 'pipeline:completed',
        executionId: execution.id,
        pipelineId: definition.id,
        timestamp: execution.endTime,
      });
    } else {
      this.emit({
        type: 'pipeline:failed',
        executionId: execution.id,
        pipelineId: definition.id,
        timestamp: execution.endTime,
        data: { error: execution.error },
      });
    }

    return execution;
  }
}

/**
 * 创建 DAG 执行引擎
 */
export function createDAGExecutionEngine(): DAGExecutionEngine {
  return new DAGExecutionEngine();
}
