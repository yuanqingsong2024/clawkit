import type { WorkerConfig } from '../config';

interface TaskStatusResponse {
  data?: {
    status?: string;
  };
}

export class TaskCancellationService {
  constructor(private readonly config: WorkerConfig) {}

  async isCancelled(taskId: string): Promise<boolean> {
    const response = await fetch(`${this.config.controllerUrl}/api/tasks/${taskId}/status`);
    if (!response.ok) {
      throw new Error(`任务取消状态查询失败：${response.status}`);
    }

    const result = (await response.json()) as TaskStatusResponse;
    return result.data?.status === 'cancelled';
  }
}
