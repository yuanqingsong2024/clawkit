import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

/**
 * 审计日志级别
 */
export enum AuditLogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * 审计操作类型
 */
export enum AuditAction {
  // 任务相关
  TASK_CREATE = 'task:create',
  TASK_APPROVE = 'task:approve',
  TASK_REJECT = 'task:reject',
  TASK_CANCEL = 'task:cancel',
  TASK_EXECUTE = 'task:execute',
  TASK_COMPLETE = 'task:complete',
  TASK_FAIL = 'task:fail',
  TASK_PREEMPT = 'task:preempt',
  TASK_RETRY = 'task:retry',

  // 草稿相关
  DRAFT_CREATE = 'draft:create',
  DRAFT_REVISE = 'draft:revise',
  DRAFT_SUBMIT = 'draft:submit',
  DRAFT_APPROVE = 'draft:approve',

  // Worker 相关
  WORKER_REGISTER = 'worker:register',
  WORKER_HEARTBEAT = 'worker:heartbeat',
  WORKER_DISCONNECT = 'worker:disconnect',

  // 系统相关
  SYSTEM_START = 'system:start',
  SYSTEM_STOP = 'system:stop',
  CONFIG_UPDATE = 'config:update',
  AUTH_SUCCESS = 'auth:success',
  AUTH_FAILURE = 'auth:failure',
}

/**
 * 审计主体类型
 */
export enum AuditSubjectType {
  TASK = 'task',
  DRAFT = 'draft',
  WORKER = 'worker',
  USER = 'user',
  SYSTEM = 'system',
  CONFIG = 'config',
}

/**
 * 审计日志条目
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  level: AuditLogLevel;
  action: AuditAction;
  subjectType: AuditSubjectType;
  subjectId: string;
  actorId?: string;
  actorName?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  duration?: number;
  success: boolean;
  errorMessage?: string;
}

/**
 * 审计日志查询条件
 */
export interface AuditLogQuery {
  startDate?: Date;
  endDate?: Date;
  level?: AuditLogLevel;
  action?: AuditAction;
  subjectType?: AuditSubjectType;
  subjectId?: string;
  actorId?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * 审计日志分页结果
 */
export interface AuditLogResult {
  entries: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * 审计日志导出格式
 */
export enum AuditExportFormat {
  JSON = 'json',
  CSV = 'csv',
}

/**
 * 审计日志服务
 * 记录所有重要操作历史
 */
export class AuditLogService extends EventEmitter {
  private readonly entries: AuditLogEntry[] = [];
  private readonly maxEntries: number;
  private eventEmitter: EventEmitter;

  constructor(maxEntries: number = 10000, eventEmitter?: EventEmitter) {
    super();
    this.maxEntries = maxEntries;
    this.eventEmitter = eventEmitter ?? new EventEmitter();
  }

  /**
   * 记录审计日志
   */
  log(input: {
    level?: AuditLogLevel;
    action: AuditAction;
    subjectType: AuditSubjectType;
    subjectId: string;
    actorId?: string;
    actorName?: string;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
    duration?: number;
    success?: boolean;
    errorMessage?: string;
  }): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: randomUUID(),
      timestamp: new Date(),
      level: input.level ?? (input.success === false ? AuditLogLevel.ERROR : AuditLogLevel.INFO),
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      actorId: input.actorId,
      actorName: input.actorName,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: input.metadata,
      beforeState: input.beforeState,
      afterState: input.afterState,
      duration: input.duration,
      success: input.success ?? true,
      errorMessage: input.errorMessage,
    };

    this.entries.push(entry);

    // 如果超过最大条目数，删除最早的
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // 发出事件
    this.eventEmitter.emit('audit:logged', entry);

    return entry;
  }

  /**
   * 查询审计日志
   */
  query(query: AuditLogQuery): AuditLogResult {
    let filtered = this.entries;

    // 按时间范围筛选
    if (query.startDate) {
      filtered = filtered.filter((e) => e.timestamp >= query.startDate!);
    }
    if (query.endDate) {
      filtered = filtered.filter((e) => e.timestamp <= query.endDate!);
    }

    // 按级别筛选
    if (query.level) {
      filtered = filtered.filter((e) => e.level === query.level);
    }

    // 按操作类型筛选
    if (query.action) {
      filtered = filtered.filter((e) => e.action === query.action);
    }

    // 按主体类型筛选
    if (query.subjectType) {
      filtered = filtered.filter((e) => e.subjectType === query.subjectType);
    }

    // 按主体 ID 筛选
    if (query.subjectId) {
      filtered = filtered.filter((e) => e.subjectId === query.subjectId);
    }

    // 按操作者 ID 筛选
    if (query.actorId) {
      filtered = filtered.filter((e) => e.actorId === query.actorId);
    }

    // 按成功状态筛选
    if (typeof query.success === 'boolean') {
      filtered = filtered.filter((e) => e.success === query.success);
    }

    // 排序（按时间倒序）
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = filtered.length;
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const paginatedEntries = filtered.slice(offset, offset + limit);

    return {
      entries: paginatedEntries,
      total,
      limit,
      offset,
      hasMore: offset + paginatedEntries.length < total,
    };
  }

  /**
   * 获取指定主体的审计历史
   */
  getSubjectHistory(
    subjectId: string,
    subjectType?: AuditSubjectType,
    limit?: number,
  ): AuditLogEntry[] {
    let filtered = this.entries.filter((e) => e.subjectId === subjectId);

    if (subjectType) {
      filtered = filtered.filter((e) => e.subjectType === subjectType);
    }

    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? filtered.slice(0, limit) : filtered;
  }

