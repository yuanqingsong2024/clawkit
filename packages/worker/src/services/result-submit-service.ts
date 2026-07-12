import type { WorkerSubmitResultRequest } from '@clawkit/shared';

import type { WorkerConfig } from '../config';

export class ResultSubmitService {
  constructor(private config: WorkerConfig) {}

  async submitResult(result: WorkerSubmitResultRequest): Promise<void> {
    const response = await fetch(
      `${this.config.controllerUrl}/api/workers/${this.config.workerId}/result`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`结果提交失败：${response.status} ${error}`);
    }

    console.log(`任务 ${result.taskId} 结果提交成功`);
  }
}
