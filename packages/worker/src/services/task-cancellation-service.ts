import { createLogger } from '@clawkit/shared';

import type { WorkerConfig } from '../config';

interface TaskStatusResponse {
  data?: {
    status?: string;
  };
}

/**
 * 取消模式枚举
 */
export enum CancellationMode {
  /**
   * 优雅终止 - 允许当前执行步骤完成，但不接受新步骤
   */
  GRACEFUL = 'graceful',
  /**
   * 强制终止 - 立即中断所有执行
   */
  FORCE = 'force',
}

interface CancellationInfo {
  cancelled: boolean;
  mode: CancellationMode;
  requestedAt?: Date;
}

/**
 * 任务取消服务
 * 负责检查任务取消状态并支持优雅/强制终止
 */
export class TaskCancellationService {
  private readonly logger = createLogger('TaskCancellationService');
  private activeCancellations = new Map<string, CancellationInfo>();

  constructor(private readonly config: WorkerConfig) {}

  /**
   * 检查任务是否已被请求取消
   */
  async isCancelled(taskId: string): Promise<boolean> {
    const cancellationInfo = this.activeCancellations.get(taskId);
    if (cancellationInfo) {
      return cancellationInfo.cancelled;
    }

    try {
      const response = await fetch(`${this.config.controllerUrl}/api/tasks/${taskId}/status`);
      if (!response.ok) {
        this.logger.warn(`任务 ${taskId} 取消状态查询失败：${response.status}`);
        return false;
      }

      const result = (await response.json()) as TaskStatusResponse;
      const isCancelled = result.data?.status === 'cancelled';

      if (isCancelled) {
        this.activeCancellations.set(taskId, {
          cancelled: true,
          mode: CancellationMode.GRACEFUL,
          requestedAt: new Date(),
        });
      }

      return isCancelled;
    } catch (error) {
      this.logger.warn(`任务 ${taskId} 取消状态查询异常：${error}`);
      return false;
    }
  }

  /**
   * 获取取消模式
   */
  async getCancellationMode(taskId: string): Promise<CancellationMode | null> {
    const cancellationInfo = this.activeCancellations.get(taskId);
    if (cancellationInfo) {
      return cancellationInfo.mode;
    }

    const isCancelled = await this.isCancelled(taskId);
    if (isCancelled) {
      return CancellationMode.GRACEFUL;
    }

    return null;
  }

  /**
   * 检查是否应该强制终止
   * 当处于强制终止模式时，立即中断
   */
  async shouldForceTerminate(taskId: string): Promise<boolean> {
    const cancellationInfo = this.activeCancellations.get(taskId);
    if (cancellationInfo?.mode === CancellationMode.FORCE) {
      return true;
    }

    try {
      const response = await fetch(`${this.config.controllerUrl}/api/tasks/${taskId}/status`);
      if (!response.ok) {
        return false;
      }

      const result = (await response.json()) as TaskStatusResponse;
      if (result.data?.status === 'cancelled') {
        this.activeCancellations.set(taskId, {
          cancelled: true,
          mode: CancellationMode.FORCE,
          requestedAt: new Date(),
        });
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * 请求取消任务（由 Controller 回调触发）
   */
  requestCancellation(taskId: string, mode: CancellationMode = CancellationMode.GRACEFUL): void {
    this.logger.info(`收到任务 ${taskId} 取消请求，模式：${mode}`);
    this.activeCancellations.set(taskId, {
      cancelled: true,
      mode,
      requestedAt: new Date(),
    });
  }

  /**
   * 清除取消状态
   */
  clearCancellation(taskId: string): void {
    this.activeCancellations.delete(taskId);
  }

  /**
   * 清除所有取消状态
   */
  clearAll(): void {
    this.activeCancellations.clear();
  }
}
