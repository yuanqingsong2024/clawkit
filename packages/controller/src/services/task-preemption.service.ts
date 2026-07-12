import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

/**
 * 抢占策略类型
 */
export enum PreemptionStrategy {
  /** 不允许抢占 */
  NONE = 'none',
  /** 高优先级任务抢占低优先级任务 */
  PRIORITY = 'priority',
  /** 紧急任务抢占所有任务 */
  URGENT = 'urgent',
  /** 资源不足时抢占 */
  RESOURCE = 'resource',
}

/**
 * 抢占条件
 */
export interface PreemptionCondition {
  /** 优先级差距阈值 */
  priorityDiffThreshold?: number;
  /** 最大抢占任务数 */
  maxPreemptableTasks?: number;
  /** 允许抢占的任务状态 */
  allowedTargetStatuses?: PreemptionTargetStatus[];
  /** 抢占冷却时间（毫秒） */
  cooldownMs?: number;
}

/**
 * 抢占目标状态
 */
export enum PreemptionTargetStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  QUEUED = 'queued',
}

/**
 * 抢占配置
 */
export interface PreemptionConfig {
  /** 启用抢占 */
  enabled?: boolean;
  /** 抢占策略 */
  strategy?: PreemptionStrategy;
  /** 抢占条件 */
  condition?: PreemptionCondition;
  /** 是否允许抢占运行中的任务 */
  allowRunningPreemption?: boolean;
  /** 抢占任务的最大重试次数 */
  maxRetries?: number;
  /** 抢占超时时间（毫秒） */
  timeoutMs?: number;
}

/**
 * 抢占记录
 */
export interface PreemptionRecord {
  id: string;
  preemptorTaskId: string;
  preemptorPriority: string;
  targetTaskId: string;
  targetPriority: string;
  targetWorkerId: string;
  status: PreemptionStatus;
  triggeredAt: Date;
  completedAt?: Date;
  reason?: string;
  success: boolean;
  error?: string;
}

/**
 * 抢占状态
 */
export enum PreemptionStatus {
  PENDING = 'pending',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * 优先级定义
 */
export enum TaskPriority {
  URGENT = 'urgent',
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
}

/**
 * 优先级比较结果
 */
export interface PriorityComparison {
  canPreempt: boolean;
  reason: string;
  priorityDiff: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<PreemptionConfig> = {
  enabled: false,
  strategy: PreemptionStrategy.NONE,
  condition: {
    priorityDiffThreshold: 2,
    maxPreemptableTasks: 5,
    allowedTargetStatuses: [PreemptionTargetStatus.PENDING, PreemptionTargetStatus.QUEUED],
    cooldownMs: 60000,
  },
  allowRunningPreemption: false,
  maxRetries: 3,
  timeoutMs: 30000,
};

/**
 * 任务抢占服务
 * 管理高优先级任务对低优先级任务的抢占
 */
export class TaskPreemptionService extends EventEmitter {
  private readonly config: Required<PreemptionConfig>;
  private readonly preemptionRecords: Map<string, PreemptionRecord> = new Map();
  private readonly cooldowns: Map<string, number> = new Map();
  private eventEmitter: EventEmitter;

  constructor(config?: PreemptionConfig, eventEmitter?: EventEmitter) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventEmitter = eventEmitter ?? new EventEmitter();
  }

  /**
   * 检查抢占是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 获取当前配置
   */
  getConfig(): PreemptionConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<PreemptionConfig>): void {
    Object.assign(this.config, updates);
  }

  /**
   * 比较两个优先级的差距
   */
  comparePriority(priority1: TaskPriority, priority2: TaskPriority): PriorityComparison {
    const priorityOrder: Record<TaskPriority, number> = {
      [TaskPriority.URGENT]: 0,
      [TaskPriority.HIGH]: 1,
      [TaskPriority.NORMAL]: 2,
      [TaskPriority.LOW]: 3,
    };

    const p1 = priorityOrder[priority1] ?? 2;
    const p2 = priorityOrder[priority2] ?? 2;
    const diff = p2 - p1; // 正数表示 priority1 更高

    const canPreempt = diff >= (this.config.condition.priorityDiffThreshold ?? 2);
    const reason = canPreempt
      ? `优先级差距 ${diff} 满足抢占条件（阈值：${this.config.condition.priorityDiffThreshold}）`
      : `优先级差距 ${diff} 不满足抢占条件（阈值：${this.config.condition.priorityDiffThreshold}）`;

    return { canPreempt, reason, priorityDiff: diff };
  }

