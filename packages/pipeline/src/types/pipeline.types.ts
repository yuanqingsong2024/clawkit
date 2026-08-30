/**
 * 流水线类型定义
 * 定义流水线的核心数据结构和类型
 */

/**
 * 流水线状态
 */
export enum PipelineStatus {
  /** 草稿 */
  DRAFT = 'draft',
  /** 待执行 */
  PENDING = 'pending',
  /** 运行中 */
  RUNNING = 'running',
  /** 暂停 */
  PAUSED = 'paused',
  /** 成功完成 */
  SUCCESS = 'success',
  /** 失败 */
  FAILED = 'failed',
  /** 取消 */
  CANCELLED = 'cancelled',
}

/**
 * 节点状态
 */
export enum NodeStatus {
  /** 等待依赖 */
  WAITING = 'waiting',
  /** 就绪 */
  READY = 'ready',
  /** 运行中 */
  RUNNING = 'running',
  /** 成功 */
  SUCCESS = 'success',
  /** 失败 */
  FAILED = 'failed',
  /** 跳过 */
  SKIPPED = 'skipped',
  /** 取消 */
  CANCELLED = 'cancelled',
}

/**
 * 节点类型
 */
export enum NodeType {
  /** 任务节点 */
  TASK = 'task',
  /** 条件节点 */
  CONDITION = 'condition',
  /** 并行节点 */
  PARALLEL = 'parallel',
  /** 串行节点 */
  SEQUENCE = 'sequence',
  /** 触发器节点 */
  TRIGGER = 'trigger',
  /** 结束节点 */
  END = 'end',
}

/**
 * 节点执行结果
 */
export interface NodeExecutionResult {
  /** 节点 ID */
  nodeId: string;
  /** 执行状态 */
  status: NodeStatus;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime?: number;
  /** 执行时长（毫秒） */
  duration?: number;
  /** 输出结果 */
  output?: Record<string, unknown>;
  /** 错误信息 */
  error?: string;
  /** 重试次数 */
  retryCount: number;
}

/**
 * 流水线节点配置
 */
export type PipelineNodeStatus = NodeStatus;

export interface PipelineValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DAGNode {
  id: string;
  inDegree: number;
  outDegree: number;
  dependencies: string[];
  dependents: string[];
  config: Record<string, unknown>;
}

export interface DAGGraph {
  nodes: Map<string, DAGNode>;
  topologicalOrder: string[];
  levels: Map<string, number>;
}

export type { PipelineExecution } from '../models/pipeline.model';

export interface NodeExecutionResponse {
  success: boolean;
  nodeId: string;
  result?: unknown;
  error?: string;
  startTime: number;
  endTime: number;
  status: PipelineNodeStatus;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ type: string; message: string; nodeId?: string; path?: string }>;
  warnings: Array<{ type: string; message: string; nodeId?: string; path?: string }>;
}

export interface PipelineNodeConfig {
  /** 节点 ID */
  id: string;
  /** 节点名称 */
  name: string;
  /** 节点类型 */
  type: NodeType;
  /** 节点描述 */
  description?: string;
  /** 执行器类型 */
  executor?: string;
  /** 执行器配置 */
  executorConfig?: Record<string, unknown>;
  config?: Record<string, unknown>;
  /** 触发器配置 */
  trigger?: {
    type: string;
    config: Record<string, unknown>;
  };
  /** 条件表达式（条件节点） */
  condition?: string;
  /** 条件为真时的分支节点 ID */
  trueBranch?: string[];
  /** 条件为假时的分支节点 ID */
  falseBranch?: string[];
  /** 依赖节点 ID 列表 */
  dependsOn?: string[];
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 重试次数 */
  retries?: number;
  /** 重试间隔（毫秒） */
  retryDelay?: number;
  /** 允许失败 */
  allowFailure?: boolean;
  /** 并行任务数（并行节点） */
  parallelCount?: number;
}

/**
 * 流水线定义
 */
