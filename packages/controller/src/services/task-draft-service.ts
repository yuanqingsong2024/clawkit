import { TaskStatus } from '@clawkit/shared';
import { randomUUID } from 'crypto';

import type { CreateTaskProtocol } from '../protocol/types';
import type { TaskDraft } from '../models/task-draft';

/**
 * TaskDraft 创建服务
 * 负责将协议对象转换为 TaskDraft 模型
 */
export interface TaskDraftService {
  /**
   * 从创建任务协议生成 TaskDraft
   * @param protocol 创建任务协议对象
   * @returns 新创建的 TaskDraft
   */
  createFromProtocol(protocol: CreateTaskProtocol): TaskDraft;
}

/**
 * TaskDraft 创建服务的默认实现
 */
export class TaskDraftServiceImpl implements TaskDraftService {
  createFromProtocol(protocol: CreateTaskProtocol): TaskDraft {
    const now = new Date();
    const taskId = this.generateTaskId(protocol.projectKey);

    return {
      taskId,
      sourceText: protocol.rawText,
      projectKey: protocol.projectKey,
      intent: protocol.goal,
      constraints: protocol.constraints,
      acceptanceCriteria: protocol.acceptanceCriteria,
      status: TaskStatus.DRAFT,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * 生成任务 ID
   * 格式：{projectKey}-{timestamp}-{random}
   */
  private generateTaskId(projectKey: string): string {
    const timestamp = Date.now().toString(36);
    const random = randomUUID().split('-')[0];
    return `${projectKey}-${timestamp}-${random}`;
  }
}
