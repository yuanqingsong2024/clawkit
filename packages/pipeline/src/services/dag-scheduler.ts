/**
 * DAG 调度器
 * 负责管理 DAG 图的构建、拓扑排序和节点调度
 */

import {
  PipelineDefinition,
  PipelineNodeConfig,
  NodeType,
  NodeStatus,
  NodeExecutionResult,
  PipelineExecutionState,
  PipelineExecutionContext,
  NodeExecutionContext,
  PipelineStatus,
} from '../types/pipeline.types';

/**
 * DAG 节点
 */
interface DAGNode {
  /** 节点配置 */
  config: PipelineNodeConfig;
  /** 入度（依赖该节点的数量） */
  inDegree: number;
  /** 出度（该节点依赖的数量） */
  outDegree: number;
  /** 是否被访问过 */
  visited: boolean;
}

/**
 * DAG 图
 */
export class DAGGraph {
  private nodes: Map<string, DAGNode> = new Map();
  private adjacencyList: Map<string, string[]> = new Map();
  private reverseAdjacencyList: Map<string, string[]> = new Map();

  constructor(pipeline: PipelineDefinition) {
    this.buildGraph(pipeline);
  }

  /**
   * 构建 DAG 图
   */
  private buildGraph(pipeline: PipelineDefinition): void {
    // 添加所有节点
    for (const nodeConfig of pipeline.nodes) {
      this.addNode(nodeConfig);
    }

    // 添加边（依赖关系）
    for (const nodeConfig of pipeline.nodes) {
      if (nodeConfig.dependsOn && nodeConfig.dependsOn.length > 0) {
        for (const depId of nodeConfig.dependsOn) {
          this.addEdge(depId, nodeConfig.id);
        }
      }
    }
  }

  /**
   * 添加节点
   */
  private addNode(config: PipelineNodeConfig): void {
    if (!this.nodes.has(config.id)) {
      this.nodes.set(config.id, {
        config,
        inDegree: 0,
        outDegree: 0,
        visited: false,
      });
      this.adjacencyList.set(config.id, []);
      this.reverseAdjacencyList.set(config.id, []);
    }
  }

  /**
   * 添加边
   */
  private addEdge(fromId: string, toId: string): void {
    // 添加正向边（from -> to）
    const adjList = this.adjacencyList.get(fromId);
    if (adjList && !adjList.includes(toId)) {
      adjList.push(toId);
    }

    // 添加反向边（to <- from）
    const reverseList = this.reverseAdjacencyList.get(toId);
    if (reverseList && !reverseList.includes(fromId)) {
      reverseList.push(fromId);
    }

    // 更新入度和出度
    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);
    if (fromNode) fromNode.outDegree++;
    if (toNode) toNode.inDegree++;
  }

  /**
   * 检测 DAG 是否有环（拓扑排序）
   */
  hasCycle(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = this.adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) return true;
      }
    }

    return false;
  }

  /**
   * 获取拓扑排序结果
   */
  topologicalSort(): string[] {
    const result: string[] = [];
    const inDegree = new Map<string, number>();

    // 初始化入度
    for (const [nodeId, node] of this.nodes) {
      inDegree.set(nodeId, node.inDegree);
    }

    // 将入度为 0 的节点加入队列
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      const neighbors = this.adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        const currentDegree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, currentDegree);
        if (currentDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  /**
   * 获取入口节点（入度为 0 的节点）
   */
  getEntryNodes(): string[] {
    const entryNodes: string[] = [];
    for (const [nodeId, node] of this.nodes) {
      if (node.inDegree === 0) {
        entryNodes.push(nodeId);
      }
    }
    return entryNodes;
  }

  /**
   * 获取出口节点（出度为 0 的节点）
   */
  getExitNodes(): string[] {
    const exitNodes: string[] = [];
    for (const [nodeId, node] of this.nodes) {
      if (node.outDegree === 0) {
        exitNodes.push(nodeId);
      }
    }
    return exitNodes;
  }

  /**
   * 获取节点的直接依赖节点
   */
  getDependencies(nodeId: string): string[] {
    return this.reverseAdjacencyList.get(nodeId) || [];
  }

  /**
   * 获取节点的后继节点
   */
  getSuccessors(nodeId: string): string[] {
    return this.adjacencyList.get(nodeId) || [];
  }

  /**
   * 获取所有节点配置
   */
  getAllNodes(): Map<string, DAGNode> {
    return this.nodes;
  }

  /**
   * 获取指定节点
   */
  getNode(nodeId: string): DAGNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * 获取节点深度（从入口到该节点的最长路径）
   */
  getNodeDepth(nodeId: string): number {
    const visited = new Set<string>();
    
    const dfs = (id: string, depth: number): number => {
      if (visited.has(id)) return depth;
      visited.add(id);

      const deps = this.getDependencies(id);
      if (deps.length === 0) return depth;

      let maxDepth = depth;
      for (const depId of deps) {
        maxDepth = Math.max(maxDepth, dfs(depId, depth + 1));
      }
      return maxDepth;
    };

    return dfs(nodeId, 0);
  }

  /**
   * 计算并行层级
   * 同一层级的节点可以并行执行
   */
  getParallelLayers(): string[][] {
    const layers: string[][] = [];
    const assigned = new Set<string>();

    const entryNodes = this.getEntryNodes();
    const queue: { nodeId: string; layer: number }[] = entryNodes.map(id => ({ nodeId: id, layer: 0 }));

    while (queue.length > 0) {
      const { nodeId, layer } = queue.shift()!;

      if (assigned.has(nodeId)) continue;
      assigned.add(nodeId);

      if (!layers[layer]) {
        layers[layer] = [];
      }
      layers[layer].push(nodeId);

      const successors = this.getSuccessors(nodeId);
      for (const successor of successors) {
        const deps = this.getDependencies(successor);
        const allDepsAssigned = deps.every(depId => assigned.has(depId));
        if (allDepsAssigned) {
          queue.push({ nodeId: successor, layer: layer + 1 });
        }
      }
    }

    return layers;
  }
}

