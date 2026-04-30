import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

import {
  CheckStatus,
  ControllerErrorCode,
  ManifestSchema,
  WorkerStatus,
  type DoctorReport,
  type Manifest,
  type WorkerRecord,
} from '@clawkit/shared';
import {
  ApplyService,
  DoctorServiceImpl,
  HealService,
  ManifestLoader,
  PlanServiceImpl,
  type ApplyResult,
  type DryRunPlan,
  type HealResult,
} from '@clawkit/cli/services';
import * as yaml from 'yaml';

import type { DispatchService } from '../../services/dispatch-service';
import type { ProjectRegistry } from '../../services/project-registry';
import type { WorkerRegistry } from '../../services/worker-registry';
import type { TaskListItem } from '../../services/controller-flow-service';
import type { ControllerApiService } from './controller-api-service';
import type { ControllerConfigDocument } from './controller-config-service';
import type { ControllerConfigService } from './controller-config-service';
import { HttpError } from '../errors/http-error';

export type SystemActionName = 'doctor' | 'plan' | 'apply' | 'heal';
export type SystemActionStatus = 'success' | 'warning' | 'failed';
export type StepStatus = 'success' | 'warning' | 'failed' | 'skipped';

export interface SystemActionStep {
  title: string;
  status: StepStatus;
  detail: string;
  suggestion?: string;
}

export interface SystemActionResult<T> {
  action: SystemActionName;
  dryRun: boolean;
  status: SystemActionStatus;
  summary: string;
  steps: SystemActionStep[];
  logs: string[];
  nextStep: string;
  startedAt: Date;
  finishedAt: Date;
  data: T | null;
}

export interface ManifestDocument {
  manifestPath: string;
  yamlText: string;
  manifest: Manifest;
  savedAt: Date;
  runtimeNotice: string;
}

export interface OverviewAlert {
  level: 'warning' | 'error';
  title: string;
  detail: string;
}

export interface OpenCodeStatusSummary {
  workerId: string;
  projectKey: string;
  nodeName: string;
  port: number;
  status: 'online' | 'offline' | 'unknown';
  detail: string;
}

export interface OverviewData {
  profile: {
    name: string;
    topology: string;
    description?: string;
  };
  manifestPath: string | null;
  controller: {
    status: 'online';
    apiPrefix: string;
    publicUrl: string;
    runtimeNotice: string;
  };
  workers: {
    total: number;
    online: number;
    idle: number;
    busy: number;
    offline: number;
    items: WorkerRecord[];
  };
  openClaw: {
    configured: boolean;
    publicUrl: string;
    tokenConfigured: boolean;
    detail: string;
  };
  openCode: OpenCodeStatusSummary[];
  latestDoctor: SystemActionResult<DoctorReport> | null;
  latestPlan: SystemActionResult<DryRunPlan> | null;
  latestApply: SystemActionResult<ApplyResult> | null;
  latestHeal: SystemActionResult<HealResult> | null;
  recentTasks: TaskListItem[];
  recentDispatches: ReturnType<DispatchService['getAllDispatches']>;
  alerts: OverviewAlert[];
}

export class WebConsoleService {
  private readonly manifestLoader = new ManifestLoader();
  private readonly doctorService = new DoctorServiceImpl();
  private readonly planService = new PlanServiceImpl();
  private readonly applyService = new ApplyService();
  private readonly healService = new HealService();
  private readonly latestResults: Partial<Record<SystemActionName, SystemActionResult<unknown>>> = {};

  constructor(
    private readonly apiService: ControllerApiService,
    private readonly workerRegistry: WorkerRegistry,
    private readonly dispatchService: DispatchService,
    private readonly controllerConfigService: ControllerConfigService,
    private readonly projectRegistry: ProjectRegistry,
  ) {}

  async getOverview(): Promise<OverviewData> {
    const manifestDocument = this.tryGetManifest();

    this.workerRegistry.checkHeartbeatTimeout();
    const workers = this.workerRegistry.getAllWorkers();
    const openCode = manifestDocument
      ? await this.buildOpenCodeStatuses(manifestDocument.manifest)
      : [];
    const recentTasks = this.apiService.listTasks().tasks.slice(0, 6);
    const recentDispatches = this.dispatchService.getAllDispatches()
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 6);