  /**
   * 获取指定操作者的操作历史
   */
  getActorHistory(actorId: string, limit?: number): AuditLogEntry[] {
    const filtered = this.entries.filter((e) => e.actorId === actorId);

    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? filtered.slice(0, limit) : filtered;
  }

  /**
   * 获取最近的审计日志
   */
  getRecent(limit: number = 50): AuditLogEntry[] {
    const sorted = [...this.entries].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return sorted.slice(0, limit);
  }

  /**
   * 导出审计日志
   */
  export(format: AuditExportFormat, query?: AuditLogQuery): string {
    const entries = query ? this.query(query).entries : this.entries;

    switch (format) {
      case AuditExportFormat.JSON:
        return JSON.stringify(entries, null, 2);

      case AuditExportFormat.CSV:
        return this.toCSV(entries);

      default:
        throw new Error(`不支持的导出格式：${format}`);
    }
  }

  /**
   * 转换为 CSV 格式
   */
  private toCSV(entries: AuditLogEntry[]): string {
    const headers = [
      'ID',
      '时间',
      '级别',
      '操作',
      '主体类型',
      '主体ID',
      '操作者ID',
      '操作者名称',
      'IP地址',
      '成功',
      '错误信息',
      '持续时间(ms)',
    ];

    const rows = entries.map((e) => [
      e.id,
      e.timestamp.toISOString(),
      e.level,
      e.action,
      e.subjectType,
      e.subjectId,
      e.actorId ?? '',
      e.actorName ?? '',
      e.ip ?? '',
      e.success ? '是' : '否',
      e.errorMessage ?? '',
      e.duration?.toString() ?? '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
  }

  /**
   * 获取统计信息
   */
  getStats(dateRange?: { startDate: Date; endDate: Date }): {
    totalCount: number;
    successCount: number;
    failureCount: number;
    byAction: Record<string, number>;
    bySubjectType: Record<string, number>;
    byLevel: Record<string, number>;
  } {
    let entries = this.entries;

    if (dateRange) {
      entries = entries.filter(
        (e) => e.timestamp >= dateRange.startDate && e.timestamp <= dateRange.endDate,
      );
    }

    const byAction: Record<string, number> = {};
    const bySubjectType: Record<string, number> = {};
    const byLevel: Record<string, number> = {};
    let successCount = 0;
    let failureCount = 0;

    for (const entry of entries) {
      byAction[entry.action] = (byAction[entry.action] || 0) + 1;
      bySubjectType[entry.subjectType] = (bySubjectType[entry.subjectType] || 0) + 1;
      byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;

      if (entry.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    return {
      totalCount: entries.length,
      successCount,
      failureCount,
      byAction,
      bySubjectType,
      byLevel,
    };
  }

  /**
   * 清理旧日志
   */
  cleanup(maxAgeDays: number = 30): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);

    const beforeCount = this.entries.length;
    const filtered = this.entries.filter((e) => e.timestamp >= cutoff);
    this.entries.splice(0, this.entries.length, ...filtered);

    return beforeCount - this.entries.length;
  }

  /**
   * 清空所有日志
   */
  clear(): void {
    this.entries.splice(0, this.entries.length);
  }

  /**
   * 获取总条目数
   */
  size(): number {
    return this.entries.length;
  }

  // ==================== 便捷方法 ====================

  /**
   * 记录任务创建
   */
  logTaskCreate(
    taskId: string,
    actorId?: string,
    actorName?: string,
    metadata?: Record<string, unknown>,
  ): AuditLogEntry {
    return this.log({
      action: AuditAction.TASK_CREATE,
      subjectType: AuditSubjectType.TASK,
      subjectId: taskId,
      actorId,
      actorName,
      metadata,
    });
  }

  /**
   * 记录任务审批
   */
  logTaskApproval(
    taskId: string,
    approved: boolean,
    actorId?: string,
    actorName?: string,
    beforeState?: Record<string, unknown>,
    afterState?: Record<string, unknown>,
  ): AuditLogEntry {
    return this.log({
      action: approved ? AuditAction.TASK_APPROVE : AuditAction.TASK_REJECT,
      subjectType: AuditSubjectType.TASK,
      subjectId: taskId,
      actorId,
      actorName,
      beforeState,
      afterState,
      success: approved,
    });
  }

  /**
   * 记录任务执行
   */
  logTaskExecution(
    taskId: string,
    workerId: string,
    duration?: number,
    success?: boolean,
    errorMessage?: string,
  ): AuditLogEntry {
    return this.log({
      action: success === false ? AuditAction.TASK_FAIL : AuditAction.TASK_EXECUTE,
      subjectType: AuditSubjectType.TASK,
      subjectId: taskId,
      actorId: workerId,
      duration,
      success: success ?? true,
      errorMessage,
    });
  }

  /**
   * 记录 Worker 注册
   */
  logWorkerRegister(
    workerId: string,
    ip?: string,
    metadata?: Record<string, unknown>,
  ): AuditLogEntry {
    return this.log({
      action: AuditAction.WORKER_REGISTER,
      subjectType: AuditSubjectType.WORKER,
      subjectId: workerId,
      actorId: workerId,
      ip,
      metadata,
    });
  }

  /**
   * 记录认证事件
   */
  logAuth(
    success: boolean,
    userId?: string,
    ip?: string,
    userAgent?: string,
    errorMessage?: string,
  ): AuditLogEntry {
    return this.log({
      action: success ? AuditAction.AUTH_SUCCESS : AuditAction.AUTH_FAILURE,
      subjectType: AuditSubjectType.USER,
      subjectId: userId ?? 'anonymous',
      actorId: userId,
      ip,
      userAgent,
      success,
      errorMessage,
    });
  }
}
