import http from 'node:http';
import https from 'node:https';

import { WorkerStatus, type Manifest } from '@clawkit/shared';

import type { WorkerRegistry } from '../../services/worker-registry';
import type { SetupStep } from '../../models/setup-step';
import type { SetupTopLevelStatus } from '../../models/setup-session';
import type { SetupRunService, SetupRunDetail } from './setup-run-service';
import type { SetupStreamListener } from './setup-stream-service';
import type { SetupManifestService } from './setup-manifest-service';
import type { WebConsoleService } from './web-console-service';
import type { QuickSetupProfile } from '../types/quick-setup';

export class SetupOrchestrator {
  private readonly running = new Map<string, Promise<void>>();

  constructor(
    private readonly manifestService: SetupManifestService,
    private readonly runService: SetupRunService,
    private readonly webConsoleService: WebConsoleService,
    private readonly workerRegistry: WorkerRegistry,
  ) {}

  getSchema() {
    return this.manifestService.getSchema();
  }

  getDefaults() {
    return this.manifestService.getDefaults();
  }

  previewManifest(formData: unknown) {
    return this.manifestService.preview(formData);
  }

  compileQuickProfile(profile: QuickSetupProfile) {
    return this.manifestService.compileQuickProfile(profile);
  }

  startRun(input: { topology?: string; formData: Record<string, unknown> }): SetupRunDetail {
    const preview = this.manifestService.preview(input.formData);
    const detail = this.runService.createRun({
      sessionId: crypto.randomUUID(),
      topology: input.topology ?? preview.manifest.profile.topology,
      formData: input.formData,
      manifest: preview.manifest,
      manifestYaml: preview.yamlText,
    });
    this.start(detail.run.runId);
    return detail;
  }

  retryRun(runId: string): SetupRunDetail {
    const detail = this.runService.createRetry(runId);
    this.start(detail.run.runId);
    return detail;
  }

  getRun(runId: string): SetupRunDetail {
    return this.runService.getRunDetail(runId);
  }

  listRuns(): SetupRunDetail[] {
    return this.runService.listRuns();
  }

  subscribe(runId: string, listener: SetupStreamListener): () => void {
    return this.runService.subscribe(runId, listener);
  }

  start(runId: string): void {
    if (this.running.has(runId)) return;
    const promise = this.execute(runId)
      .catch((error) => {
        const detail = this.runService.getRunDetail(runId);
        if (detail.run.finishedAt) return;
        const message = error instanceof Error ? error.message : '未知错误';
        const summary = this.buildSummary('failed', detail.steps, [`执行异常中断：${message}`]);
        this.runService.completeRun(runId, 'failed', summary, message);
      })
      .finally(() => {
        this.running.delete(runId);
      });
    this.running.set(runId, promise);
  }

