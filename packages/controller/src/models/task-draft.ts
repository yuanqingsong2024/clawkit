import { TaskPriority, TaskStatus } from '@clawkit/shared';

export interface TaskDraft {
  taskId: string;
  sourceText: string;
  projectKey: string;
  intent: string;
  constraints: string[];
  acceptanceCriteria: string[];
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: Date;
  updatedAt: Date;
  /** 任务执行超时时间（毫秒），默认 30 分钟 */
  executionTimeoutMs?: number;
  /** 任务失败重试次数，默认 0 次不重试 */
  maxRetries?: number;
}
