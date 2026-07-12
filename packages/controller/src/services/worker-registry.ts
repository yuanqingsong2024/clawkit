import {
  ControllerErrorCode,
  WorkerRecord,
  WorkerRegisterRequest,
  WorkerHeartbeatRequest,
  WorkerStatus,
} from '@clawkit/shared';

export class WorkerRegistry {
  private workers: Map<string, WorkerRecord> = new Map();
  private heartbeatTimeoutMs: number = 30000;

  register(request: WorkerRegisterRequest): WorkerRecord {
    const now = new Date();
    const existing = this.workers.get(request.workerId);

    if (existing) {
      existing.name = request.name;
      existing.nodeName = request.nodeName;
      existing.connectMode = request.connectMode;
      existing.tags = request.tags;
      existing.labels = request.labels ?? existing.labels ?? this.deriveLabels(existing.name, request.tags);
      existing.capabilities = request.capabilities ?? existing.capabilities ?? this.deriveCapabilities(request.tags, request.supportedProjects);
      existing.maxConcurrency = request.maxConcurrency ?? existing.maxConcurrency ?? 1;
      existing.runningCount = existing.runningCount ?? 0;
      existing.riskPolicy = existing.riskPolicy ?? this.buildRiskPolicy(existing.labels ?? {});
      existing.maintenance = existing.maintenance ?? false;
      existing.supportedProjects = request.supportedProjects;
      existing.status = WorkerStatus.IDLE;
      existing.lastHeartbeatAt = now;
      existing.updatedAt = now;
      return existing;
    }

    const record: WorkerRecord = {
      workerId: request.workerId,
      name: request.name,
      nodeName: request.nodeName,
      connectMode: request.connectMode,
      tags: request.tags,
      labels: request.labels ?? this.deriveLabels(request.name, request.tags),
      capabilities: request.capabilities ?? this.deriveCapabilities(request.tags, request.supportedProjects),
      maxConcurrency: request.maxConcurrency ?? 1,
      runningCount: 0,
      riskPolicy: this.buildRiskPolicy(request.labels ?? this.deriveLabels(request.name, request.tags)),
      maintenance: false,
      supportedProjects: request.supportedProjects,
      status: WorkerStatus.IDLE,
      lastHeartbeatAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.workers.set(request.workerId, record);
    return record;
  }

  heartbeat(workerId: string, request: WorkerHeartbeatRequest): WorkerRecord {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`${ControllerErrorCode.WORKER_NOT_FOUND}：Worker ${workerId} 未注册`);
    }

    const now = new Date();
    worker.status = request.status;
    worker.currentTaskId = request.currentTaskId;
    worker.lastHeartbeatAt = now;
    worker.updatedAt = now;

    return worker;
  }

  getWorker(workerId: string): WorkerRecord | undefined {
    return this.workers.get(workerId);
  }

  getAllWorkers(): WorkerRecord[] {
    return Array.from(this.workers.values());
  }

  getAvailableWorkers(): WorkerRecord[] {
    const now = Date.now();
    return Array.from(this.workers.values()).filter((worker) => {
      const isAlive = now - worker.lastHeartbeatAt.getTime() < this.heartbeatTimeoutMs;
      return isAlive && worker.status === WorkerStatus.IDLE;
    });
  }

  findWorkerForProject(projectKey: string): WorkerRecord | null {
    const available = this.getAvailableWorkers();

    const exactMatch = available.find((w) => w.supportedProjects.includes(projectKey));
    if (exactMatch) {
      return exactMatch;
    }

    const wildcardMatch = available.find((w) => w.supportedProjects.includes('*'));
    if (wildcardMatch) {
      return wildcardMatch;
    }

    return null;
  }

  markWorkerBusy(workerId: string, taskId: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`${ControllerErrorCode.WORKER_NOT_FOUND}：Worker ${workerId} 未注册`);
    }

    worker.status = WorkerStatus.BUSY;
    worker.currentTaskId = taskId;
    worker.runningCount = 1;
    worker.updatedAt = new Date();
  }

  markWorkerIdle(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`${ControllerErrorCode.WORKER_NOT_FOUND}：Worker ${workerId} 未注册`);
    }

    worker.status = WorkerStatus.IDLE;
    worker.currentTaskId = undefined;
    worker.runningCount = 0;
    worker.updatedAt = new Date();
  }

  checkHeartbeatTimeout(): void {
    const now = Date.now();
    for (const worker of this.workers.values()) {
      if (now - worker.lastHeartbeatAt.getTime() > this.heartbeatTimeoutMs) {
        worker.status = WorkerStatus.OFFLINE;
        worker.updatedAt = new Date();
      }
    }
  }

  private deriveLabels(name: string, tags: string[]): Record<string, string | boolean> {
    const normalizedTags = tags.map((tag) => tag.toLowerCase());
    const isSandbox = normalizedTags.some((tag) => tag.includes('sandbox') || tag.includes('test')) || /sandbox|test/i.test(name);

    return {
      env: isSandbox ? 'sandbox' : 'prod',
      role: isSandbox ? 'test-worker' : 'worker',
      sandbox: isSandbox,
    };
  }

  private deriveCapabilities(tags: string[], supportedProjects: string[]): string[] {
    const capabilities = new Set<string>(['opencode']);
    const normalizedTags = tags.map((tag) => tag.toLowerCase());

    if (normalizedTags.some((tag) => tag.includes('shell'))) {
      capabilities.add('shell');
    }

    if (normalizedTags.some((tag) => tag.includes('git'))) {
      capabilities.add('git-readonly');
    }

    if (supportedProjects.includes('*')) {
      capabilities.add('multi-project');
    }

    return Array.from(capabilities);
  }

  private buildRiskPolicy(labels: Record<string, string | boolean>): { allowedRiskLevels: string[]; blockedRiskLevels: string[] } {
    const isSandbox = labels.sandbox === true || labels.env === 'sandbox' || labels.role === 'test-worker';

    return isSandbox
      ? { allowedRiskLevels: ['low', 'medium'], blockedRiskLevels: ['high', 'urgent', 'critical'] }
      : { allowedRiskLevels: ['low'], blockedRiskLevels: ['medium', 'high', 'urgent', 'critical'] };
  }
}