  private async execute(runId: string): Promise<void> {
    const detail = this.runService.getRunDetail(runId);
    const manifest = detail.run.manifest;
    const issues: string[] = [];

    await this.runStep(runId, 'generate_manifest', async () => {
      this.webConsoleService.saveManifest(detail.run.manifestYaml);
      this.runService.appendStepLog(runId, 'generate_manifest', 'manifest 已保存；如需让新配置生效，请重启 controller/worker/OpenCode 等相关进程');
    });

    await this.runStep(runId, 'doctor', async () => {
      const result = await this.webConsoleService.runDoctor();
      this.runService.appendStepLog(runId, 'doctor', result.summary);
      for (const line of result.logs) this.runService.appendStepLog(runId, 'doctor', line);
      if (result.status === 'failed') {
        throw new Error(result.summary);
      }
      if (result.status === 'warning') {
        issues.push(`Doctor 存在警告：${result.summary}`);
      }
    });

    await this.runStep(runId, 'plan', async () => {
      const result = this.webConsoleService.runPlan();
      this.runService.appendStepLog(runId, 'plan', result.summary);
      for (const line of result.logs) this.runService.appendStepLog(runId, 'plan', line);
      if (result.status === 'failed') {
        throw new Error(result.summary);
      }
      if (result.status === 'warning') {
        issues.push(`Plan 存在占位能力：${result.summary}`);
      }
    });

    await this.runStep(runId, 'apply', async () => {
      const result = await this.webConsoleService.runApply({
        dryRun: false,
        confirmExecution: true,
      });
      this.runService.appendStepLog(runId, 'apply', result.summary);
      for (const line of result.logs) this.runService.appendStepLog(runId, 'apply', line);
      if (result.status !== 'success') {
        throw new Error(result.summary);
      }
    });

    await this.runStep(runId, 'check_controller', async () => {
      const url = this.buildControllerHealthUrl(manifest);
      const health = await this.checkHttp(url);
      if (!health.ok) {
        throw new Error(`Controller 健康检查失败：${health.message}`);
      }
      this.runService.appendStepLog(runId, 'check_controller', `Controller 健康接口可达：${url}`);
    });

    await this.runStep(runId, 'check_worker', async () => {
      this.workerRegistry.checkHeartbeatTimeout();
      const workers = this.workerRegistry.getAllWorkers();
      const online = workers.filter((w) => w.status !== WorkerStatus.OFFLINE);
      if (online.length === 0) {
        throw new Error('当前没有已注册的 Worker（或均已离线）');
      }
      this.runService.appendStepLog(runId, 'check_worker', `Worker 已注册：${online.length}/${workers.length}`);
    });

    let openCodeOnlineCount = 0;
    await this.runStep(runId, 'check_opencode', async () => {
      const checks = await this.checkOpenCode(manifest);
      openCodeOnlineCount = checks.filter((c) => c.ok).length;
      for (const item of checks) this.runService.appendStepLog(runId, 'check_opencode', item.message);
      if (openCodeOnlineCount === 0) {
        throw new Error('未发现可达的 OpenCode server');
      }
    });

    await this.runStep(runId, 'check_openclaw', async () => {
      const publicUrl = manifest.services.openClaw.publicUrl.trim();
      if (publicUrl.length === 0) {
        throw new Error('OpenClaw publicUrl 缺失');
      }

      const tokenConfigured = (manifest.services.openClaw.apiKey?.trim().length ?? 0) > 0;
      if (!tokenConfigured) {
        issues.push('OpenClaw webhook token 未配置，后续鉴权相关调用可能失败');
        this.runService.appendStepLog(runId, 'check_openclaw', 'OpenClaw webhook token 未配置（允许继续，但建议尽快补齐）');
      } else {
        this.runService.appendStepLog(runId, 'check_openclaw', 'OpenClaw webhook token 已配置');
      }
    });

    await this.runStep(runId, 'smoke_test', async () => {
      const controllerUrl = this.buildControllerHealthUrl(manifest);
      const controllerHealth = await this.checkHttp(controllerUrl);

      this.workerRegistry.checkHeartbeatTimeout();
      const workerOk = this.workerRegistry.getAllWorkers().some((w) => w.status !== WorkerStatus.OFFLINE);
      const openCodeOk = openCodeOnlineCount > 0;

      const failedReasons: string[] = [];
      if (!controllerHealth.ok) failedReasons.push(`Controller 不可达：${controllerHealth.message}`);
      if (!workerOk) failedReasons.push('至少需要一个已注册的 Worker');
      if (!openCodeOk) failedReasons.push('至少需要一个可达的 OpenCode');

      if (failedReasons.length > 0) {
        const joined = failedReasons.join('；');
        issues.push(`Smoke Test 未通过：${joined}`);
        throw new Error(joined);
      }

      this.runService.appendStepLog(runId, 'smoke_test', 'Smoke Test 通过：Controller 可达 + Worker 已注册 + OpenCode 可达');
    });

    await this.runStep(runId, 'finalize_summary', async () => {
      const finalDetail = this.runService.getRunDetail(runId);
      const finalStatus = this.decideFinalStatus(finalDetail.steps, issues);
      const summary = this.buildSummary(finalStatus, finalDetail.steps, issues);
      this.runService.appendStepLog(runId, 'finalize_summary', summary);
      this.runService.completeRun(runId, finalStatus, summary, null);
    });
  }

