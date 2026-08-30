/**
 * 流水线模型
 * 定义流水线（pipeline）数据结构
 */

import type { PipelineStage, StageStatus } from './stage.model';
import type { NodeExecutionResponse } from '../types/pipeline.types';

/**
 * 流水线状态
 */
/**
 * 流水线触发器类型
 */
export type PipelineTriggerType =
  | 'manual'     // 手动触发
  | 'webhook'    // Webhook 触发
  | 'schedule'   // 定时触发
  | 'event';     // 事件触发

/**
 * 流水线触发器配置
 */
export interface PipelineTrigger {
  /** 触发器类型 */
  type: PipelineTriggerType;
  /** 触发条件 */
  condition?: string;
  /** 定时表达式（cron 格式） */
  cron?: string;
  /** Webhook 密钥 */
  webhookSecret?: string;
  /** 事件过滤器 */
  eventFilter?: Record<string, unknown>;
}

/**
 * 流水线变量
 */
export interface PipelineVariable {
  /** 变量名 */
  name: string;
  /** 变量值 */
  value: unknown;
  /** 是否敏感（不显示在日志中） */
  secret?: boolean;
  /** 默认值 */
  defaultValue?: unknown;
}

/**
 * 流水线执行上下文
 */
export interface PipelineExecutionContext {
  /** 执行 ID */
  executionId: string;
  /** 流水线 ID */
  pipelineId: string;
  /** 触发类型 */
  triggerType: PipelineTriggerType;
  /** 触发时间 */
  triggerTime: number;
  /** 触发者 */
  triggeredBy?: string;
  /** 传入的变量 */
  variables: Record<string, unknown>;
  /** 执行的节点 ID 列表 */
  executedStages: string[];
  /** 当前节点输出 */
  stageOutputs: Record<string, Record<string, unknown>>;
}

/**
 * 流水线执行记录
 */
export interface PipelineExecution {
  /** 执行 ID */
  id: string;
  /** 流水线 ID */
  pipelineId: string;
  /** 执行状态 */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  /** 创建时间 */
  createdAt: number;
  /** 开始时间 */
  startedAt?: number;
  /** 结束时间 */
  endedAt?: number;
  /** 触发类型 */
  triggerType: PipelineTriggerType;
  /** 触发者 */
  triggeredBy?: string;
  /** 执行的节点及其状态 */
  stageExecutions?: Record<string, StageStatus>;
  nodeResults: Map<string, NodeExecutionResponse>;
  /** 执行上下文 */
  context?: PipelineExecutionContext;
  /** 错误信息 */
  error?: string;
  /** 执行时长（毫秒） */
  duration?: number;
}

/**
 * 流水线元信息
 */
export interface PipelineMeta {
  /** 流水线 ID */
  id: string;
  /** 流水线名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 版本 */
  version: number;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 创建者 */
  createdBy?: string;
}

/**
 * 流水线定义
 */
export interface Pipeline {
  /** 流水线元信息 */
  meta: PipelineMeta;
  /** 流水线节点列表 */
  stages: PipelineStage[];
  /** 触发器配置 */
  triggers?: PipelineTrigger[];
  /** 全局变量 */
  variables?: PipelineVariable[];
  /** 流水线配置 */
  config?: PipelineConfig;
}

/**
 * 流水线配置
 */
export interface PipelineConfig {
  /** 最大并发节点数 */
  maxConcurrency?: number;
  /** 全局超时时间（毫秒） */
  globalTimeout?: number;
  /** 失败策略 */
  failureStrategy?: 'fail-fast' | 'continue' | 'manual';
  /** 通知配置 */
  notifications?: NotificationConfig[];
}

/**
 * 通知配置
 */
export interface NotificationConfig {
  /** 通知类型 */
  type: 'email' | 'webhook' | 'slack' | 'dingtalk';
  /** 通知目标 */
  target: string;
  /** 触发条件 */
  onEvents: ('start' | 'success' | 'failure' | 'always')[];
}

/**
 * 创建流水线
 */
export function createPipeline(partial: Partial<Pipeline> & { id: string; name: string }): Pipeline {
  const now = Date.now();
  return {
    meta: {
      id: partial.meta?.id || partial.id,
      name: partial.meta?.name || partial.name,
      description: partial.meta?.description,
      version: partial.meta?.version || 1,
      createdAt: partial.meta?.createdAt || now,
      updatedAt: partial.meta?.updatedAt || now,
      createdBy: partial.meta?.createdBy,
    },
    stages: partial.stages || [],
    triggers: partial.triggers,
    variables: partial.variables,
    config: partial.config,
  };
}

/**
 * 计算流水线执行时长
 */
export function getPipelineDuration(execution: PipelineExecution): number {
  if (execution.startedAt && execution.endedAt) {
    return execution.endedAt - execution.startedAt;
  }
  if (execution.startedAt) {
    return Date.now() - execution.startedAt;
  }
  return 0;
}

/**
 * 获取流水线状态摘要
 */
export function getPipelineStatusSummary(_pipeline: Pipeline, execution?: PipelineExecution): string {
  if (!execution) {
    return '未执行';
  }

  switch (execution.status) {
    case 'pending':
      return '等待执行';
    case 'running':
      const stageExecs = execution.stageExecutions || {};
      const runningCount = Object.values(stageExecs).filter((s) => s === 'running').length;
      return `运行中 (${runningCount} 个节点执行中)`;
    case 'completed':
      return '已完成';
    case 'failed':
      return `失败: ${execution.error || '未知错误'}`;
    case 'cancelled':
      return '已取消';
    case 'paused':
      return '已暂停';
    default:
      return '未知状态';
  }
}

/**
 * 验证流水线定义
 */
export function validatePipeline(pipeline: Pipeline): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 检查节点 ID 唯一性
  const stageIds = new Set<string>();
  for (const stage of pipeline.stages) {
    if (stageIds.has(stage.id)) {
      errors.push(`节点 ID 重复: ${stage.id}`);
    }
    stageIds.add(stage.id);

    // 检查依赖是否存在
    if (stage.dependencies) {
      for (const depId of stage.dependencies) {
        if (!stageIds.has(depId) && !pipeline.stages.some((s) => s.id === depId)) {
          errors.push(`节点 ${stage.id} 的依赖 ${depId} 不存在`);
        }
      }
    }
  }

  // 检查循环依赖
  if (hasCircularDependency(pipeline.stages)) {
    errors.push('存在循环依赖');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 检查是否存在循环依赖
 */
function hasCircularDependency(stages: PipelineStage[]): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(stageId: string): boolean {
    visited.add(stageId);
    recursionStack.add(stageId);

    const stage = stages.find((s) => s.id === stageId);
    if (stage?.dependencies) {
      for (const depId of stage.dependencies) {
        if (!visited.has(depId)) {
          if (dfs(depId)) {
            return true;
          }
        } else if (recursionStack.has(depId)) {
          return true;
        }
      }
    }

    recursionStack.delete(stageId);
    return false;
  }

  for (const stage of stages) {
    if (!visited.has(stage.id)) {
      if (dfs(stage.id)) {
        return true;
      }
    }
  }

  return false;
}
