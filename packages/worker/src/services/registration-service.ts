import type { WorkerRegisterRequest, WorkerRecord } from '@clawkit/shared';

import type { WorkerConfig } from '../config';

export class WorkerRegistrationService {
  constructor(private config: WorkerConfig) {}

  async register(): Promise<WorkerRecord> {
    const request: WorkerRegisterRequest = {
      workerId: this.config.workerId,
      name: this.config.name,
      nodeName: this.config.nodeName,
      connectMode: this.config.connectMode,
      tags: this.config.tags,
      supportedProjects: this.config.supportedProjects,
    };

    const response = await fetch(`${this.config.controllerUrl}/api/workers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Worker 注册失败：${response.status} ${error}`);
    }

    const result = (await response.json()) as { data: WorkerRecord };
    return result.data;
  }
}