  private async runStep(runId: string, stepKey: string, fn: () => Promise<void> | void): Promise<void> {
    this.runService.markRunRunning(runId, stepKey);
    this.runService.updateStep(runId, stepKey, (step) => {
      const now = new Date();
      return {
        ...step,
        status: 'running',
        startedAt: step.startedAt ?? now,
        updatedAt: now,
      };
    });

    try {
      await fn();
      this.runService.updateStep(runId, stepKey, (step) => {
        const now = new Date();
        return {
          ...step,
          status: 'success',
          finishedAt: step.finishedAt ?? now,
          updatedAt: now,
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      this.runService.updateStep(runId, stepKey, (step) => {
        const now = new Date();
        return {
          ...step,
          status: 'failed',
          errorMessage: message,
          finishedAt: step.finishedAt ?? now,
          updatedAt: now,
        };
      });

      const detail = this.runService.getRunDetail(runId);
      const finalStatus: Exclude<SetupTopLevelStatus, 'draft' | 'ready' | 'running'> = stepKey === 'smoke_test' ? 'partial_success' : 'failed';
      const summary = this.buildSummary(finalStatus, detail.steps, [
        `步骤 ${stepKey} 失败：${message}`,
        '可尝试：POST /api/system/heal（dryRun=true）查看可修复项',
      ]);
      this.runService.completeRun(runId, finalStatus, summary, message);
      throw error;
    }
  }

  private buildControllerHealthUrl(manifest: Manifest): string {
    const base = manifest.services.openClaw.publicUrl;
    const apiPrefix = manifest.services.controller.apiPrefix;
    return this.joinUrl(base, this.joinPath(apiPrefix, '/health'));
  }

  private joinUrl(base: string, pathname: string): string {
    const target = new URL(base);
    const basePath = target.pathname.endsWith('/') ? target.pathname.slice(0, -1) : target.pathname;
    const tail = pathname.startsWith('/') ? pathname : `/${pathname}`;
    target.pathname = `${basePath}${tail}`;
    return target.toString();
  }

  private joinPath(left: string, right: string): string {
    const a = left.endsWith('/') ? left.slice(0, -1) : left;
    const b = right.startsWith('/') ? right : `/${right}`;
    return `${a}${b}`;
  }

  private async checkOpenCode(manifest: Manifest): Promise<Array<{ ok: boolean; message: string }>> {
    const results: Array<{ ok: boolean; message: string }> = [];

    for (const worker of manifest.workers) {
      const node = manifest.nodes[worker.node];
      for (const project of worker.projects) {
        if (node.type !== 'local') {
          results.push({ ok: true, message: `OpenCode 探测跳过（远程节点）：${worker.id}/${project.key}` });
          continue;
        }

        const url = `http://127.0.0.1:${project.openCode.port}/global/health`;
        const health = await this.checkHttp(url);
        results.push({
          ok: health.ok,
          message: health.ok
            ? `OpenCode 可达：${worker.id}/${project.key}（${url}）`
            : `OpenCode 不可达：${worker.id}/${project.key}（${url}）：${health.message}`,
        });
      }
    }

    return results;
  }

  private async checkHttp(url: string): Promise<{ ok: boolean; message: string }> {
    return new Promise((resolve) => {
      try {
        const target = new URL(url);
        const client = target.protocol === 'https:' ? https : http;
        const request = client.request(
          {
            hostname: target.hostname,
            port: target.port,
            path: `${target.pathname}${target.search}`,
            method: 'GET',
            timeout: 1500,
          },
          (response) => {
            resolve({
              ok: (response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300,
              message: `HTTP ${response.statusCode ?? 500}`,
            });
          },
        );

        request.on('timeout', () => {
          request.destroy(new Error('请求超时'));
        });
        request.on('error', (error) => {
          resolve({ ok: false, message: error.message });
        });
        request.end();
      } catch (error) {
        resolve({ ok: false, message: error instanceof Error ? error.message : '未知网络错误' });
      }
    });
  }

  private decideFinalStatus(steps: SetupStep[], issues: string[]): Exclude<SetupTopLevelStatus, 'draft' | 'ready' | 'running'> {
    const hasFailure = steps.some((step) => step.status === 'failed');
    if (hasFailure) return 'partial_success';
    if (issues.length > 0) return 'partial_success';
    return 'success';
  }

  private buildSummary(status: Exclude<SetupTopLevelStatus, 'draft' | 'ready' | 'running'>, steps: SetupStep[], issues: string[]): string {
    const stepLines = steps.map((step) => {
      const suffix = step.status === 'failed' && step.errorMessage ? `：${step.errorMessage}` : '';
      return `- ${step.title}：${step.status}${suffix}`;
    }).join('\n');

    const issueLines = issues.length > 0
      ? `\n\n注意事项：\n${issues.map((item) => `- ${item}`).join('\n')}`
      : '';

    const retryHint = '如需重试当前 run，可调用：POST /api/setup/runs/:id/retry';
    const healHint = '失败后可先执行：POST /api/system/heal（dryRun=true）查看可修复项，再决定是否真实执行。';

    return `Setup 执行结果：${status}\n\n步骤明细：\n${stepLines}${issueLines}\n\n${retryHint}\n${healHint}\n`;
  }
}
