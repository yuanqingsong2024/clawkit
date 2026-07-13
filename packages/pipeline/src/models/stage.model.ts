/**
 * 流水线节点模型
 * 定义流水线中的节点（stage/step）数据结构
 */

/**
 * 节点状态
 */
export type StageStatus =
  | 'pending'    // 待执行
  | 'queued'     // 已入队
  | 'running'    // 执行中
  | 'completed'  // 已完成
  | 'failed'     // 失败
  | 'skipped'    // 跳过（依赖失败）
  | 'paused'     // 暂停
  | 'cancelled'; // 取消

/**
 * 节点执行配置
 */
export interface StageExecutionConfig {
  /** 超时时间（毫秒），0 表示无限制 */
  timeout?: number;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 重试间隔（毫秒） */
  retryDelay?: number;
  /** 是否允许并行执行 */
  allowParallel?: boolean;
  /** 失败时是否继续执行后续节点 */
  continueOnFailure?: boolean;
}

/**
 * 节点输出
 */
export interface StageOutput {
  /** 输出数据 */
  data?: Record<string, unknown>;
  /** 输出文件路径列表 */
  artifacts?: string[];
  /** 标准输出 */
  stdout?: string;
  /** 标准错误 */
  stderr?: string;
  /** 退出码 */
  exitCode?: number;
  /** 消息 */
  message?: string;
  /** 执行时间（毫秒） */
  duration?: number;
}

/**
 * 节点错误
 */
export interface StageError {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 详细信息 */
  details?: unknown;
  /** 堆栈信息 */
  stack?: string;
  /** 原始错误 */
  originalError?: unknown;
}

/**
 * 流水线节点
 */
export interface PipelineStage {
  /** 节点 ID */
  id: string;
  /** 节点名称 */
  name: string;
  /** 节点描述 */
  description?: string;
  /** 执行的命令或脚本 */
  command?: string;
  /** 工作目录 */
  workingDir?: string;
  /** 环境变量 */
  env?: Record<string, string>;
  /** 依赖的其他节点 ID 列表 */
  dependencies?: string[];
  /** 执行配置 */
  config?: StageExecutionConfig;
  /** 条件表达式（满足条件时才执行） */
  condition?: string;
  /** 节点状态 */
  status?: StageStatus;
  /** 开始时间 */
  startTime?: number;
  /** 结束时间 */
  endTime?: number;
  /** 节点输出 */
  output?: StageOutput;
  /** 错误信息 */
  error?: StageError;
  /** 进度（0-100） */
  progress?: number;
  /** 重试次数 */
  retryCount?: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 创建流水线节点
 */
export function createStage(partial: Partial<PipelineStage> & { id: string; name: string }): PipelineStage {
  return {
    id: partial.id,
    name: partial.name,
    description: partial.description,
    command: partial.command,
    workingDir: partial.workingDir,
    env: partial.env,
    dependencies: partial.dependencies || [],
    config: partial.config,
    condition: partial.condition,
    status: 'pending',
    retryCount: 0,
    metadata: partial.metadata,
  };
}

/**
 * 计算节点执行时长
 */
export function getStageDuration(stage: PipelineStage): number {
  if (stage.startTime && stage.endTime) {
    return stage.endTime - stage.startTime;
  }
  return 0;
}

/**
 * 判断节点是否可执行
 */
export function isStageRunnable(stage: PipelineStage, completedStages: Set<string>): boolean {
  // 如果节点已经有非待执行状态，不能执行
  if (stage.status && stage.status !== 'pending' && stage.status !== 'skipped') {
    return false;
  }

  // 如果没有依赖，直接可执行
  if (!stage.dependencies || stage.dependencies.length === 0) {
    return true;
  }

  // 检查所有依赖是否都已完成
  return stage.dependencies.every((depId) => completedStages.has(depId));
}

/**
 * 获取节点状态摘要
 */
export function getStageStatusSummary(stage: PipelineStage): string {
  switch (stage.status) {
    case 'pending':
      return '待执行';
    case 'queued':
      return '排队中';
    case 'running':
      return `执行中 (${stage.progress || 0}%)`;
    case 'completed':
      return '已完成';
    case 'failed':
      return `失败: ${stage.error?.message || '未知错误'}`;
    case 'skipped':
      return '已跳过';
    case 'cancelled':
      return '已取消';
    default:
      return '未知状态';
  }
}
