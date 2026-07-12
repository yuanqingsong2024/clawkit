/**
 * 流水线核心类型定义
 */

/**
 * 流水线节点类型
 */
export type PipelineNodeType =
  | 'task'        // 任务节点：执行具体任务
  | 'condition'   // 条件节点：根据条件决定分支
  | 'parallel'    // 并行节点：并行执行多个子节点
  | 'sequence'    // 顺序节点：按顺序执行多个子节点
  | 'trigger'     // 触发器节点：等待外部触发
  | 'delay'       // 延迟节点：等待一段时间
  | 'input';      // 输入节点：等待人工输入

/**
 * 节点状态
 */
export type PipelineNodeStatus =
  | 'pending'      // 等待中
  | 'running'      // 运行中
  | 'completed'    // 已完成
  | 'failed'        // 失败
  | 'skipped'       // 跳过
  | 'waiting';      // 等待输入

/**
 * 流水线状态
 */
export type PipelineStatus =
  | 'draft'         // 草稿
  | 'ready'         // 就绪
  | 'running'       // 运行中
  | 'paused'        // 暂停
  | 'completed'     // 已完成
  | 'failed'        // 失败
  | 'cancelled';    // 取消

/**
 * 流水线执行模式
 */
export type PipelineExecutionMode =
  | 'sequential'   // 顺序执行
  | 'parallel'      // 并行执行
  | 'dag';          // DAG 执行（有向无环图）

/**
 * 节点输出
 */
export interface NodeOutput {
  /** 节点 ID */
  nodeId: string;
  /** 执行结果 */
  result?: unknown;
  /** 错误信息 */
  error?: string;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime?: number;
  /** 耗时（毫秒） */
  duration?: number;
  /** 状态 */
  status: PipelineNodeStatus;
}

/**
 * 流水线节点配置
 */
export interface PipelineNodeConfig {
  /** 节点 ID */
  id: string;
  /** 节点名称 */
  name: string;
  /** 节点类型 */
  type: PipelineNodeType;
  /** 节点描述 */
  description?: string;
  /** 节点配置 */
  config: Record<string, unknown>;
  /** 依赖节点列表 */
  dependsOn?: string[];
  /** 条件表达式（condition 节点使用） */
  condition?: string;
  /** 重试次数 */
  retryCount?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 错误处理策略 */
  onError?: 'continue' | 'stop' | 'retry';
  /** 节点顺序（用于排序） */
  order?: number;
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
  version: string;
  /** 项目标识 */
  projectKey: string;
  /** 执行模式 */
  executionMode: PipelineExecutionMode;
  /** 节点列表 */
  nodes: PipelineNodeConfig[];
  /** 全局变量 */
  variables?: Record<string, unknown>;
  /** 环境变量 */
  environment?: Record<string, string>;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 创建者 */
  createdBy?: string;
}

/**
 * 流水线执行记录
 */
export interface PipelineExecution {
  /** 执行 ID */
  id: string;
  /** 流水线 ID */
  pipelineId: string;
  /** 流水线版本 */
  pipelineVersion: string;
  /** 执行状态 */
  status: PipelineStatus;
  /** 触发方式 */
  trigger?: {
    type: 'manual' | 'scheduled' | 'webhook' | 'api';
    source?: string;
    payload?: unknown;
  };
  /** 开始时间 */
  startTime?: number;
  /** 结束时间 */
  endTime?: number;
  /** 耗时（毫秒） */
  duration?: number;
  /** 节点执行结果 */
  nodeResults: Map<string, NodeOutput>;
  /** 执行上下文 */
  context: PipelineExecutionContext;
  /** 错误信息 */
  error?: string;
  /** 触发者 */
  triggeredBy?: string;
}

/**
 * 流水线执行上下文
 */
export interface PipelineExecutionContext {
  /** 执行 ID */
  executionId: string;
  /** 全局变量 */
  variables: Record<string, unknown>;
  /** 当前节点输出 */
  nodeOutputs: Map<string, unknown>;
  /** 执行历史 */
  history: Array<{
    nodeId: string;
    action: string;
    timestamp: number;
  }>;
}

/**
 * DAG 节点（用于执行引擎）
 */
export interface DAGNode {
  /** 节点 ID */
  id: string;
  /** 入度（依赖数量） */
  inDegree: number;
  /** 出度（后续节点数量） */
  outDegree: number;
  /** 依赖节点 */
  dependencies: string[];
  /** 后续节点 */
  dependents: string[];
  /** 节点配置 */
  config: PipelineNodeConfig;
}

/**
 * DAG 图
 */
export interface DAGGraph {
  /** 所有节点 */
  nodes: Map<string, DAGNode>;
  /** 拓扑排序结果 */
  topologicalOrder: string[];
  /** 层级（用于并行优化） */
  levels: Map<string, number>;
}

/**
 * 执行器配置
 */
export interface PipelineExecutorConfig {
  /** 执行器类型 */
  type: string;
  /** 执行器配置 */
  config: Record<string, unknown>;
  /** 超时时间 */
  timeout?: number;
}

/**
 * 节点执行请求
 */
export interface NodeExecutionRequest {
  /** 执行 ID */
  executionId: string;
  /** 节点 ID */
  nodeId: string;
  /** 节点配置 */
  config: PipelineNodeConfig;
  /** 上下文 */
  context: PipelineExecutionContext;
  /** 执行器配置 */
  executor?: PipelineExecutorConfig;
}

/**
 * 节点执行响应
 */
export interface NodeExecutionResponse {
  /** 是否成功 */
  success: boolean;
  /** 节点 ID */
  nodeId: string;
  /** 执行结果 */
  result?: unknown;
  /** 错误信息 */
  error?: string;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime: number;
}

/**
 * 流水线执行事件
 */
export type PipelineEventType =
  | 'pipeline:started'
  | 'pipeline:node:started'
  | 'pipeline:node:completed'
  | 'pipeline:node:failed'
  | 'pipeline:completed'
  | 'pipeline:failed'
  | 'pipeline:paused'
  | 'pipeline:cancelled';

export interface PipelineEvent {
  /** 事件类型 */
  type: PipelineEventType;
  /** 执行 ID */
  executionId: string;
  /** 流水线 ID */
  pipelineId: string;
  /** 节点 ID（如果是节点事件） */
  nodeId?: string;
  /** 时间戳 */
  timestamp: number;
  /** 事件数据 */
  data?: unknown;
}

/**
 * 流水线验证结果
 */
export interface PipelineValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误列表 */
  errors: string[];
  /** 警告列表 */
  warnings: string[];
}

/**
 * 流水线统计信息
 */
export interface PipelineStats {
  /** 流水线 ID */
  pipelineId: string;
  /** 总执行次数 */
  totalExecutions: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failedCount: number;
  /** 平均耗时 */
  avgDuration: number;
  /** 最后执行时间 */
  lastExecution?: number;
  /** 最后状态 */
  lastStatus?: PipelineStatus;
}
