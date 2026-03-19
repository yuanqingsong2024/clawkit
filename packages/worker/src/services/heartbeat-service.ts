import type { WorkerHeartbeatRequest, WorkerStatus } from '@clawkit/shared';

import type { WorkerConfig } from '../config';

export class HeartbeatService {
  private intervalId?: NodeJS.Timeout;

  constructor(
    private config: WorkerConfig,
    private getStatus: () => WorkerStatus,
    private getCurrentTaskId: () => string | undefined,
  ) {}

  start(): void {
    if (this.intervalId) {
      return;
    }

    this.intervalId = setInterval(() => {
      this.sendHeartbeat().catch((error) => {
        console.error('心跳发送失败:', error.message);
      });
    }, this.config.heartbeatIntervalMs);

    console.log(`心跳服务已启动，间隔 ${this.config.heartbeatIntervalMs}ms`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('心跳服务已停止');
    }
  }

  private async sendHeartbeat(): Promise<void> {
    const request: WorkerHeartbeatRequest = {
      status: this.getStatus(),
      currentTaskId: this.getCurrentTaskId(),
    };

    const response = await fetch(
      `${this.config.controllerUrl}/api/workers/${this.config.workerId}/heartbeat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`心跳发送失败：${response.status} ${error}`);
    }
  }
}
