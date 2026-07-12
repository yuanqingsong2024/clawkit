import type { WorkerPullTaskResponse } from '@clawkit/shared';

import type { WorkerConfig } from '../config';

export class TaskPullService {
  constructor(private config: WorkerConfig) {}

  async pullTask(): Promise<WorkerPullTaskResponse> {
    const response = await fetch(
      `${this.config.controllerUrl}/api/workers/${this.config.workerId}/pull`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`任务拉取失败：${response.status} ${error}`);
    }

    const result = (await response.json()) as { data: WorkerPullTaskResponse };
    return result.data;
  }
}
