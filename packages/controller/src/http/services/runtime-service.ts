import { randomUUID } from 'node:crypto';

import { ControllerErrorCode, TaskStatus } from '@clawkit/shared';

import type { ControllerFlowServiceImpl } from '../../services/controller-flow-service';
import type { DispatchService } from '../../services/dispatch-service';
import type { WorkerRegistry } from '../../services/worker-registry';

export interface RuntimeTaskDraftRequest {
  requestId: string;
  idempotencyKey?: string;
  source?: string;
  sourceTaskId?: string;
  sourceTaskCardId?: string;
  title: string;
  description: string;
  projectName: string;
  projectPath?: string;
  riskLevel?: string;
  executionMode?: string;
  promptDraft?: string;
  contextSummary?: string;
  allowedScopes?: string[];
  forbiddenScopes?: string[];
  outputArtifacts?: string[];
  acceptanceCriteria?: string[];
  rollbackPlan?: string;
  approvalsRequired?: boolean;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeDryRunRequest {
  requestId: string;
  idempotencyKey?: string;
  remoteDraftId: string;
  sourceTaskId?: string;
  previewId?: string;
  targetWorkerId?: string;
  targetWorkerGroup?: string;
  executionMode?: string;
  riskLevel?: string;
  promptDraftSummary?: string;
  allowedScopes?: string[];
  forbiddenScopes?: string[];
  requiredApprovals?: boolean;
  dispatchPolicy?: {
    sandboxOnly?: boolean;
    productionAllowed?: boolean;
  };
  metadata?: Record<string, unknown>;
}

export interface RuntimeDispatchRequest {
  requestId: string;
  idempotencyKey?: string;
  dryRunId?: string;
  remoteDraftId: string;
  sourceTaskId?: string;
  previewId?: string;
  targetWorkerId: string;
  targetWorkerName?: string;
  targetWorkerLabels?: Record<string, string | boolean>;
  dispatchMode?: string;
  riskLevel?: string;
  approvalId?: string;
  dryRunReportId?: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeWorkerResult {
  dispatchId: string;
  taskId: string;
  remoteDraftId: string;
  workerId: string;
  workerName: string;
  projectKey: string;
  status: 'completed' | 'failed' | 'queued' | 'running';
  outputSummary: string;
  changedFiles: string[];
  logs: Array<{ level: 'info' | 'warn' | 'error'; message: string; timestamp: string }>;
  artifacts: Array<{ type: string; path: string }>;
  exitCode: number;
  duration: number;
  resultSource: 'runtime-memory' | 'worker-report';
  updatedAt: string;
  errorMessage: string | null;
}

export type RuntimeWorkerResultResponse =
  | {
      success: true;
      data: RuntimeWorkerResult;
    }
  | {
      success: false;
      code: 'controller.result_pending';
      message: string;
      details: null;
    };

export interface RuntimeDispatchRecord {
  dispatchId: string;
  remoteDispatchId: string;
  taskId: string;
  workerId: string;
  workerName: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout' | 'unknown';
  progress: number;
  startedAt: string | null;
  finishedAt: string | null;
  resultSummary: string | null;
  errorMessage: string | null;
  updatedAt: string;
  result?: RuntimeWorkerResult;
}

interface RuntimeDispatchEntry extends RuntimeDispatchRecord {
  requestId: string;
  idempotencyKey?: string;
}

export class RuntimeService {
  private readonly draftRequestByIdempotency = new Map<string, RuntimeTaskDraftRequest>();
  private readonly draftTaskIdByIdempotency = new Map<string, string>();
  private readonly draftTaskIdByRemoteDraftId = new Map<string, string>();
  private readonly dispatches = new Map<string, RuntimeDispatchEntry>();
  private readonly dispatchByIdempotency = new Map<string, RuntimeDispatchEntry>();

  constructor(
    private readonly flowService: ControllerFlowServiceImpl,
    private readonly dispatchService: DispatchService,
    private readonly workerRegistry: WorkerRegistry,
    private readonly options: {
      productionDispatchEnabled: boolean;
    } = { productionDispatchEnabled: false },
  ) {}

  buildHealth(): { success: true; status: 'ok'; service: string; version: string; mode: string; timestamp: string } {
    return {
      success: true,
      status: 'ok',
      service: 'clawkit-controller',
      version: this.getVersion(),
      mode: 'controller',
      timestamp: new Date().toISOString(),
    };
  }