/**
 * DAG 调度器配置
 */
export interface DAGSchedulerConfig {
  /** 最大并发任务数 */
  maxConcurrency: number;
  /** 是否启用并行执行 */
  enableParallel: boolean;
  /** 节点执行超时时间（毫秒） */
  defaultNodeTimeout: number;
}

/**
 * DAG 调度器
 * 负责调度 DAG 图中的节点执行
 */
export class DAGScheduler {
  private config: DAGSchedulerConfig;
  private graph: DAGGraph;
  private executionState: PipelineExecutionState;
  private context: PipelineExecutionContext;
  private pendingNodes: Set<string> = new Set();
  private runningNodes: Map<string, Promise<NodeExecutionResult>> = new Map();
  private nodeExecutor: (context: NodeExecutionContext) => Promise<NodeExecutionResult>;

  constructor(
    pipeline: PipelineDefinition,
    context: PipelineExecutionContext,
    nodeExecutor: (context: NodeExecutionContext) => Promise<NodeExecutionResult>,
    config?: Partial<DAGSchedulerConfig>
  ) {
    this.graph = new DAGGraph(pipeline);
    this.context = context;
    this.nodeExecutor = nodeExecutor;

    this.config = {
      maxConcurrency: config?.maxConcurrency ?? 5,
      enableParallel: config?.enableParallel ?? true,
      defaultNodeTimeout: config?.defaultNodeTimeout ?? 300000,
    };

    // 初始化执行状态
    this.executionState = {
      executionId: context.executionId,
      pipelineId: pipeline.id,
      pipelineVersion: pipeline.version,
      status: PipelineStatus.PENDING,
      nodeStates: new Map(),
      startTime: Date.now(),
    };

    // 初始化所有节点状态
    for (const node of pipeline.nodes) {
      this.executionState.nodeStates.set(node.id, {
        nodeId: node.id,
        status: NodeStatus.WAITING,
        startTime: 0,
        retryCount: 0,
      });
    }
  }

  /**
   * 执行调度
   */
  async schedule(): Promise<PipelineExecutionState> {
    // 检测循环依赖
    if (this.graph.hasCycle()) {
      this.executionState.status = PipelineStatus.FAILED;
      this.executionState.error = '流水线存在循环依赖';
      return this.executionState;
    }

    this.executionState.status = PipelineStatus.RUNNING;

    // 获取并行层级
    if (this.config.enableParallel) {
      await this.scheduleParallel();
    } else {
      await this.scheduleSequential();
    }

    return this.executionState;
  }

  /**
   * 串行调度（按拓扑顺序）
   */
  private async scheduleSequential(): Promise<void> {
    const sortedNodes = this.graph.topologicalSort();

    for (const nodeId of sortedNodes) {
      // 检查是否应该继续执行
      if (this.shouldStop()) break;

      // 检查前置依赖是否完成
      if (!this.areDependenciesMet(nodeId)) {
        this.updateNodeStatus(nodeId, NodeStatus.SKIPPED);
        continue;
      }

      await this.executeNode(nodeId);
    }

    this.finalizeExecution();
  }

