/**
 * 流水线编辑器 API
 * 提供流水线编辑的统一接口
 */

import {
  PipelineDefinition,
  PipelineNodeConfig,
  PipelineExecutionState,
  PipelineExecutionOptions,
  DAGVisualData,
  DAGVisualNode,
  DAGVisualEdge,
  NodeType,
  ValidationResult,
} from '../types/pipeline.types';
import { PipelineEngine } from '../services/pipeline-engine';

/**
 * 流水线编辑器状态
 */
export interface PipelineEditorState {
  /** 当前流水线 */
  pipeline: PipelineDefinition | null;
  /** DAG 可视化数据 */
  dagData: DAGVisualData;
  /** 选中节点 */
  selectedNodeId: string | null;
  /** 缩放级别 */
  zoom: number;
  /** 平移偏移 */
  pan: { x: number; y: number };
  /** 是否保存 */
  isDirty: boolean;
  /** 验证结果 */
  validation: ValidationResult | null;
}

/**
 * 节点创建选项
 */
export interface CreateNodeOptions {
  /** 节点类型 */
  type: NodeType;
  /** 节点名称 */
  name?: string;
  /** 位置 */
  position?: { x: number; y: number };
  /** 配置 */
  config?: Partial<PipelineNodeConfig>;
}

/**
 * 流水线编辑器 API
 */
export class PipelineEditorApi {
  private engine: PipelineEngine;
  private state: PipelineEditorState;
  private listeners: Set<(state: PipelineEditorState) => void> = new Set();

  constructor(engine?: PipelineEngine) {
    this.engine = engine || new PipelineEngine();
    this.state = {
      pipeline: null,
      dagData: { nodes: [], edges: [] },
      selectedNodeId: null,
      zoom: 1,
      pan: { x: 0, y: 0 },
      isDirty: false,
      validation: null,
    };
  }

  /**
   * 创建新流水线
   */
  createPipeline(name?: string): PipelineDefinition {
    const pipeline = this.engine.createPipeline();
    if (name) {
      pipeline.name = name;
    }
    this.setPipeline(pipeline);
    return pipeline;
  }

  /**
   * 加载流水线
   */
  loadPipeline(yamlOrJson: string): PipelineDefinition {
    const pipeline = this.engine.createPipeline(yamlOrJson);
    this.setPipeline(pipeline);
    return pipeline;
  }

  /**
   * 设置流水线
   */
  private setPipeline(pipeline: PipelineDefinition): void {
    this.state.pipeline = pipeline;
    this.state.dagData = this.engine.toDAGVisualData(pipeline);
    this.state.selectedNodeId = null;
    this.state.isDirty = false;
    this.state.validation = null;
    this.notifyListeners();
  }

  /**
   * 获取当前状态
   */
  getState(): PipelineEditorState {
    return { ...this.state };
  }

  /**
   * 订阅状态变化
   */
  subscribe(listener: (state: PipelineEditorState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 通知监听器
   */
  private notifyListeners(): void {
    const currentState = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(currentState);
      } catch (error) {
        console.error('[PipelineEditorApi] 监听器错误:', error);
      }
    }
  }

  /**
   * 添加节点
   */
  addNode(options: CreateNodeOptions): DAGVisualNode {
    if (!this.state.pipeline) {
      throw new Error('未加载流水线');
    }

    const nodeId = `node-${Date.now()}`;
    const nodeConfig: PipelineNodeConfig = {
      id: nodeId,
      name: options.name || `新${this.getNodeTypeName(options.type)}`,
      type: options.type,
      ...options.config,
    };

    // 添加到流水线
    this.state.pipeline.nodes.push(nodeConfig);
    this.state.pipeline.updatedAt = Date.now();

    // 如果是第一个节点，设为入口
    if (this.state.pipeline.nodes.length === 1) {
      this.state.pipeline.entryNodeId = nodeId;
    }

    // 添加到 DAG 数据
    const visualNode: DAGVisualNode = {
      id: nodeId,
      name: nodeConfig.name,
      type: options.type,
      position: options.position || { x: 100, y: 100 },
      data: nodeConfig,
    };

    this.state.dagData.nodes.push(visualNode);

    this.state.isDirty = true;
    this.notifyListeners();

    return visualNode;
  }

  /**
   * 获取节点类型名称
   */
  private getNodeTypeName(type: NodeType): string {
    const names: Record<NodeType, string> = {
      [NodeType.TASK]: '任务',
      [NodeType.CONDITION]: '条件',
      [NodeType.PARALLEL]: '并行',
      [NodeType.SEQUENCE]: '串行',
      [NodeType.TRIGGER]: '触发器',
      [NodeType.END]: '结束',
    };
    return names[type] || '节点';
  }