  buildStatus(): {
    success: true;
    controllerStatus: 'online';
    runtimeMode: 'sandbox-capable';
    taskDraftCreateEnabled: boolean;
    dispatchDryRunEnabled: boolean;
    sandboxDispatchEnabled: boolean;
    productionDispatchEnabled: boolean;
    openclawWebhookEnabled: false;
  } {
    return {
      success: true,
      controllerStatus: 'online',
      runtimeMode: 'sandbox-capable',
      taskDraftCreateEnabled: true,
      dispatchDryRunEnabled: true,
      sandboxDispatchEnabled: true,
      productionDispatchEnabled: this.options.productionDispatchEnabled,
      openclawWebhookEnabled: false,
    };
  }

  buildVersion(): { success: true; name: string; version: string; commit: string; buildTime: string } {
    return {
      success: true,
      name: 'clawkit',
      version: this.getVersion(),
      commit: process.env.CLAWKIT_COMMIT ?? 'optional',
      buildTime: process.env.CLAWKIT_BUILD_TIME ?? 'optional',
    };
  }

  buildCapabilities(): {
    success: true;
    capabilities: Record<string, boolean>;
    allowedActions: string[];
    forbiddenActions: string[];
  } {
    return {
      success: true,
      capabilities: {
        taskDraftCreate: true,
        dispatchDryRun: true,
        sandboxDispatch: true,
        productionDispatch: this.options.productionDispatchEnabled,
        workerStatusReadonly: true,
        workerResultReadonly: true,
        dispatchCancelSandboxOnly: false,
        openclawWebhook: false,
      },
      allowedActions: ['create-taskdraft', 'dispatch-dry-run', 'dispatch-to-sandbox-worker'],
      forbiddenActions: ['dispatch-to-production-worker', 'auto-approve', 'auto-execute', 'auto-deploy'],
    };
  }

  listWorkers(): {
    success: true;
    workers: Array<{
      id: string;
      name: string;
      status: 'online' | 'offline' | 'unknown';
      labels: Record<string, string | boolean>;
      capabilities: string[];
      supportedExecutors: string[];
      maxConcurrency: number;
      runningCount: number;
      lastHeartbeatAt: string;
      riskPolicy: { allowedRiskLevels: string[]; blockedRiskLevels: string[] };
      maintenance: boolean;
    }>;
  } {
    const now = Date.now();
    const workers = this.workerRegistry.getAllWorkers().map((worker) => {
      const isAlive = now - worker.lastHeartbeatAt.getTime() < 30000;
      const labels = worker.labels ?? this.deriveLabels(worker.name, worker.tags);
      return {
        id: worker.workerId,
        name: worker.name,
        status: (isAlive ? 'online' : 'offline') as 'online' | 'offline',
        labels,
        capabilities: worker.capabilities ?? ['opencode'],
        supportedExecutors: ['opencode'],
        maxConcurrency: worker.maxConcurrency ?? 1,
        runningCount: worker.runningCount ?? (worker.status === 'busy' ? 1 : 0),
        lastHeartbeatAt: worker.lastHeartbeatAt.toISOString(),
        riskPolicy: worker.riskPolicy ?? this.deriveRiskPolicy(labels),
        maintenance: worker.maintenance ?? false,
      };
    });

    return { success: true, workers };
  }

  createTaskDraft(request: RuntimeTaskDraftRequest): {
    success: true;
    remoteDraftId: string;
    status: 'created';
    createdAt: string;
    requestId: string;
    idempotencyKey: string | null;
    warnings: string[];
    rawResponseSummary: { stored: boolean; autoDispatched: boolean };
  } {
    const idempotencyKey = request.idempotencyKey?.trim() || null;
    if (idempotencyKey !== null && this.draftRequestByIdempotency.has(idempotencyKey)) {
      const taskId = this.draftTaskIdByIdempotency.get(idempotencyKey) ?? request.requestId;
      return {
        success: true,
        remoteDraftId: this.buildRemoteDraftId(taskId),
        status: 'created',
        createdAt: new Date().toISOString(),
        requestId: request.requestId,
        idempotencyKey,
        warnings: ['DUPLICATE_REQUEST'],
        rawResponseSummary: { stored: true, autoDispatched: false },
      };
    }

    const taskText = this.buildTaskText(request);
    const created = this.flowService.createDraftFromText(taskText);
    void this.flowService.generatePromptDraft(created.taskDraft.taskId);
    const taskId = created.taskDraft.taskId;
    const remoteDraftId = this.buildRemoteDraftId(taskId);

    if (idempotencyKey !== null) {
      this.draftRequestByIdempotency.set(idempotencyKey, request);
      this.draftTaskIdByIdempotency.set(idempotencyKey, taskId);
    }
    this.draftTaskIdByRemoteDraftId.set(remoteDraftId, taskId);

    return {
      success: true,
      remoteDraftId,
      status: 'created',
      createdAt: created.taskDraft.createdAt.toISOString(),
      requestId: request.requestId,
      idempotencyKey,
      warnings: [],
      rawResponseSummary: { stored: true, autoDispatched: false },
    };
  }

