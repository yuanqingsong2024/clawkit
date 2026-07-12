import fs from 'node:fs';
import { spawn } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
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
  canStart: boolean;
}

export interface OpenCodeStartResult {
  projectKey: string;
  nodeName: string;
  port: number;
  started: boolean;
  message: string;
  detail?: string;
}

export interface OpenCodeLogsResult {
  projectKey: string;
  logFile: string;
  lines: string[];
}

export interface WorkerStartResult {
  workerId: string;
  started: boolean;
  message: string;
  detail?: string;
}

export interface WorkerLogsResult {
  workerId: string;
  logFile: string;
  lines: string[];
}

export interface OpenClawStartResult {
  started: boolean;
  message: string;
  detail?: string;
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
    // 配置状态
    configured: boolean;
    publicUrl: string;
    tokenConfigured: boolean;
    detail: string;
    localDetected: boolean;
    // 服务状态
    serviceStatus: 'online' | 'offline' | 'unknown' | 'checking';
    healthCheckUrl: string | null;
    healthCheckDetail: string;
    lastCheckAt: Date | null;
    canStart: boolean;
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
    const openClaw = manifestDocument
      ? await this.buildOpenClawStatus(manifestDocument.manifest)
      : this.buildOpenClawStatusFallback();
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
        publicUrl: manifestDocument?.manifest.services.controller.publicUrl ?? '',
        runtimeNotice: 'manifest 保存后不会自动刷新 controller/worker 运行态,如需生效请重启相关进程。',
      },
      workers: {
        total: workers.length,
        online: workers.filter((worker) => worker.status !== WorkerStatus.OFFLINE).length,
        idle: workers.filter((worker) => worker.status === WorkerStatus.IDLE).length,
        busy: workers.filter((worker) => worker.status === WorkerStatus.BUSY).length,
        offline: workers.filter((worker) => worker.status === WorkerStatus.OFFLINE).length,
        items: workers,
      },
      openClaw,
      openCode,
      latestDoctor: this.getLatestResult<DoctorReport>('doctor'),
      latestPlan: this.getLatestResult<DryRunPlan>('plan'),
      latestApply: this.getLatestResult<ApplyResult>('apply'),
      latestHeal: this.getLatestResult<HealResult>('heal'),
      recentTasks,
      recentDispatches,
      alerts: this.buildAlerts(workers, openCode, openClaw),
    };
  }

  async startOpenCode(projectKey: string): Promise<OpenCodeStartResult> {
    const project = this.projectRegistry.getProject(projectKey);
    if (!project) {
      throw new HttpError({
        statusCode: 404,
        errorCode: ControllerErrorCode.PROJECT_CONFIG_NOT_FOUND,
        message: `未找到项目 ${projectKey} 的 OpenCode 配置`,
      });
    }

    // 如果项目未配置独立端口，说明使用全局共享 OpenCode
    if (!project.openCode.port) {
      throw new HttpError({
        statusCode: 400,
        errorCode: 'controller.opencode.shared_mode',
        message: `项目 ${projectKey} 使用共享 OpenCode 服务，无需独立启动。请确保全局 OpenCode 服务已运行。`,
      });
    }

    if (project.nodeType !== 'local') {
      throw new HttpError({
        statusCode: 400,
        errorCode: 'controller.opencode.start_not_supported',
        message: `项目 ${projectKey} 位于远程节点 ${project.nodeName}，当前只支持在本机直接启动 OpenCode`,
      });
    }

    if (!fs.existsSync(project.repoPath)) {
      throw new HttpError({
        statusCode: 400,
        errorCode: 'controller.opencode.repo_not_found',
        message: `项目目录不存在：${project.repoPath}`,
      });
    }

    const runtimeDir = path.join(os.homedir(), '.opencode');
    const safeProjectKey = project.projectKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    const logFile = path.join(runtimeDir, `opencode-${safeProjectKey}.log`);
    const pidFile = path.join(runtimeDir, `opencode-${safeProjectKey}.pid`);
    const binaryPath = process.env.OPENCODE_BIN ?? path.join(os.homedir(), '.opencode', 'bin', 'opencode');
    const executable = fs.existsSync(binaryPath) ? binaryPath : 'opencode';

    const script = [
      'set -euo pipefail',
      `mkdir -p ${this.escapeShell(runtimeDir)}`,
      `cd ${this.escapeShell(project.repoPath)}`,
      `if [ -f ${this.escapeShell(pidFile)} ] && kill -0 "$(cat ${this.escapeShell(pidFile)})" 2>/dev/null; then`,
      `  echo "OpenCode 已在运行，PID: $(cat ${this.escapeShell(pidFile)})"`,
      '  exit 0',
      'fi',
      `nohup ${this.escapeShell(executable)} serve --hostname 127.0.0.1 --port ${project.openCode.port} > ${this.escapeShell(logFile)} 2>&1 &`,
      `echo $! > ${this.escapeShell(pidFile)}`,
      `echo "OpenCode 已启动，PID: $(cat ${this.escapeShell(pidFile)})，日志: ${logFile}"`,
    ].join('\n');

    const result = await this.spawnShell(script);
    if (result.code !== 0 || result.errorMessage) {
      return {
        projectKey: project.projectKey,
        nodeName: project.nodeName,
        port: project.openCode.port,
        started: false,
        message: 'OpenCode 启动失败',
        detail: result.stderr || result.stdout || result.errorMessage || '未知错误',
      };
    }

    return {
      projectKey: project.projectKey,
      nodeName: project.nodeName,
      port: project.openCode.port,
      started: true,
      message: 'OpenCode 启动命令已执行',
      detail: result.stdout || result.stderr || undefined,
    };
  }

  async startWorker(workerId: string): Promise<WorkerStartResult> {
    const launchConfig = this.resolveWorkerLaunchConfig(workerId);
    const repoRoot = process.cwd();
    const runtimePaths = this.getWorkerRuntimePaths(workerId);
    const logDir = path.dirname(runtimePaths.logFile);
    const logFile = runtimePaths.logFile;
    const pidFile = runtimePaths.pidFile;
    const manifestPath = this.getConfiguredManifestPath();

    const script = [
      'set -euo pipefail',
      `mkdir -p ${this.escapeShell(logDir)}`,
      `cd ${this.escapeShell(repoRoot)}`,
      `if [ -f ${this.escapeShell(pidFile)} ] && kill -0 "$(cat ${this.escapeShell(pidFile)})" 2>/dev/null; then`,
      `  echo "Worker 已在运行，PID: $(cat ${this.escapeShell(pidFile)})"`,
      '  exit 0',
      'fi',
      `nohup env ${manifestPath ? `CLAWKIT_MANIFEST_PATH=${this.escapeShell(path.resolve(manifestPath))} ` : ''}CONTROLLER_URL=${this.escapeShell(process.env.CONTROLLER_URL ?? 'http://127.0.0.1:8787')} WORKER_ID=${this.escapeShell(workerId)} WORKER_NAME=${this.escapeShell(launchConfig.name)} WORKER_NODE_NAME=${this.escapeShell(launchConfig.nodeName)} WORKER_TAGS=${this.escapeShell(launchConfig.tags)} WORKER_SUPPORTED_PROJECTS=${this.escapeShell(launchConfig.supportedProjects)} WORKER_PLACEHOLDER_FALLBACK=${this.escapeShell(process.env.WORKER_PLACEHOLDER_FALLBACK ?? 'true')} pnpm --filter @clawkit/worker start > ${this.escapeShell(logFile)} 2>&1 &`,
      `echo $! > ${this.escapeShell(pidFile)}`,
      'sleep 2',
      `if kill -0 "$(cat ${this.escapeShell(pidFile)})" 2>/dev/null; then echo "Worker 已启动，PID: $(cat ${this.escapeShell(pidFile)})，日志: ${logFile}"; else echo "Worker 启动后立即退出，请检查日志: ${logFile}"; exit 1; fi`,
    ].join('\n');

    const result = await this.spawnShell(script);
    if (result.code !== 0 || result.errorMessage) {
      return {
        workerId,
        started: false,
        message: 'Worker 启动失败',
        detail: result.stderr || result.stdout || result.errorMessage || '未知错误',
      };
    }

    return {
      workerId,
      started: true,
      message: 'Worker 启动命令已执行',
      detail: result.stdout || result.stderr || undefined,
    };
  }

  async restartWorker(workerId: string): Promise<WorkerStartResult> {
    const runtimePaths = this.getWorkerRuntimePaths(workerId);
    const pidFile = fs.existsSync(runtimePaths.pidFile) ? runtimePaths.pidFile : runtimePaths.legacyPidFile;
    const stopScript = [
      'set -euo pipefail',
      `if [ -f ${this.escapeShell(pidFile)} ]; then`,
      `  PID="$(cat ${this.escapeShell(pidFile)})"`,
      '  if kill -0 "$PID" 2>/dev/null; then',
      '    kill "$PID"',
      '    sleep 2',
      '  fi',
      `  rm -f ${this.escapeShell(pidFile)}`,
      'fi',
    ].join('\n');

    const stopResult = await this.spawnShell(stopScript);
    if (stopResult.code !== 0 || stopResult.errorMessage) {
      return {
        workerId,
        started: false,
        message: 'Worker 重启前停止失败',
        detail: stopResult.stderr || stopResult.stdout || stopResult.errorMessage || '未知错误',
      };
    }

    return this.startWorker(workerId);
  }

  async getWorkerLogs(workerId: string, lines: number): Promise<WorkerLogsResult> {
    const runtimePaths = this.getWorkerRuntimePaths(workerId);
    const logFile = fs.existsSync(runtimePaths.logFile) ? runtimePaths.logFile : runtimePaths.legacyLogFile;
    if (!fs.existsSync(logFile)) {
      throw new HttpError({
        statusCode: 404,
        errorCode: 'controller.worker.log_not_found',
        message: `日志文件不存在：${logFile}`,
      });
    }

    const content = fs.readFileSync(logFile, 'utf8');
    const allLines = content.split('\n').filter((line) => line.trim().length > 0);
    return {
      workerId,
      logFile,
      lines: allLines.slice(-Math.max(10, Math.min(lines, 500))),
    };
  }

  async startOpenClaw(): Promise<OpenClawStartResult> {
    const repoRoot = process.cwd();
    const scriptPath = path.join(repoRoot, 'scripts', 'restart-openclaw.sh');
    if (!fs.existsSync(scriptPath)) {
      throw new HttpError({
        statusCode: 404,
        errorCode: 'controller.openclaw.script_not_found',
        message: `未找到脚本：${scriptPath}`,
      });
    }

    const result = await this.spawnShell([
      'set -euo pipefail',
      `cd ${this.escapeShell(repoRoot)}`,
      `bash ${this.escapeShell(scriptPath)}`,
    ].join('\n'));

    if (result.code !== 0 || result.errorMessage) {
      return {
        started: false,
        message: 'OpenClaw 启动失败',
        detail: result.stderr || result.stdout || result.errorMessage || '未知错误',
      };
    }

    return {
      started: true,
      message: 'OpenClaw 启动命令已执行',
      detail: result.stdout || result.stderr || undefined,
    };
  }

  async getOpenCodeLogs(projectKey: string, lines: number): Promise<OpenCodeLogsResult> {
    const project = this.projectRegistry.getProject(projectKey);
    if (!project) {
      throw new HttpError({
        statusCode: 404,
        errorCode: ControllerErrorCode.PROJECT_CONFIG_NOT_FOUND,
        message: `未找到项目 ${projectKey} 的 OpenCode 配置`,
      });
    }

    const safeProjectKey = project.projectKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    const logFile = path.join(os.homedir(), '.opencode', `opencode-${safeProjectKey}.log`);

    if (!fs.existsSync(logFile)) {
      throw new HttpError({
        statusCode: 404,
        errorCode: 'controller.opencode.log_not_found',
        message: `日志文件不存在：${logFile}`,
      });
    }

    const content = fs.readFileSync(logFile, 'utf8');
    const allLines = content.split('\n').filter((line) => line.trim().length > 0);
    return {
      projectKey,
      logFile,
      lines: allLines.slice(-Math.max(10, Math.min(lines, 500))),
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

  private buildAlerts(workers: WorkerRecord[], openCode: OpenCodeStatusSummary[], openClaw: OverviewData['openClaw']): OverviewAlert[] {
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

    if (openClaw.serviceStatus === 'offline') {
      alerts.push({
        level: 'warning',
        title: 'OpenClaw 服务不可达',
        detail: openClaw.healthCheckDetail,
      });
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
        // 如果项目未配置独立端口，说明使用共享 OpenCode
        if (!project.openCode.port) {
          statuses.push({
            workerId: worker.id,
            projectKey: project.key,
            nodeName: worker.node,
            port: 0, // 共享模式，端口为 0 表示使用全局服务
            status: 'unknown',
            detail: '使用共享 OpenCode 实例（无需为当前项目单独启动）',
            canStart: false,
          });
          continue;
        }

        if (node.type !== 'local') {
          statuses.push({
            workerId: worker.id,
            projectKey: project.key,
            nodeName: worker.node,
            port: project.openCode.port,
            status: 'unknown',
            detail: '远程节点当前阶段不做主动探测',
            canStart: false,
          });
          continue;
        }

        const health = await this.checkHttp(`http://127.0.0.1:${project.openCode.port}/global/health`);
        // HTTP 401 表示服务在运行但需要认证，视为在线
        const isOnline = health.ok || health.message === 'HTTP 401';
        const detailMessage = isOnline
          ? health.message === 'HTTP 401'
            ? `OpenCode 实例运行正常（端口 ${project.openCode.port}，需要密码认证）`
            : `OpenCode 实例运行正常（端口 ${project.openCode.port}）`
          : health.message.includes('ECONNREFUSED')
            ? `OpenCode 实例未启动（端口 ${project.openCode.port} 无响应）`
            : health.message.includes('请求超时')
              ? `OpenCode 实例响应超时（端口 ${project.openCode.port}）`
              : `OpenCode 实例异常：${health.message}`;

        statuses.push({
          workerId: worker.id,
          projectKey: project.key,
          nodeName: worker.node,
          port: project.openCode.port,
          status: isOnline ? 'online' : 'offline',
          detail: detailMessage,
          canStart: true,
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
          timeout: 3000,
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

  private async spawnShell(script: string): Promise<{ code: number | null; stdout: string; stderr: string; errorMessage: string | null }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let errorMessage: string | null = null;

      const child = spawn('bash', ['-lc', script], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });

      child.stdout?.on('data', (chunk: Buffer | string) => {
        stdout += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      });

      child.stderr?.on('data', (chunk: Buffer | string) => {
        stderr += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      });

      child.on('error', (error) => {
        errorMessage = error.message;
      });

      child.on('close', (code) => {
        resolve({ code, stdout: stdout.trim(), stderr: stderr.trim(), errorMessage });
      });
    });
  }

  private escapeShell(value: string): string {
    return `'${value.replace(/'/g, `'"'"'`)}'`;
  }

  private getWorkerRuntimePaths(workerId: string): { pidFile: string; logFile: string; legacyPidFile: string; legacyLogFile: string } {
    const repoRoot = process.cwd();
    const safeWorkerId = workerId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return {
      pidFile: path.join(repoRoot, '.clawkit', `worker-${safeWorkerId}.pid`),
      logFile: path.join(repoRoot, '.clawkit', 'logs', `worker-${safeWorkerId}.log`),
      legacyPidFile: path.join(repoRoot, '.clawkit', 'worker.pid'),
      legacyLogFile: path.join(repoRoot, '.clawkit', 'logs', 'worker.log'),
    };
  }

  private resolveWorkerLaunchConfig(workerId: string): {
    name: string;
    nodeName: string;
    tags: string;
    supportedProjects: string;
  } {
    const manifest = this.tryGetManifest()?.manifest;
    const manifestWorker = manifest?.workers.find((item) => item.id === workerId);
    if (manifestWorker) {
      const supportedProjects = manifestWorker.projects.map((project) => project.key);
      return {
        name: workerId,
        nodeName: manifestWorker.node,
        tags: manifestWorker.tags.join(','),
        supportedProjects: (supportedProjects.length > 0 ? supportedProjects : ['clawkit']).join(','),
      };
    }

    const registryWorker = this.workerRegistry.getWorker(workerId);
    if (registryWorker) {
      return {
        name: registryWorker.name,
        nodeName: registryWorker.nodeName,
        tags: registryWorker.tags.join(','),
        supportedProjects: (registryWorker.supportedProjects.length > 0 ? registryWorker.supportedProjects : ['clawkit']).join(','),
      };
    }

    const projectKeys = this.projectRegistry
      .getAllProjects()
      .filter((project) => project.nodeType === 'local')
      .map((project) => project.projectKey);

    return {
      name: workerId,
      nodeName: 'local',
      tags: '',
      supportedProjects: (projectKeys.length > 0 ? projectKeys : ['clawkit']).join(','),
    };
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

  private async buildOpenClawStatus(manifest: Manifest): Promise<OverviewData['openClaw']> {
    const openClawConfig = manifest.services.openClaw;
    const configured = openClawConfig.publicUrl.trim().length > 0;
    const tokenConfigured = (openClawConfig.apiKey?.trim().length ?? 0) > 0;
    const configDetail = tokenConfigured
      ? 'OpenClaw webhook token 已配置'
      : 'OpenClaw webhook token 缺失，后续调用会失败';

    const node = manifest.nodes[openClawConfig.node];
    const healthCheckUrl = 'http://127.0.0.1:18000/healthz';
    const checkStartAt = new Date();
    const health = await this.checkHttp(healthCheckUrl);
    const localDetected = health.ok;

    if (!node || node.type !== 'local') {
      return {
        configured,
        publicUrl: openClawConfig.publicUrl,
        tokenConfigured,
        detail: configDetail,
        localDetected,
        serviceStatus: 'unknown',
        healthCheckUrl,
        healthCheckDetail: localDetected ? '本机已检测到 OpenClaw 服务，但 manifest 配置指向远程节点' : '远程节点当前阶段不做主动探测',
        lastCheckAt: checkStartAt,
        canStart: false,
      };
    }

    return {
      configured,
      publicUrl: openClawConfig.publicUrl,
      tokenConfigured,
      detail: configDetail,
      localDetected,
      serviceStatus: health.ok ? 'online' : 'offline',
      healthCheckUrl,
      healthCheckDetail: health.ok ? 'OpenClaw 服务可达' : `OpenClaw 服务不可达：${health.message}`,
      lastCheckAt: checkStartAt,
      canStart: true,
    };
  }

  private buildOpenClawStatusFallback(): OverviewData['openClaw'] {
    return {
      configured: false,
      publicUrl: '',
      tokenConfigured: false,
      detail: '当前未找到 manifest，无法判断 OpenClaw 配置状态',
      localDetected: false,
      serviceStatus: 'unknown',
      healthCheckUrl: 'http://127.0.0.1:18000/healthz',
      healthCheckDetail: '未加载 manifest',
      lastCheckAt: null,
      canStart: true,
    };
  }
}