  /**
   * 更新节点
   */
  updateNode(nodeId: string, updates: Partial<PipelineNodeConfig>): void {
    if (!this.state.pipeline) return;

    // 更新流水线中的节点
    const pipelineNode = this.state.pipeline.nodes.find(n => n.id === nodeId);
    if (pipelineNode) {
      Object.assign(pipelineNode, updates);
      this.state.pipeline.updatedAt = Date.now();
    }

    // 更新 DAG 数据中的节点
    const visualNode = this.state.dagData.nodes.find(n => n.id === nodeId);
    if (visualNode) {
      if (updates.name) visualNode.name = updates.name;
      if (updates.type) visualNode.type = updates.type;
      Object.assign(visualNode.data, updates);
    }

    this.state.isDirty = true;
    this.notifyListeners();
  }

  /**
   * 删除节点
   */
  deleteNode(nodeId: string): void {
    if (!this.state.pipeline) return;

    // 从流水线中移除
    const nodeIndex = this.state.pipeline.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex > -1) {
      this.state.pipeline.nodes.splice(nodeIndex, 1);
      this.state.pipeline.updatedAt = Date.now();
    }

    // 移除依赖关系中的引用
    for (const node of this.state.pipeline.nodes) {
      if (node.dependsOn) {
        node.dependsOn = node.dependsOn.filter(id => id !== nodeId);
      }
      if (node.trueBranch) {
        node.trueBranch = node.trueBranch.filter(id => id !== nodeId);
      }
      if (node.falseBranch) {
        node.falseBranch = node.falseBranch.filter(id => id !== nodeId);
      }
    }

    // 更新入口节点
    if (this.state.pipeline.entryNodeId === nodeId) {
      this.state.pipeline.entryNodeId = this.state.pipeline.nodes[0]?.id || '';
    }

    // 从 DAG 数据中移除
    this.state.dagData.nodes = this.state.dagData.nodes.filter(n => n.id !== nodeId);
    this.state.dagData.edges = this.state.dagData.edges.filter(
      e => e.source !== nodeId && e.target !== nodeId
    );

    // 清除选中
    if (this.state.selectedNodeId === nodeId) {
      this.state.selectedNodeId = null;
    }