  /**
   * 并行调度（按层级并行执行）
   */
  private async scheduleParallel(): Promise<void> {
    const layers = this.graph.getParallelLayers();

    for (const layer of layers) {
      // 检查是否应该停止
      if (this.shouldStop()) break;

      // 过滤可执行的节点
      const executableNodes = layer.filter(nodeId => this.areDependenciesMet(nodeId));

      if (executableNodes.length === 0) continue;

      // 分批执行（控制并发数）
      for (let i = 0; i < executableNodes.length; i += this.config.maxConcurrency) {
        const batch = executableNodes.slice(i, i + this.config.maxConcurrency);
        await Promise.all(batch.map(nodeId => this.executeNode(nodeId)));
      }
    }

    this.finalizeExecution();
  }

  /**
   * 检查前置依赖是否都完成
   */
  private areDependenciesMet(nodeId: string): boolean {
    const dependencies = this.graph.getDependencies(nodeId);
    
    for (const depId of dependencies) {
      const state = this.executionState.nodeStates.get(depId);
      if (!state) continue;
      
      // 如果依赖节点失败，且不允许失败，则该节点不能执行
      if (state.status === NodeStatus.FAILED) {
        const node = this.graph.getNode(nodeId);
        if (node && !node.config.allowFailure) {
          return false;
        }
      }
      
      // 如果依赖节点未完成，则该节点不能执行
      if (state.status !== NodeStatus.SUCCESS && state.status !== NodeStatus.SKIPPED) {
        return false;
      }
    }

    return true;
  }

  /**
   * 执行单个节点
   */
  private async executeNode(nodeId: string): Promise<NodeExecutionResult> {
    const node = this.graph.getNode(nodeId);
    if (!node) {
      throw new Error(`节点 ${nodeId} 不存在`);
    }

    // 更新节点状态为运行中
    this.updateNodeStatus(nodeId, NodeStatus.RUNNING);

    const startTime = Date.now();
    const nodeContext: NodeExecutionContext = {
      node: node.config,
      pipelineContext: this.context,
      upstreamResults: this.executionState.nodeStates,
      result: {
        nodeId,
        status: NodeStatus.RUNNING,
        startTime,
        retryCount: 0,
      },
    };

    try {
      const result = await Promise.race([
        this.nodeExecutor(nodeContext),
        this.createTimeoutPromise(node.config.timeout || this.config.defaultNodeTimeout),
      ]);

      if (result.status === NodeStatus.SUCCESS) {
        this.updateNodeStatus(nodeId, NodeStatus.SUCCESS, result.output);
      } else {
        this.updateNodeStatus(nodeId, NodeStatus.FAILED, undefined, result.error);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.updateNodeStatus(nodeId, NodeStatus.FAILED, undefined, errorMessage);
      return this.executionState.nodeStates.get(nodeId)!;
    }
  }

  /**
   * 创建超时 Promise
   */
  private createTimeoutPromise(timeout: number): Promise<NodeExecutionResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`节点执行超时 (${timeout}ms)`));
      }, timeout);
    });
  }

  /**
   * 更新节点状态
   */
  private updateNodeStatus(
    nodeId: string,
    status: NodeStatus,
    output?: Record<string, unknown>,
    error?: string
  ): void {
    const state = this.executionState.nodeStates.get(nodeId);
    if (!state) return;

    state.status = status;
    state.endTime = Date.now();
    state.duration = state.endTime - state.startTime;
    
    if (output) state.output = output;
    if (error) state.error = error;
  }

  /**
   * 检查是否应该停止执行
   */
  private shouldStop(): boolean {
    return (
      this.executionState.status === 'cancelled' ||
      this.executionState.status === 'failed'
    );
  }

  /**
   * 完成执行
   */
  private finalizeExecution(): void {
    // 检查是否有失败的节点
    let hasFailed = false;
    let allSkipped = true;

    for (const [, state] of this.executionState.nodeStates) {
      if (state.status === NodeStatus.FAILED) {
        hasFailed = true;
      }
      if (state.status !== NodeStatus.SKIPPED) {
        allSkipped = false;
      }
    }

    this.executionState.endTime = Date.now();
    this.executionState.duration = this.executionState.endTime - this.executionState.startTime;

    if (hasFailed) {
      this.executionState.status = PipelineStatus.FAILED;
    } else if (allSkipped) {
      this.executionState.status = PipelineStatus.SUCCESS;
    } else {
      this.executionState.status = PipelineStatus.SUCCESS;
    }
  }

  /**
   * 取消执行
   */
  cancel(): void {
    this.executionState.status = PipelineStatus.CANCELLED;
    
    // 取消正在运行的节点
    for (const [nodeId, promise] of this.runningNodes) {
      this.updateNodeStatus(nodeId, NodeStatus.CANCELLED);
    }
  }

  /**
   * 获取执行状态
   */
  getExecutionState(): PipelineExecutionState {
    return this.executionState;
  }

  /**
   * 获取 DAG 图
   */
  getGraph(): DAGGraph {
    return this.graph;
  }
}