export interface PipelineDefinition {
  /** 流水线 ID */
  id: string;
  /** 流水线名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 版本 */
  version: number;
  /** 节点定义 */
  nodes: PipelineNodeConfig[];
  /** 入口节点 ID */
  entryNodeId: string;
  /** 参数定义 */
  parameters?: PipelineParameter[];
  /** 触发器 */
  triggers?: PipelineTrigger[];
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * 流水线参数
 */
export interface PipelineParameter {
  /** 参数名称 */
  name: string;
  /** 参数类型 */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** 默认值 */
  defaultValue?: unknown;
  /** 是否必填 */
  required?: boolean;
  /** 描述 */
  description?: string;
}

/**
 * 流水线触发器
 */
export interface PipelineTrigger {
  /** 触发器 ID */
  id: string;
  /** 触发器类型 */
  type: 'webhook' | 'schedule' | 'manual' | 'event';
  /** 触发器配置 */
  config: Record<string, unknown>;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 流水线执行上下文
 */
export interface PipelineExecutionContext {
  /** 执行 ID */
  executionId: string;
  /** 流水线定义 */
  pipeline: PipelineDefinition;
  /** 输入参数 */
  inputParams: Record<string, unknown>;
  /** 触发时间 */
  triggerTime: number;
  /** 触发来源 */
  triggerSource?: string;
  /** 触发者 */
  triggeredBy?: string;
}

/**
 * 节点执行上下文
 */
export interface NodeExecutionContext {
  /** 节点配置 */
  node: PipelineNodeConfig;
  /** 流水线执行上下文 */
  pipelineContext: PipelineExecutionContext;
  /** 上游节点执行结果 */
  upstreamResults: Map<string, NodeExecutionResult>;
  /** 当前节点执行结果 */
  result: NodeExecutionResult;
}

/**
 * 流水线执行状态
 */
export interface PipelineExecutionState {
  /** 执行 ID */
  executionId: string;
  /** 流水线 ID */
  pipelineId: string;
  /** 流水线版本 */
  pipelineVersion: number;
  /** 当前状态 */
  status: PipelineStatus;
  /** 当前执行的节点 ID */
  currentNodeId?: string;
  /** 所有节点执行状态 */
  nodeStates: Map<string, NodeExecutionResult>;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime?: number;
  /** 执行时长（毫秒） */
  duration?: number;
  /** 输出结果 */
  output?: Record<string, unknown>;
  /** 错误信息 */
  error?: string;
}

/**
 * 流水线执行选项
 */
export interface PipelineExecutionOptions {
  /** 输入参数 */
  inputParams?: Record<string, unknown>;
  /** 触发来源 */
  triggerSource?: string;
  /** 触发者 */
  triggeredBy?: string;
  /** 是否等待完成 */
  waitForCompletion?: boolean;
  /** 执行超时时间 */
  timeout?: number;
}

/**
 * DAG 可视化节点（用于前端）
 */
export interface DAGVisualNode {
  /** 节点 ID */
  id: string;
  /** 节点名称 */
  name: string;
  /** 节点类型 */
  type: NodeType;
  /** 位置 */
  position: { x: number; y: number };
  /** 尺寸 */
  size?: { width: number; height: number };
  /** 样式 */
  style?: Record<string, unknown>;
  /** 数据 */
  data: PipelineNodeConfig;
}

/**
 * DAG 可视化边（用于前端）
 */
export interface DAGVisualEdge {
  /** 边 ID */
  id: string;
  /** 源节点 ID */
  source: string;
  /** 目标节点 ID */
  target: string;
  /** 边类型（普通/条件真/条件假） */
  edgeType: 'normal' | 'true' | 'false';
  /** 标签 */
  label?: string;
  /** 样式 */
  style?: Record<string, unknown>;
}

/**
 * DAG 可视化数据
 */
export interface DAGVisualData {
  /** 节点列表 */
  nodes: DAGVisualNode[];
  /** 边列表 */
  edges: DAGVisualEdge[];
}

/**
 * 流水线统计信息
 */
export interface PipelineStatistics {
  /** 流水线 ID */
  pipelineId: string;
  /** 执行次数 */
  totalExecutions: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failedCount: number;
  /** 成功率 */
  successRate: number;
  /** 平均执行时长 */
  avgDuration: number;
  /** 最长执行时长 */
  maxDuration: number;
  /** 最短执行时长 */
  minDuration: number;
}

/**
 * 流水线事件类型
 */
export enum PipelineEventType {
  /** 流水线开始 */
  PIPELINE_STARTED = 'pipeline_started',
  /** 流水线完成 */
  PIPELINE_COMPLETED = 'pipeline_completed',
  /** 流水线失败 */
  PIPELINE_FAILED = 'pipeline_failed',
  /** 流水线取消 */
  PIPELINE_CANCELLED = 'pipeline_cancelled',
  /** 节点开始 */
  NODE_STARTED = 'node_started',
  /** 节点完成 */
  NODE_COMPLETED = 'node_completed',
  /** 节点失败 */
  NODE_FAILED = 'node_failed',
  /** 节点跳过 */
  NODE_SKIPPED = 'node_skipped',
}

/**
 * 流水线事件
 */
export interface PipelineEvent {
  /** 事件 ID */
  eventId: string;
  /** 事件类型 */
  type: PipelineEventType;
  /** 执行 ID */
  executionId: string;
  /** 流水线 ID */
  pipelineId: string;
  /** 节点 ID（可选） */
  nodeId?: string;
  /** 时间戳 */
  timestamp: number;
  /** 事件数据 */
  data?: Record<string, unknown>;
}