  dryRun(request: RuntimeDryRunRequest): {
    success: true;
    dryRunId: string;
    status: 'eligible' | 'blocked';
    eligible: boolean;
    workerCandidates: Array<{ id: string; name: string; readiness: 'ready' | 'blocked'; reasons: string[] }>;
    blockedReasons: string[];
    warnings: string[];
    estimatedActions: string[];
    requiredApprovals: string[];
    requestId: string;
    idempotencyKey: string | null;
  } {
    const idempotencyKey = request.idempotencyKey?.trim() || null;
    const sandboxWorkers = this.listSandboxWorkers();
    const targetWorker = request.targetWorkerId ? this.workerRegistry.getWorker(request.targetWorkerId) : undefined;
    const blockedReasons: string[] = [];

    if (!targetWorker) {
      blockedReasons.push('未找到目标 worker');
    } else if (!this.isSandboxWorker(targetWorker)) {
      blockedReasons.push('目标 worker 不是 sandbox/test worker');
    }

    if (request.riskLevel && ['high', 'urgent', 'critical'].includes(request.riskLevel)) {
      blockedReasons.push('高风险任务禁止真实派发');
    }

    const workerCandidates = sandboxWorkers.map((worker) => ({
      id: worker.id,
      name: worker.name,
      readiness: (worker.id === request.targetWorkerId && blockedReasons.length === 0 ? 'ready' : 'blocked') as 'ready' | 'blocked',
      reasons: worker.id === request.targetWorkerId && blockedReasons.length === 0 ? [] : ['非目标 worker'],
    }));

    return {
      success: true,
      dryRunId: request.previewId ?? randomUUID(),
      status: blockedReasons.length === 0 ? 'eligible' : 'blocked',
      eligible: blockedReasons.length === 0,
      workerCandidates,
      blockedReasons,
      warnings: [],
      estimatedActions: ['create execution record', 'assign draft to sandbox worker', 'worker pulls task'],
      requiredApprovals: request.requiredApprovals ? ['boss-approval'] : [],
      requestId: request.requestId,
      idempotencyKey,
    };
  }

