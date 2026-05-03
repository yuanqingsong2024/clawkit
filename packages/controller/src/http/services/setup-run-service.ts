import { randomUUID } from 'node:crypto';

import type { Manifest } from '@clawkit/shared';
import { ControllerErrorCode } from '@clawkit/shared';

import type { SetupRun } from '../../models/setup-run';
import type { SetupSession, SetupTopLevelStatus } from '../../models/setup-session';
import type { SetupStep } from '../../models/setup-step';
import type { SqliteTaskStore } from '../../persistence/sqlite-task-store';
import { SetupStreamService } from './setup-stream-service';
import { HttpError } from '../errors/http-error';

export interface SetupRunDetail {
  session: SetupSession;
  run: SetupRun;
  steps: SetupStep[];
}

interface CreateSetupRunInput {
  sessionId: string;
  topology: string;
  formData: Record<string, unknown>;
  manifest: Manifest;
  manifestYaml: string;
  parentRunId?: string | null;
}

const STEP_DEFINITIONS = [
  { key: 'generate_manifest', title: '生成 manifest' },
  { key: 'doctor', title: '执行 doctor' },
  { key: 'plan', title: '执行 plan' },
  { key: 'apply', title: '执行 apply' },
  { key: 'install_opencode', title: '安装并启动 OpenCode' },
  { key: 'deploy_openclaw', title: '部署 OpenClaw' },
  { key: 'check_controller', title: '检查 controller 状态' },
  { key: 'check_worker', title: '检查 worker 状态' },
  { key: 'check_opencode', title: '检查 OpenCode 状态' },
  { key: 'check_openclaw', title: '检查 OpenClaw 配置' },
  { key: 'smoke_test', title: '执行最小 smoke test' },
  { key: 'finalize_summary', title: '生成结果摘要' },
] as const;

export class SetupRunService {
  private readonly sessions = new Map<string, SetupSession>();
  private readonly runs = new Map<string, SetupRun>();
  private readonly stepsByRun = new Map<string, SetupStep[]>();

  constructor(
    private readonly streamService: SetupStreamService,
    private readonly taskStore: SqliteTaskStore | null,
  ) {}

  createRun(input: CreateSetupRunInput): SetupRunDetail {
    const now = new Date();
    const session: SetupSession = {
      sessionId: input.sessionId,
      topology: input.topology,
      status: 'ready',
      formData: input.formData,
      manifestPreview: input.manifestYaml,
      createdAt: now,
      updatedAt: now,
    };
    this.saveSession(session);

    const run: SetupRun = {
      runId: randomUUID(),
      sessionId: session.sessionId,
      parentRunId: input.parentRunId ?? null,
      status: 'ready',
      manifest: input.manifest,
      manifestYaml: input.manifestYaml,
      meta: {
        topology: input.topology,
        trigger: 'setup_orchestrator',
        apply: {
          dryRun: false,
          confirmExecution: true,
        },
        healHint: '如流程失败，可调用 /api/system/heal 或向导失败后修复入口进一步诊断。',
      },
      currentStep: null,
      summary: null,
      errorSummary: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
    };
    this.saveRun(run);

    const steps = STEP_DEFINITIONS.map((definition) => this.insertStep({
      runId: run.runId,
      stepKey: definition.key,
      title: definition.title,
      status: 'pending',
      logSummary: [],
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
    }));

    this.stepsByRun.set(run.runId, steps);

    return { session, run, steps };
  }

  markRunRunning(runId: string, currentStep: string): SetupRun {
    const run = this.requireRun(runId);
    const nextRun: SetupRun = {
      ...run,
      status: 'running',
      currentStep,
      startedAt: run.startedAt ?? new Date(),
      updatedAt: new Date(),
    };
    this.saveRun(nextRun);
    this.syncSessionStatus(nextRun.sessionId, 'running');
    return nextRun;
  }

  completeRun(runId: string, status: Exclude<SetupTopLevelStatus, 'draft' | 'ready' | 'running'>, summary: string, errorSummary: string | null): SetupRun {
    const run = this.requireRun(runId);
    const nextRun: SetupRun = {
      ...run,
      status,
      summary,
      errorSummary,
      currentStep: null,
      finishedAt: new Date(),
      updatedAt: new Date(),
    };
    this.saveRun(nextRun);
    this.syncSessionStatus(nextRun.sessionId, status);
    this.streamService.publish(this.streamService.buildEvent(runId, 'setup.summary', { summary, errorSummary }));
    return nextRun;
  }