    this.state.isDirty = true;
    this.notifyListeners();
  }

  /**
   * 添加边
   */
  addEdge(sourceId: string, targetId: string, edgeType: 'normal' | 'true' | 'false' = 'normal'): DAGVisualEdge | null {
    if (!this.state.pipeline) return null;

    // 检查是否已存在
    const exists = this.state.dagData.edges.some(
      e => e.source === sourceId && e.target === targetId
    );
    if (exists) return null;

    // 检查循环依赖
    if (this.wouldCreateCycle(sourceId, targetId)) {
      console.warn('[PipelineEditorApi] 不能创建循环依赖');
      return null;
    }

    // 添加到流水线依赖
    const targetNode = this.state.pipeline.nodes.find(n => n.id === targetId);
    if (targetNode) {
      if (!targetNode.dependsOn) {
        targetNode.dependsOn = [];
      }
      if (!targetNode.dependsOn.includes(sourceId)) {
        targetNode.dependsOn.push(sourceId);
      }
      this.state.pipeline.updatedAt = Date.now();
    }

    // 添加到 DAG 数据
    const edge: DAGVisualEdge = {
      id: `edge-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      edgeType,
    };

    this.state.dagData.edges.push(edge);

    this.state.isDirty = true;
    this.notifyListeners();

    return edge;
  }

  /**
   * 删除边
   */
  deleteEdge(sourceId: string, targetId: string): void {
    if (!this.state.pipeline) return;

    // 从流水线依赖中移除
    const targetNode = this.state.pipeline.nodes.find(n => n.id === targetId);
    if (targetNode && targetNode.dependsOn) {
      targetNode.dependsOn = targetNode.dependsOn.filter(id => id !== sourceId);
      this.state.pipeline.updatedAt = Date.now();
    }

    // 从 DAG 数据中移除
    this.state.dagData.edges = this.state.dagData.edges.filter(
      e => !(e.source === sourceId && e.target === targetId)
    );

    this.state.isDirty = true;
    this.notifyListeners();
  }

  /**
   * 检查是否会创建循环依赖
   */
  private wouldCreateCycle(sourceId: string, targetId: string): boolean {
    // 如果从 sourceId 可以到达 targetId，再添加这条边会创建循环
    return this.canReach(targetId, sourceId);
  }

  /**
   * 检查是否可以从 start 到达 end
   */
  private canReach(startId: string, endId: string): boolean {
    const visited = new Set<string>();
    const queue = [startId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === endId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      // 找到所有从 current 出发的边
      for (const edge of this.state.dagData.edges) {
        if (edge.source === current) {
          queue.push(edge.target);
        }
      }
    }

    return false;
  }

  /**
   * 选择节点
   */
  selectNode(nodeId: string | null): void {
    this.state.selectedNodeId = nodeId;
    this.notifyListeners();
  }

  /**
   * 更新节点位置
   */
  updateNodePosition(nodeId: string, position: { x: number; y: number }): void {
    const node = this.state.dagData.nodes.find(n => n.id === nodeId);
    if (node) {
      node.position = position;
      this.state.isDirty = true;
      this.notifyListeners();
    }
  }

  /**
   * 设置缩放
   */
  setZoom(zoom: number): void {
    this.state.zoom = Math.max(0.1, Math.min(3, zoom));
    this.notifyListeners();
  }

  /**
   * 设置平移
   */
  setPan(pan: { x: number; y: number }): void {
    this.state.pan = pan;
    this.notifyListeners();
  }

  /**
   * 验证流水线
   */
  validate(): ValidationResult {
    if (!this.state.pipeline) {
      return { valid: false, errors: [], warnings: [] };
    }

    this.state.validation = this.engine.validate(this.state.pipeline);
    this.notifyListeners();
    return this.state.validation;
  }

  /**
   * 执行流水线
   */
  async execute(options?: PipelineExecutionOptions): Promise<PipelineExecutionState> {
    if (!this.state.pipeline) {
      throw new Error('未加载流水线');
    }

    // 先验证
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`流水线验证失败: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    return await this.engine.execute(this.state.pipeline, options);
  }

  /**
   * 保存流水线
   */
  save(format: 'json' | 'yaml' = 'yaml'): string {
    if (!this.state.pipeline) {
      throw new Error('未加载流水线');
    }

    const content = this.engine.serialize(this.state.pipeline, format);
    this.state.isDirty = false;
    this.notifyListeners();
    return content;
  }

  /**
   * 导出流水线
   */
  exportPipeline(): PipelineDefinition | null {
    return this.state.pipeline;
  }

  /**
   * 获取引擎实例
   */
  getEngine(): PipelineEngine {
    return this.engine;
  }

  /**
   * 获取节点列表
   */
  getNodes(): DAGVisualNode[] {
    return this.state.dagData.nodes;
  }

  /**
   * 获取边列表
   */
  getEdges(): DAGVisualEdge[] {
    return this.state.dagData.edges;
  }

  /**
   * 获取选中的节点
   */
  getSelectedNode(): DAGVisualNode | null {
    if (!this.state.selectedNodeId) return null;
    return this.state.dagData.nodes.find(n => n.id === this.state.selectedNodeId) || null;
  }

  /**
   * 撤销（简单版本，保存历史记录）
   */
  undo(): void {
    // TODO: 实现撤销功能
    console.warn('[PipelineEditorApi] 撤销功能尚未实现');
  }

  /**
   * 重做
   */
  redo(): void {
    // TODO: 实现重做功能
    console.warn('[PipelineEditorApi] 重做功能尚未实现');
  }

  /**
   * 自动布局
   */
  autoLayout(): void {
    if (!this.state.pipeline) return;

    // 简单的层级布局
    const levels = this.calculateLevels();
    const nodeWidth = 220;
    const nodeHeight = 100;
    const horizontalGap = 150;
    const verticalGap = 80;

    for (const node of this.state.dagData.nodes) {
      const level = levels.get(node.id) || 0;
      const sameLevelNodes = this.state.dagData.nodes.filter(
        n => (levels.get(n.id) || 0) === level
      );
      const levelIndex = sameLevelNodes.indexOf(node);

      node.position = {
        x: level * (nodeWidth + horizontalGap),
        y: levelIndex * (nodeHeight + verticalGap),
      };
    }

    this.state.isDirty = true;
    this.notifyListeners();
  }

  /**
   * 计算节点层级
   */
  private calculateLevels(): Map<string, number> {
    const levels = new Map<string, number>();
    const visited = new Set<string>();

    const dfs = (nodeId: string, level: number): void => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const currentLevel = levels.get(nodeId);
      if (currentLevel === undefined || level > currentLevel) {
        levels.set(nodeId, level);
      }

      // 找到所有后继节点
      for (const edge of this.state.dagData.edges) {
        if (edge.source === nodeId) {
          dfs(edge.target, level + 1);
        }
      }
    };

    // 从入口节点开始
    const entryNodes = this.state.dagData.nodes.filter(
      n => !this.state.dagData.edges.some(e => e.target === n.id)
    );
    for (const node of entryNodes) {
      dfs(node.id, 0);
    }

    // 处理孤立节点
    for (const node of this.state.dagData.nodes) {
      if (!visited.has(node.id)) {
        levels.set(node.id, 0);
      }
    }

    return levels;
  }
}