  dispatch(request: RuntimeDispatchRequest): {
    success: true;
    dispatchId: string;
    remoteDispatchId: string;
    status: 'queued';
    workerId: string;
    workerName: string;
    acceptedAt: string;
    requestId: string;
    idempotencyKey: string | null;
    warnings: string[];
  } {
    const idempotencyKey = request.idempotencyKey?.trim() || null;
    if (idempotencyKey !== null) {
      const existingEntry = this.dispatchByIdempotency.get(idempotencyKey);
      if (existingEntry) {
        return {
          success: true,
          dispatchId: existingEntry.dispatchId,
          remoteDispatchId: existingEntry.remoteDispatchId,
          status: existingEntry.status === 'unknown' ? 'queued' : 'queued',
          workerId: existingEntry.workerId,
          workerName: existingEntry.workerName,
          acceptedAt: existingEntry.updatedAt,
          requestId: request.requestId,
          idempotencyKey,
          warnings: ['DUPLICATE_REQUEST'],
        };
      }
    }

    const worker = this.workerRegistry.getWorker(request.targetWorkerId);
    if (!worker) {
      throw new Error(`${ControllerErrorCode.WORKER_NOT_FOUND}：未找到 worker ${request.targetWorkerId}`);
    }

    if (!this.isSandboxWorker(worker)) {
      throw new Error(`${ControllerErrorCode.AUTH_FORBIDDEN}：仅允许 sandbox/test worker 进入真实派发`);
    }

    if (request.riskLevel && ['high', 'urgent', 'critical'].includes(request.riskLevel)) {
      throw new Error(`${ControllerErrorCode.AUTH_FORBIDDEN}：高风险任务禁止真实派发`);
    }

    const taskId = this.draftTaskIdByRemoteDraftId.get(request.remoteDraftId) ?? request.sourceTaskId ?? request.remoteDraftId;
    if (taskId === request.remoteDraftId && !this.draftTaskIdByRemoteDraftId.has(request.remoteDraftId) && !request.sourceTaskId) {
      throw new Error(`${ControllerErrorCode.RESULT_PENDING}：未找到对应草稿，请先创建 TaskDraft`);
    }

    const inspected = this.flowService.inspectTask(taskId);
    if (inspected.taskDraft.status !== TaskStatus.APPROVED) {
      throw new Error(
        `${ControllerErrorCode.INVALID_TASK_STATUS_TRANSITION}：只有 approved 状态的任务才能真实派发，当前状态：${inspected.taskDraft.status}`,
      );
    }

    const dispatchRecord = this.dispatchService.dispatchTaskToWorker(taskId, worker.workerId);
    const acceptedAt = new Date().toISOString();
    const entry: RuntimeDispatchEntry = {
      requestId: request.requestId,
      idempotencyKey: idempotencyKey ?? undefined,
      dispatchId: dispatchRecord.dispatchId,
      remoteDispatchId: dispatchRecord.dispatchId,
      taskId,
      workerId: worker.workerId,
      workerName: worker.name,
      status: 'queued',
      progress: 0,
      startedAt: null,
      finishedAt: null,
      resultSummary: null,
      errorMessage: null,
      updatedAt: acceptedAt,
    };

    this.dispatches.set(entry.dispatchId, entry);
    if (idempotencyKey) {
      this.dispatchByIdempotency.set(idempotencyKey, entry);
    }

    return {
      success: true,
      dispatchId: entry.dispatchId,
      remoteDispatchId: entry.dispatchId,
      status: 'queued',
      workerId: worker.workerId,
      workerName: worker.name,
      acceptedAt,
      requestId: request.requestId,
      idempotencyKey,
      warnings: [],
    };
  }