  /**
   * 检查是否可以抢占目标任务
   */
  canPreempt(preemptorPriority: TaskPriority, targetPriority: TaskPriority, targetStatus: PreemptionTargetStatus): { allowed: boolean; reason: string } {
    // 检查是否启用抢占
    if (!this.config.enabled) {
      return { allowed: false, reason: '抢占功能未启用' };
    }

    // 检查策略
    if (this.config.strategy === PreemptionStrategy.NONE) {
      return { allowed: false, reason: '当前策略不允许抢占' };
    }

    // 检查是否允许抢占运行中的任务
    if (targetStatus === PreemptionTargetStatus.RUNNING && !this.config.allowRunningPreemption) {
      return { allowed: false, reason: '不允许抢占运行中的任务' };
    }

    // 检查目标状态是否在允许列表中
    const allowedStatuses = this.config.condition.allowedTargetStatuses ?? [PreemptionTargetStatus.PENDING, PreemptionTargetStatus.QUEUED];
    if (!allowedStatuses.includes(targetStatus)) {
      return { allowed: false, reason: `目标状态 ${targetStatus} 不在允许抢占的状态列表中` };
    }

    // 检查优先级
    if (this.config.strategy === PreemptionStrategy.URGENT) {
      if (preemptorPriority === TaskPriority.URGENT) {
        return { allowed: true, reason: '紧急任务可以抢占任何任务' };
      }
      return { allowed: false, reason: '只有紧急任务可以抢占' };
    }

    if (this.config.strategy === PreemptionStrategy.PRIORITY) {
      const comparison = this.comparePriority(preemptorPriority, targetPriority);
      return {
        allowed: comparison.canPreempt,
        reason: comparison.reason,
      };
    }

    return { allowed: false, reason: '未知抢占策略' };
  }

  /**
   * 检查是否在冷却期
   */
  isInCooldown(targetTaskId: string): boolean {
    const lastPreemptTime = this.cooldowns.get(targetTaskId);
    if (!lastPreemptTime) {
      return false;
    }

    const cooldown = this.config.condition.cooldownMs ?? 60000;
    return Date.now() - lastPreemptTime < cooldown;
  }

  /**
   * 触发抢占
   */
  async triggerPreemption(
    preemptorTaskId: string,
    preemptorPriority: TaskPriority,
    targetTaskId: string,
    targetPriority: TaskPriority,
    targetWorkerId: string,
    targetStatus: PreemptionTargetStatus,
  ): Promise<PreemptionRecord> {
    const recordId = randomUUID();

    const record: PreemptionRecord = {
      id: recordId,
      preemptorTaskId: preemptorTaskId,
      preemptorPriority,
      targetTaskId,
      targetPriority,
      targetWorkerId,
      status: PreemptionStatus.PENDING,
      triggeredAt: new Date(),
      success: false,
    };

    // 检查是否可以抢占
    const { allowed, reason } = this.canPreempt(preemptorPriority, targetPriority, targetStatus);
    record.reason = reason;

    if (!allowed) {
      record.status = PreemptionStatus.FAILED;
      record.error = reason;
      record.completedAt = new Date();
      this.preemptionRecords.set(recordId, record);
      return record;
    }

    // 检查冷却期
    if (this.isInCooldown(targetTaskId)) {
      record.status = PreemptionStatus.CANCELLED;
      record.error = '目标任务处于抢占冷却期';
      record.completedAt = new Date();
      this.preemptionRecords.set(recordId, record);
      return record;
    }

    // 记录抢占尝试
    record.status = PreemptionStatus.EXECUTING;
    this.preemptionRecords.set(recordId, record);

    // 发出抢占事件
    this.eventEmitter.emit('preemption:triggered', {
      record,
      preemptorTaskId,
      targetTaskId,
      targetWorkerId,
    });

    try {
      // 发送抢占指令到 worker
      const success = await this.sendPreemptionSignal(targetWorkerId, targetTaskId);

      if (success) {
        record.status = PreemptionStatus.COMPLETED;
        record.success = true;
        record.completedAt = new Date();

        // 设置冷却期
        this.cooldowns.set(targetTaskId, Date.now());

        this.eventEmitter.emit('preemption:completed', { record });
      } else {
        record.status = PreemptionStatus.FAILED;
        record.error = 'Worker 响应抢占失败';
        record.completedAt = new Date();

        this.eventEmitter.emit('preemption:failed', { record, error: record.error });
      }
    } catch (error) {
      record.status = PreemptionStatus.FAILED;
      record.error = (error as Error).message;
      record.completedAt = new Date();

      this.eventEmitter.emit('preemption:failed', { record, error: error });
    }

    this.preemptionRecords.set(recordId, record);
    return record;
  }