    return {
      profile: manifestDocument
        ? {
            name: manifestDocument.manifest.profile.name,
            topology: manifestDocument.manifest.profile.topology,
            description: manifestDocument.manifest.profile.description,
          }
        : {
            name: '未加载 manifest',
            topology: 'unknown',
          },
      manifestPath: manifestDocument?.manifestPath ?? this.getConfiguredManifestPath(),
      controller: {
        status: 'online',
        apiPrefix: manifestDocument?.manifest.services.controller.apiPrefix ?? '/api',
        publicUrl: manifestDocument?.manifest.services.openClaw.publicUrl ?? '',
        runtimeNotice: 'manifest 保存后不会自动刷新 controller/worker 运行态，如需生效请重启相关进程。',
      },
      workers: {
        total: workers.length,
        online: workers.filter((worker) => worker.status !== WorkerStatus.OFFLINE).length,
        idle: workers.filter((worker) => worker.status === WorkerStatus.IDLE).length,
        busy: workers.filter((worker) => worker.status === WorkerStatus.BUSY).length,
        offline: workers.filter((worker) => worker.status === WorkerStatus.OFFLINE).length,
        items: workers,
      },
      openClaw: manifestDocument
        ? {
            configured: manifestDocument.manifest.services.openClaw.publicUrl.trim().length > 0,
            publicUrl: manifestDocument.manifest.services.openClaw.publicUrl,
            tokenConfigured: (manifestDocument.manifest.services.openClaw.apiKey?.trim().length ?? 0) > 0,
            detail: (manifestDocument.manifest.services.openClaw.apiKey?.trim().length ?? 0) > 0
              ? 'OpenClaw webhook token 已配置'
              : 'OpenClaw webhook token 缺失，后续调用会失败',
          }
        : {
            configured: false,
            publicUrl: '',
            tokenConfigured: false,
            detail: '当前未找到 manifest，无法判断 OpenClaw 配置状态',
          },
      openCode,
      latestDoctor: this.getLatestResult<DoctorReport>('doctor'),
      latestPlan: this.getLatestResult<DryRunPlan>('plan'),
      latestApply: this.getLatestResult<ApplyResult>('apply'),
      latestHeal: this.getLatestResult<HealResult>('heal'),
      recentTasks,
      recentDispatches,
      alerts: this.buildAlerts(workers, openCode),
    };
  }

  getManifest(): ManifestDocument {
    return this.requireManifest();
  }

  getControllerConfig(): ControllerConfigDocument {
    return this.controllerConfigService.getConfig();
  }

  saveControllerConfig(manifestPath: string): ControllerConfigDocument {
    const config = this.controllerConfigService.saveManifestPath(manifestPath);
    if (config.manifestPath !== null) {
      this.projectRegistry.reload(config.manifestPath);
    }
    return config;
  }

  saveManifest(yamlText: string): ManifestDocument {
    const manifestPath = this.requireManifestPath();
    let parsed: unknown;

    try {
      parsed = yaml.parse(yamlText);
    } catch (error) {
      throw new HttpError({
        statusCode: 400,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_INVALID,
        message: `manifest YAML 解析失败：${error instanceof Error ? error.message : '未知错误'}`,
      });
    }

    const result = ManifestSchema.safeParse(parsed);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      throw new HttpError({
        statusCode: 400,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_INVALID,
        message: `manifest 校验失败：${firstIssue?.message ?? '未知错误'}`,
        details: result.error.issues,
      });
    }

    fs.writeFileSync(manifestPath, yamlText.endsWith('\n') ? yamlText : `${yamlText}\n`, 'utf8');
    
    this.projectRegistry.reload(manifestPath);
    
    return this.requireManifest();
  }

  async runDoctor(): Promise<SystemActionResult<DoctorReport>> {
    const manifestPath = this.requireManifestPath();
    const startedAt = new Date();
    const report = await this.doctorService.diagnose(manifestPath);
    const steps = report.checks.map<SystemActionStep>((check: DoctorReport['checks'][number]) => ({
      title: check.name,
      status: this.mapCheckStatus(check.status),
      detail: check.message,
      suggestion: check.suggestion,
    }));

    const actionResult: SystemActionResult<DoctorReport> = {
      action: 'doctor',
      dryRun: true,
      status: report.overallStatus === CheckStatus.FAIL ? 'failed' : report.overallStatus === CheckStatus.WARN ? 'warning' : 'success',
      summary: `Doctor 完成：${report.passCount} 通过，${report.warnCount} 警告，${report.failCount} 失败`,
      steps,
      logs: steps.map((step: SystemActionStep) => `${step.title}：${step.detail}${step.suggestion ? `（建议：${step.suggestion}）` : ''}`),
      nextStep: report.overallStatus === CheckStatus.FAIL
        ? '请先修复失败项，再执行 plan 或 apply'
        : '可继续执行 plan 预览部署步骤',
      startedAt,
      finishedAt: new Date(),
      data: report,
    };

    this.recordResult(actionResult);
    return actionResult;
  }

  runPlan(): SystemActionResult<DryRunPlan> {
    const manifestPath = this.requireManifestPath();
    const startedAt = new Date();
    const loaded = this.planService.loadManifest(manifestPath);

    if (loaded.errors || !loaded.manifest) {
      const failedResult: SystemActionResult<DryRunPlan> = {
        action: 'plan',
        dryRun: true,
        status: 'failed',
        summary: 'Plan 生成失败',
        steps: (loaded.errors ?? ['未知错误']).map((message: string) => ({
          title: 'Plan 校验错误',
          status: 'failed',
          detail: message,
        })),
        logs: loaded.errors ?? ['未知错误'],
        nextStep: '请先修正 manifest，再重新执行 plan',
        startedAt,
        finishedAt: new Date(),
        data: null,
      };

      this.recordResult(failedResult);
      return failedResult;
    }

    const plan = this.planService.generateDryRunPlan(loaded.manifest, manifestPath);
    const steps = plan.actions.map<SystemActionStep>((action: DryRunPlan['actions'][number]) => ({
      title: `${action.category} / ${action.description}`,
      status: action.implemented ? 'success' : 'warning',
      detail: `节点：${action.node}；${action.implemented ? '当前阶段已实现' : '当前阶段仍为占位能力'}`,
    }));

    const actionResult: SystemActionResult<DryRunPlan> = {
      action: 'plan',
      dryRun: true,
      status: plan.placeholders.length > 0 ? 'warning' : 'success',
      summary: `Plan 已生成，共 ${plan.actions.length} 个动作，涉及 ${plan.nodes.length} 个节点`,
      steps,
      logs: [
        `拓扑：${plan.topology}`,
        `角色：${plan.roles.map((role: DryRunPlan['roles'][number]) => `${role.role}@${role.node}`).join('；')}`,
        ...plan.dependencies.map((dependency: string) => `依赖检查：${dependency}`),
      ],
      nextStep: '确认计划无误后，可继续执行 apply',
      startedAt,
      finishedAt: new Date(),
      data: plan,
    };

    this.recordResult(actionResult);
    return actionResult;
  }

  async runApply(input: { dryRun?: boolean; onlyLocal?: boolean; confirmExecution?: boolean } = {}): Promise<SystemActionResult<ApplyResult>> {
    const manifestPath = this.requireManifestPath();
    const dryRun = input.dryRun ?? true;
    if (!dryRun && input.confirmExecution !== true) {
      throw new HttpError({
        statusCode: 400,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING,
        message: '执行真实 apply 前必须显式确认 confirmExecution=true',
      });
    }

    const startedAt = new Date();

    try {
      const result = this.applyService.apply(manifestPath, {
        dryRun,
        onlyLocal: input.onlyLocal ?? false,
      });
      const steps = result.filePlans.map<SystemActionStep>((plan: ApplyResult['filePlans'][number]) => ({
        title: plan.description,
        status: 'success',
        detail: `${plan.nodeName} -> ${plan.targetPath}`,
      }));
      const logs = [
        ...result.notes,
        ...result.generatedFiles.map((file: string) => `已生成：${file}`),
        ...result.backupFiles.map((file: string) => `已备份：${file}`),
        ...result.skippedFiles.map((file: string) => `已跳过：${file}`),
      ];
      const actionResult: SystemActionResult<ApplyResult> = {
        action: 'apply',
        dryRun,
        status: 'success',
        summary: dryRun
          ? `Apply 预览完成，共 ${result.filePlans.length} 个输出文件计划`
          : `Apply 执行完成，共写入 ${result.generatedFiles.length} 个文件`,
        steps,
        logs,
        nextStep: dryRun
          ? '如确认无误，可勾选真实执行后再次 apply'
          : '配置文件已写入；如需让新配置生效，请重启 controller/worker/OpenCode 相关进程',
        startedAt,
        finishedAt: new Date(),
        data: result,
      };

      this.recordResult(actionResult);
      return actionResult;
    } catch (error) {
      const failedResult: SystemActionResult<ApplyResult> = {
        action: 'apply',
        dryRun,
        status: 'failed',
        summary: 'Apply 执行失败',
        steps: [{ title: 'Apply 执行', status: 'failed', detail: error instanceof Error ? error.message : '未知错误' }],
        logs: [error instanceof Error ? error.message : '未知错误'],
        nextStep: '请先修正 manifest、SSH 连通性或本地路径，再重新执行 apply',
        startedAt,
        finishedAt: new Date(),
        data: null,
      };

      this.recordResult(failedResult);
      return failedResult;
    }
  }

  async runHeal(input: { dryRun?: boolean; confirmExecution?: boolean } = {}): Promise<SystemActionResult<HealResult>> {
    const manifestPath = this.requireManifestPath();
    const dryRun = input.dryRun ?? true;
    if (!dryRun && input.confirmExecution !== true) {
      throw new HttpError({
        statusCode: 400,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING,
        message: '执行真实 heal 前必须显式确认 confirmExecution=true',
      });
    }

    const startedAt = new Date();
    const result = await this.healService.heal(manifestPath, {
      dryRun,
      force: !dryRun,
    });
    const steps = result.issues.map<SystemActionStep>((issue: HealResult['issues'][number]) => ({
      title: issue.title,
      status: this.mapCheckStatus(issue.status),
      detail: issue.message,
      suggestion: issue.suggestion,
    }));
    const hasFailure = result.issues.some((issue: HealResult['issues'][number]) => issue.status === CheckStatus.FAIL);
    const hasWarning = result.issues.some((issue: HealResult['issues'][number]) => issue.status === CheckStatus.WARN);
    const actionResult: SystemActionResult<HealResult> = {
      action: 'heal',
      dryRun,
      status: hasFailure ? 'failed' : hasWarning ? 'warning' : 'success',
      summary: dryRun
        ? `Heal 诊断完成，共发现 ${result.issues.length} 项问题`
        : `Heal 执行完成，共应用 ${result.appliedFixes.length} 项修复`,
      steps,
      logs: [
        ...result.plannedFixes.map((item: string) => `计划修复：${item}`),
        ...result.appliedFixes.map((item: string) => `已修复：${item}`),
        ...result.issues.map((issue: HealResult['issues'][number]) => `${issue.title}：${issue.message}`),
      ],
      nextStep: dryRun
        ? '先确认可修复项，再决定是否执行真实 heal'
        : '修复已执行；若涉及运行配置，请重启相关进程后再次检查状态',
      startedAt,
      finishedAt: new Date(),
      data: result,
    };

    this.recordResult(actionResult);
    return actionResult;
  }

  private buildAlerts(workers: WorkerRecord[], openCode: OpenCodeStatusSummary[]): OverviewAlert[] {
    const alerts: OverviewAlert[] = [];

    for (const worker of workers) {
      if (worker.status === WorkerStatus.OFFLINE) {
        alerts.push({
          level: 'warning',
          title: `Worker 离线：${worker.workerId}`,
          detail: `最后心跳时间：${worker.lastHeartbeatAt.toISOString()}`,
        });
      }
    }

    for (const status of openCode) {
      if (status.status === 'offline') {
        alerts.push({
          level: 'warning',
          title: `OpenCode 不可达：${status.projectKey}`,
          detail: status.detail,
        });
      }
    }

    const latestDoctor = this.getLatestResult<DoctorReport>('doctor');
    if (latestDoctor && latestDoctor.status !== 'success') {
      alerts.push({
        level: latestDoctor.status === 'failed' ? 'error' : 'warning',
        title: '最近一次 doctor 存在异常',
        detail: latestDoctor.summary,
      });
    }

    const latestHeal = this.getLatestResult<HealResult>('heal');
    if (latestHeal && latestHeal.status !== 'success') {
      alerts.push({
        level: latestHeal.status === 'failed' ? 'error' : 'warning',
        title: '最近一次 heal 存在未修复问题',
        detail: latestHeal.summary,
      });
    }

    return alerts.slice(0, 8);
  }

  private async buildOpenCodeStatuses(manifest: Manifest): Promise<OpenCodeStatusSummary[]> {
    const statuses: OpenCodeStatusSummary[] = [];

    for (const worker of manifest.workers) {
      const node = manifest.nodes[worker.node];
      for (const project of worker.projects) {
        if (node.type !== 'local') {
          statuses.push({
            workerId: worker.id,
            projectKey: project.key,
            nodeName: worker.node,
            port: project.openCode.port,
            status: 'unknown',
            detail: '远程节点当前阶段不做主动探测',
          });
          continue;
        }

        const health = await this.checkHttp(`http://127.0.0.1:${project.openCode.port}/global/health`);
        statuses.push({
          workerId: worker.id,
          projectKey: project.key,
          nodeName: worker.node,
          port: project.openCode.port,
          status: health.ok ? 'online' : 'offline',
          detail: health.ok ? 'OpenCode server 可达' : `OpenCode server 不可达：${health.message}`,
        });
      }
    }

    return statuses;
  }

  private async checkHttp(url: string): Promise<{ ok: boolean; message: string }> {
    return new Promise((resolve) => {
      try {
        const target = new URL(url);
        const client = target.protocol === 'https:' ? https : http;
        const request = client.request({
          hostname: target.hostname,
          port: target.port,
          path: `${target.pathname}${target.search}`,
          method: 'GET',
          timeout: 1500,
        }, (response) => {
          resolve({
            ok: (response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300,
            message: `HTTP ${response.statusCode ?? 500}`,
          });
        });

        request.on('timeout', () => {
          request.destroy(new Error('请求超时'));
        });
        request.on('error', (error) => {
          resolve({ ok: false, message: error.message });
        });
        request.end();
      } catch (error) {
        resolve({
          ok: false,
          message: error instanceof Error ? error.message : '未知网络错误',
        });
      }
    });
  }

  private recordResult<T>(result: SystemActionResult<T>): void {
    this.latestResults[result.action] = result;
  }

  private getLatestResult<T>(action: SystemActionName): SystemActionResult<T> | null {
    const result = this.latestResults[action];
    return result ? result as SystemActionResult<T> : null;
  }

  private tryGetManifest(): ManifestDocument | null {
    try {
      return this.requireManifest();
    } catch {
      return null;
    }
  }

  private requireManifest(): ManifestDocument {
    const manifestPath = this.requireManifestPath();
    const resolvedPath = path.resolve(manifestPath);
    const yamlText = fs.readFileSync(resolvedPath, 'utf8');
    const loaded = this.manifestLoader.load(resolvedPath);
    const stats = fs.statSync(resolvedPath);

    return {
      manifestPath: loaded.manifestPath,
      yamlText,
      manifest: loaded.manifest,
      savedAt: stats.mtime,
      runtimeNotice: '配置已保存到 manifest 文件，但 controller / worker 当前内存态不会自动刷新。',
    };
  }

  private getConfiguredManifestPath(): string | null {
    return this.controllerConfigService.getConfig().manifestPath;
  }

  private requireManifestPath(): string {
    const manifestPath = this.getConfiguredManifestPath();
    if (manifestPath === null) {
      throw new HttpError({
        statusCode: 404,
        errorCode: ControllerErrorCode.PROJECT_CONFIG_NOT_FOUND,
        message: '当前未配置 CLAWKIT_MANIFEST_PATH，无法读取或保存 manifest',
      });
    }

    return manifestPath;
  }

  private mapCheckStatus(status: CheckStatus): StepStatus {
    switch (status) {
      case CheckStatus.PASS:
        return 'success';
      case CheckStatus.WARN:
        return 'warning';
      case CheckStatus.FAIL:
        return 'failed';
      case CheckStatus.SKIP:
        return 'skipped';
      default:
        return 'warning';
    }
  }
}