  getDispatchStatus(dispatchId: string): RuntimeDispatchRecord {
    const entry = this.dispatches.get(dispatchId);
    if (!entry) {
      return {
        dispatchId,
        remoteDispatchId: dispatchId,
        taskId: '',
        workerId: '',
        workerName: '',
        status: 'unknown',
        progress: 0,
        startedAt: null,
        finishedAt: null,
        resultSummary: null,
        errorMessage: null,
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      dispatchId: entry.dispatchId,
      remoteDispatchId: entry.remoteDispatchId,
      taskId: entry.taskId,
      workerId: entry.workerId,
      workerName: entry.workerName,
      status: entry.status,
      progress: entry.progress,
      startedAt: entry.startedAt,
      finishedAt: entry.finishedAt,
      resultSummary: entry.resultSummary,
      errorMessage: entry.errorMessage,
      updatedAt: entry.updatedAt,
      result: entry.result,
    };
  }

  getWorkerResult(dispatchId: string): RuntimeWorkerResult | { success: false; code: 'controller.result_pending'; message: string } {
    const response = this.buildWorkerResultResponse(dispatchId);
    if (response.success) {
      return response.data;
    }

    return response;
  }

  getWorkerResultResponse(dispatchId: string): RuntimeWorkerResultResponse {
    return this.buildWorkerResultResponse(dispatchId);
  }

  recordWorkerResult(dispatchId: string, result: RuntimeWorkerResult): void {
    const entry = this.dispatches.get(dispatchId);
    if (!entry) {
      return;
    }

    entry.result = result;
    entry.resultSummary = result.outputSummary;
    entry.status = result.status === 'completed' ? 'completed' : 'failed';
    entry.progress = 100;
    entry.finishedAt = new Date().toISOString();
    entry.updatedAt = entry.finishedAt;
  }

  private listSandboxWorkers(): Array<{ id: string; name: string }> {
    return this.workerRegistry
      .getAllWorkers()
      .filter((worker) => this.isSandboxWorker(worker))
      .map((worker) => ({ id: worker.workerId, name: worker.name }));
  }

  private isSandboxWorker(worker: { name: string; tags: string[]; labels?: Record<string, string | boolean> }): boolean {
    const labels = worker.labels ?? this.deriveLabels(worker.name, worker.tags);
    return labels.env === 'sandbox' || labels.sandbox === true || labels.role === 'test-worker' || /sandbox|test/i.test(worker.name);
  }

  private deriveLabels(name: string, tags: string[]): Record<string, string | boolean> {
    const normalizedTags = tags.map((tag) => tag.toLowerCase());
    const isSandbox = normalizedTags.some((tag) => tag.includes('sandbox') || tag.includes('test')) || /sandbox|test/i.test(name);
    return { env: isSandbox ? 'sandbox' : 'prod', role: isSandbox ? 'test-worker' : 'worker', sandbox: isSandbox };
  }

  private deriveRiskPolicy(labels: Record<string, string | boolean>): { allowedRiskLevels: string[]; blockedRiskLevels: string[] } {
    const sandbox = labels.env === 'sandbox' || labels.sandbox === true || labels.role === 'test-worker';
    return sandbox
      ? { allowedRiskLevels: ['low', 'medium'], blockedRiskLevels: ['high', 'urgent', 'critical'] }
      : { allowedRiskLevels: ['low'], blockedRiskLevels: ['medium', 'high', 'urgent', 'critical'] };
  }

  private buildTaskText(request: RuntimeTaskDraftRequest): string {
    const constraintParts = [
      ...(request.allowedScopes ?? []),
      ...(request.forbiddenScopes ?? []).map((item) => `禁止：${item}`),
    ];

    const acceptance = request.acceptanceCriteria?.length ? request.acceptanceCriteria : [request.description];
    return [
      '#研发任务',
      `项目: ${request.projectName}`,
      `目标: ${request.title}`,
      `约束: ${constraintParts.join('；')}`,
      `验收: ${acceptance.join('；')}`,
    ].join('\n');
  }

  private buildRemoteDraftId(taskId: string): string {
    return `draft_${taskId}`;
  }

  private buildWorkerResultResponse(dispatchId: string): RuntimeWorkerResultResponse {
    const entry = this.dispatches.get(dispatchId);
    if (!entry) {
      return {
        success: false,
        code: 'controller.result_pending',
        message: '结果尚未生成',
        details: null,
      };
    }

    if (entry.result) {
      return {
        success: true,
        data: entry.result,
      };
    }

    const inspected = this.flowService.inspectTask(entry.taskId);
    const executionSummary = inspected.taskMemory.executionSummary;
    if (!executionSummary || (executionSummary.status !== 'done' && executionSummary.status !== 'failed')) {
      return {
        success: false,
        code: 'controller.result_pending',
        message: '结果尚未生成',
        details: null,
      };
    }

    const synthesized: RuntimeWorkerResult = {
      dispatchId,
      taskId: entry.taskId,
      remoteDraftId: this.buildRemoteDraftId(entry.taskId),
      workerId: entry.workerId,
      workerName: entry.workerName,
      projectKey: inspected.taskDraft.projectKey,
      status: executionSummary.status === 'done' ? 'completed' : 'failed',
      outputSummary: executionSummary.summary ?? executionSummary.note,
      changedFiles: executionSummary.changedFiles ?? [],
      logs: (executionSummary.logs ?? []).map((message) => ({
        level: 'info',
        message,
        timestamp: executionSummary.lastUpdatedAt?.toISOString() ?? new Date().toISOString(),
      })),
      artifacts: (executionSummary.changedFiles ?? []).map((filePath) => ({ type: 'file', path: filePath })),
      exitCode: executionSummary.status === 'done' ? 0 : 1,
      duration: 0,
      resultSource: 'runtime-memory',
      updatedAt: executionSummary.lastUpdatedAt?.toISOString() ?? new Date().toISOString(),
      errorMessage: executionSummary.status === 'failed' ? executionSummary.rawOutputSummary ?? '任务执行失败' : null,
    };

    entry.result = synthesized;
    entry.resultSummary = synthesized.outputSummary;

    return {
      success: true,
      data: synthesized,
    };
  }

  private getVersion(): string {
    return process.env.npm_package_version ?? '0.1.0';
  }
}
