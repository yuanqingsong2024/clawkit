import type { WorkerHeartbeatRequest, WorkerStatus } from '@clawkit/shared';

import type { WorkerConfig } from '../config';
import { ResourceMonitor } from './resource-monitor';

export class HeartbeatService {
  private intervalId?: NodeJS.Timeout;
  private resourceMonitor: ResourceMonitor;

  constructor(
    private config: WorkerConfig,
    private getStatus: () => WorkerStatus,
    private getCurrentTaskId: () => string | undefined,
    private reRegister: () => Promise<void>,
  ) {
    this.resourceMonitor = new ResourceMonitor();
  }

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
    const resourceUsage = this.resourceMonitor.getResourceUsage();

    // 检查是否触发告警
    const alerts = this.resourceMonitor.checkAlerts(resourceUsage);
    if (alerts.length > 0) {
      console.warn('资源告警:', alerts.join('; '));
    }

    const request: WorkerHeartbeatRequest = {
      status: this.getStatus(),
      currentTaskId: this.getCurrentTaskId(),
      resourceUsage,
    };

    let response = await fetch(
      `${this.config.controllerUrl}/api/workers/${this.config.workerId}/heartbeat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      const workerMissing = response.status === 404 || errorText.includes('controller.worker_not_found');

      if (workerMissing) {
        console.warn(`检测到 Worker ${this.config.workerId} 未注册，正在自动重新注册`);
        await this.reRegister();

        response = await fetch(
          `${this.config.controllerUrl}/api/workers/${this.config.workerId}/heartbeat`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
          },
        );
      } else {
        throw new Error(`心跳发送失败：${response.status} ${errorText}`);
      }
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`心跳发送失败：${response.status} ${error}`);
    }
  }
}
