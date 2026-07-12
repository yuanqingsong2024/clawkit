import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';

import { CheckStatus, type Manifest } from '@clawkit/shared';

import { ApplyService } from './apply.service';
import { ManifestLoader } from './manifest-loader';

export interface HealIssue {
  code: string;
  status: CheckStatus;
  title: string;
  message: string;
  suggestion: string;
  canAutoFix: boolean;
}

export interface HealResult {
  manifestPath: string;
  dryRun: boolean;
  issues: HealIssue[];
  plannedFixes: string[];
  appliedFixes: string[];
}

export interface HealOptions {
  dryRun?: boolean;
  force?: boolean;
}

export class HealService {
  private readonly loader = new ManifestLoader();

  private readonly applyService = new ApplyService();

  async heal(filePath: string, options: HealOptions = {}): Promise<HealResult> {
    const dryRun = options.dryRun ?? !options.force;
    let loadedManifest;

    try {
      loadedManifest = this.loader.load(filePath);
    } catch (error) {
      return {
        manifestPath: filePath,
        dryRun,
        issues: [
          {
            code: 'heal.manifest.invalid',
            status: CheckStatus.FAIL,
            title: 'Manifest 缺失关键字段或格式不合法',
            message: error instanceof Error ? error.message : '未知 manifest 错误',
            suggestion: '请先修正 manifest，再执行 heal 或 apply',
            canAutoFix: false,
          },
        ],
        plannedFixes: [],
        appliedFixes: [],
      };
    }

    const plan = this.applyService.createPlan(filePath, { dryRun: true, onlyLocal: true });
    const issues = await this.collectIssues(loadedManifest.manifest, plan.filePlans);
    const plannedFixes = issues
      .filter((issue) => issue.canAutoFix)
      .map((issue) => `自动修复：${issue.title}`);
    const appliedFixes: string[] = [];

    if (!dryRun && plannedFixes.length > 0) {
      this.applyService.apply(filePath, { dryRun: false, onlyLocal: true });
      appliedFixes.push(...plannedFixes);
    }

    return {
      manifestPath: loadedManifest.manifestPath,
      dryRun,
      issues,
      plannedFixes,
      appliedFixes,
    };
  }

  private async collectIssues(manifest: Manifest, filePlans: Array<{ targetPath: string; description: string }>): Promise<HealIssue[]> {
    const issues: HealIssue[] = [];

    if (!manifest.services.openClaw.apiKey || manifest.services.openClaw.apiKey.trim().length === 0) {
      issues.push({
        code: 'heal.openclaw.token_missing',
        status: CheckStatus.FAIL,
        title: 'OpenClaw webhook token 未配置',
        message: 'manifest.services.openClaw.apiKey 为空，controller 无法进行 webhook token 鉴权。',
        suggestion: '请在 manifest 中补充 services.openClaw.apiKey，再重新执行 apply。',
        canAutoFix: false,
      });
    }

    for (const worker of manifest.workers) {
      for (const project of worker.projects) {
        const node = manifest.nodes[worker.node];
        if (node.type === 'local' && !fs.existsSync(project.repoPath)) {
          issues.push({
            code: 'heal.project.path_missing',
            status: CheckStatus.FAIL,
            title: `项目路径不存在：${project.key}`,
            message: `本地项目路径不存在：${project.repoPath}`,
            suggestion: '请确认项目路径是否正确，或先将仓库克隆到目标路径。',
            canAutoFix: false,
          });
        }

        // 只检查配置了独立端口的项目
        if (project.openCode.port) {
          const health = await this.checkHttp(`${this.deriveOpenCodeBaseUrl(project.openCode.port)}/global/health`);
          // HTTP 401 表示服务在运行但需要认证，视为可达
          if (!health.ok && health.message !== 'HTTP 401') {
            issues.push({
              code: 'heal.opencode.unreachable',
              status: CheckStatus.WARN,
              title: `OpenCode server 不可达：${project.key}`,
              message: `未能访问 ${this.deriveOpenCodeBaseUrl(project.openCode.port)}/global/health：${health.message}`,
              suggestion: `请先启动 opencode serve --hostname 127.0.0.1 --port ${project.openCode.port}`,
              canAutoFix: false,
            });
          }
        }
      }

      const workerHealth = await this.checkHttp(`${this.deriveControllerBaseUrl(manifest)}/api/workers/${worker.id}`);
      if (!workerHealth.ok) {
        issues.push({
          code: 'heal.worker.not_registered',
          status: CheckStatus.WARN,
          title: `Worker 未注册：${worker.id}`,
          message: `controller 当前无法查询到 worker ${worker.id}。`,
          suggestion: '请先启动 worker，或检查 CONTROLLER_URL 与 worker 配置是否正确。',
          canAutoFix: false,
        });
      }
    }

    const controllerHealth = await this.checkHttp(`${this.deriveControllerBaseUrl(manifest)}${manifest.services.controller.apiPrefix}/health`);
    if (!controllerHealth.ok) {
      issues.push({
        code: 'heal.controller.unhealthy',
        status: CheckStatus.WARN,
        title: 'Controller 服务未启动或状态异常',
        message: `未能访问 controller 健康检查接口：${controllerHealth.message}`,
        suggestion: '请检查 controller 进程、端口与环境变量；如配置缺失，可先执行 heal --force 或 apply。',
        canAutoFix: false,
      });
    }

    for (const filePlan of filePlans) {
      if (!fs.existsSync(filePlan.targetPath)) {
        issues.push({
          code: 'heal.config.missing',
          status: CheckStatus.FAIL,
          title: `配置文件缺失：${filePlan.description}`,
          message: `未找到 ${filePlan.targetPath}`,
          suggestion: '可通过 heal --force 自动重建本地生成文件。',
          canAutoFix: true,
        });
        continue;
      }

      if (filePlan.targetPath.endsWith('.env') && !this.isEnvFileCompatible(filePlan.targetPath)) {
        issues.push({
          code: 'heal.config.incompatible',
          status: CheckStatus.FAIL,
          title: `配置文件损坏或 schema 不兼容：${filePlan.description}`,
          message: `${filePlan.targetPath} 缺少最小必要字段。`,
          suggestion: '可通过 heal --force 自动重新生成本地 env 文件。',
          canAutoFix: true,
        });
      }
    }

    return issues;
  }

  private isEnvFileCompatible(filePath: string): boolean {
    const content = fs.readFileSync(filePath, 'utf8');
    const requiredKeys = filePath.includes('controller.env')
      ? ['CLAWKIT_MANIFEST_PATH=', 'CONTROLLER_PORT=', 'OPENCLAW_WEBHOOK_TOKEN=']
      : ['CLAWKIT_MANIFEST_PATH=', 'WORKER_ID=', 'CONTROLLER_URL='];

    return requiredKeys.every((key) => content.includes(key));
  }

  private deriveControllerBaseUrl(manifest: Manifest): string {
    const controllerNode = manifest.nodes[manifest.services.controller.node];
    if (controllerNode.type === 'local') {
      return `http://127.0.0.1:${manifest.services.controller.port}`;
    }

    return manifest.services.openClaw.publicUrl;
  }

  private deriveOpenCodeBaseUrl(port: number): string {
    return `http://127.0.0.1:${port}`;
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
          timeout: 2000,
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
          resolve({
            ok: false,
            message: error.message,
          });
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
}