  updateStep(runId: string, stepKey: string, updater: (step: SetupStep) => SetupStep): SetupStep {
    const steps = this.requireSteps(runId);
    const index = steps.findIndex((item) => item.stepKey === stepKey);
    if (index < 0) {
      throw new HttpError({
        statusCode: 404,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_INVALID,
        message: `setup step 不存在：${stepKey}`,
      });
    }

    const nextStep = updater(steps[index]);
    steps[index] = nextStep;
    this.stepsByRun.set(runId, [...steps]);

    if (this.taskStore) {
      this.taskStore.saveSetupStep(nextStep);
    }

    this.streamService.publish(this.streamService.buildEvent(runId, 'setup.step', { step: nextStep }));
    return nextStep;
  }

  appendStepLog(runId: string, stepKey: string, message: string): SetupStep {
    this.streamService.publish(this.streamService.buildEvent(runId, 'setup.log', { stepKey, message }));
    return this.updateStep(runId, stepKey, (step) => ({
      ...step,
      logSummary: [...step.logSummary, message],
      updatedAt: new Date(),
    }));
  }

  getRunDetail(runId: string): SetupRunDetail {
    const run = this.requireRun(runId);
    const session = this.requireSession(run.sessionId);
    const steps = this.requireSteps(runId);
    return {
      session,
      run,
      steps,
    };
  }

  listRuns(): SetupRunDetail[] {
    const runs = this.taskStore ? this.taskStore.loadAllSetupRuns() : Array.from(this.runs.values());
    return runs.map((run) => this.getRunDetail(run.runId));
  }

  subscribe(runId: string, listener: Parameters<SetupStreamService['subscribe']>[1]): () => void {
    return this.streamService.subscribe(runId, listener);
  }

  createRetry(runId: string): SetupRunDetail {
    const detail = this.getRunDetail(runId);
    return this.createRun({
      sessionId: detail.session.sessionId,
      topology: detail.session.topology,
      formData: detail.session.formData !== null ? detail.session.formData : {},
      manifest: detail.run.manifest,
      manifestYaml: detail.run.manifestYaml,
      parentRunId: detail.run.runId,
    });
  }

  private saveSession(session: SetupSession): void {
    this.sessions.set(session.sessionId, session);
    if (this.taskStore) {
      this.taskStore.saveSetupSession(session);
    }
  }

  private syncSessionStatus(sessionId: string, status: SetupSession['status']): void {
    const session = this.requireSession(sessionId);
    if (session.status === status) {
      return;
    }

    this.saveSession({
      ...session,
      status,
      updatedAt: new Date(),
    });
  }

  private saveRun(run: SetupRun): void {
    this.runs.set(run.runId, run);
    if (this.taskStore) {
      this.taskStore.saveSetupRun(run);
    }

    try {
      const detail = this.getRunDetail(run.runId);
      this.streamService.publishRun(run, { session: detail.session, steps: detail.steps });
    } catch {
      this.streamService.publishRun(run);
    }
  }

  private insertStep(step: Omit<SetupStep, 'stepId'>): SetupStep {
    const saved = this.taskStore ? this.taskStore.insertSetupStep(step) : { ...step, stepId: Date.now() + Math.floor(Math.random() * 1000) };
    this.streamService.publishStep(step.runId, saved);
    return saved;
  }

  private requireRun(runId: string): SetupRun {
    const run = this.runs.get(runId) ?? this.taskStore?.loadSetupRun(runId);
    if (!run) {
      throw new HttpError({
        statusCode: 404,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_INVALID,
        message: `setup run 不存在：${runId}`,
      });
    }
    this.runs.set(runId, run);
    return run;
  }

  private requireSession(sessionId: string): SetupSession {
    const session = this.sessions.get(sessionId) ?? this.taskStore?.loadSetupSession(sessionId);
    if (!session) {
      throw new HttpError({
        statusCode: 404,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_INVALID,
        message: `setup session 不存在：${sessionId}`,
      });
    }
    this.sessions.set(sessionId, session);
    return session;
  }

  private requireSteps(runId: string): SetupStep[] {
    const existing = this.stepsByRun.get(runId) ?? this.taskStore?.loadSetupSteps(runId);
    if (!existing) {
      throw new HttpError({
        statusCode: 404,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_INVALID,
        message: `setup steps 不存在：${runId}`,
      });
    }
    this.stepsByRun.set(runId, existing);
    return [...existing];
  }
}