  /**
   * 发送抢占信号到 worker
   */
  private async sendPreemptionSignal(workerId: string, taskId: string): Promise<boolean> {
    // 模拟发送抢占信号
    // 实际实现应该通过 WebSocket 或其他机制通知 worker
    console.log(`发送抢占信号到 Worker ${workerId}，任务 ${taskId}`);

    // 这里应该调用实际的通信机制
    // 返回 true 表示信号已发送（不保证 worker 一定响应）
    return true;
  }

  /**
   * 获取抢占记录
   */
  getPreemptionRecord(recordId: string): PreemptionRecord | undefined {
    return this.preemptionRecords.get(recordId);
  }

  /**
   * 获取任务的所有抢占记录
   */
  getTaskPreemptionRecords(taskId: string): PreemptionRecord[] {
    return Array.from(this.preemptionRecords.values()).filter(
      (r) => r.preemptorTaskId === taskId || r.targetTaskId === taskId,
    );
  }

  /**
   * 获取最近的抢占记录
   */
  getRecentRecords(limit: number = 50): PreemptionRecord[] {
    const records = Array.from(this.preemptionRecords.values());
    return records
      .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())
      .slice(0, limit);
  }

  /**
   * 获取抢占统计
   */
  getStats(): {
    totalPreemptions: number;
    successfulPreemptions: number;
    failedPreemptions: number;
    cancelledPreemptions: number;
    successRate: number;
  } {
    const records = Array.from(this.preemptionRecords.values());
    const total = records.length;
    const successful = records.filter((r) => r.success).length;
    const failed = records.filter((r) => r.status === PreemptionStatus.FAILED).length;
    const cancelled = records.filter((r) => r.status === PreemptionStatus.CANCELLED).length;

    return {
      totalPreemptions: total,
      successfulPreemptions: successful,
      failedPreemptions: failed,
      cancelledPreemptions: cancelled,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
    };
  }

  /**
   * 清除冷却期
   */
  clearCooldown(taskId: string): void {
    this.cooldowns.delete(taskId);
  }

  /**
   * 清除所有冷却期
   */
  clearAllCooldowns(): void {
    this.cooldowns.clear();
  }

  /**
   * 清理旧的抢占记录
   */
  cleanupOldRecords(maxAgeMs: number = 86400000): void {
    const cutoff = Date.now() - maxAgeMs;

    for (const [id, record] of this.preemptionRecords.entries()) {
      if (record.triggeredAt.getTime() < cutoff) {
        this.preemptionRecords.delete(id);
      }
    }
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.preemptionRecords.clear();
    this.cooldowns.clear();
    this.removeAllListeners();
  }

  /**
   * 获取默认抢占配置
   */
  static getDefaultConfig(): PreemptionConfig {
    return {
      enabled: false,
      strategy: PreemptionStrategy.PRIORITY,
      condition: {
        priorityDiffThreshold: 2,
        maxPreemptableTasks: 5,
        allowedTargetStatuses: [PreemptionTargetStatus.PENDING, PreemptionTargetStatus.QUEUED],
        cooldownMs: 60000,
      },
      allowRunningPreemption: false,
    };
  }
}
