import { spawnSync } from 'node:child_process';
import type { Manifest } from '@clawkit/shared';
import { ManifestLoader } from './manifest-loader';
import { Logger } from '../utils/logger';

interface VerifyResult {
  component: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  details?: string;
}

/**
 * Verify 服务
 * 端到端验证所有组件的运行状态
 */
export class VerifyService {
  private readonly loader = new ManifestLoader();

  /**
   * 执行完整验证
   */
  verify(manifestPath: string): void {
    Logger.title('ClawKit 端到端验证');

    const context = this.loader.load(manifestPath);
    const manifest = context.manifest;

    const results: VerifyResult[] = [];

    // 验证 Controller
    Logger.divider();
    Logger.info('正在验证 Controller...');
    results.push(this.verifyController(manifest));

    // 验证 Worker
    Logger.divider();
    Logger.info('正在验证 Worker...');
    results.push(this.verifyWorker(manifest));

    // 验证 OpenClaw
    Logger.divider();
    Logger.info('正在验证 OpenClaw...');
    results.push(this.verifyOpenClaw(manifest));

    // 验证 OpenCode
    Logger.divider();
    Logger.info('正在验证 OpenCode...');
    results.push(this.verifyOpenCode(manifest));

    // 验证 Webhook 配置
    Logger.divider();
    Logger.info('正在验证 Webhook 配置...');
    results.push(this.verifyWebhookConfig(manifest));

    // 输出验证报告
    this.printReport(results);
  }

  /**
   * 验证 Controller
   */
  private verifyController(manifest: Manifest): VerifyResult {
    const port = manifest.services.controller.port;
    const url = `http://127.0.0.1:${port}/api/health`;

    try {
      const response = this.httpGet(url, 5000);

      if (response.statusCode === 200) {
        return {
          component: 'Controller',
          status: 'ok',
          message: `运行正常 (端口 ${port})`,
        };
      } else {
        return {
          component: 'Controller',
          status: 'warn',
          message: `响应异常 (状态码 ${response.statusCode})`,
          details: `URL: ${url}`,
        };
      }
    } catch (error) {
      return {
        component: 'Controller',
        status: 'error',
        message: '无法连接',
        details: `请检查 Controller 是否已启动\nURL: ${url}\n错误: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 验证 Worker
   */
  private verifyWorker(manifest: Manifest): VerifyResult {
    const port = manifest.services.controller.port;
    const url = `http://127.0.0.1:${port}/api/workers`;

    try {
      const response = this.httpGet(url, 5000);

      if (response.statusCode === 200) {
        const data = JSON.parse(response.body);
        const workers = Array.isArray(data.data) ? data.data : data.data?.workers ?? [];

        if (workers.length > 0) {
          const activeWorkers = workers.filter((worker: { status?: string }) => worker.status === 'active' || worker.status === 'idle' || worker.status === 'busy');
          
          if (activeWorkers.length > 0) {
            return {
              component: 'Worker',
              status: 'ok',
              message: `${activeWorkers.length} 个 Worker 在线`,
              details: activeWorkers.map((worker: { id?: string; workerId?: string; nodeName?: string }) => `  - ${worker.id ?? worker.workerId} (${worker.nodeName ?? 'unknown'})`).join('\n'),
            };
          } else {
            return {
              component: 'Worker',
              status: 'warn',
              message: `${workers.length} 个 Worker 已注册，但无活跃 Worker`,
              details: '请检查 Worker 是否正常运行',
            };
          }
        } else {
          return {
            component: 'Worker',
            status: 'error',
            message: '未发现任何 Worker',
            details: '请启动至少一个 Worker',
          };
        }
      } else {
        return {
          component: 'Worker',
          status: 'error',
          message: `无法获取 Worker 列表 (状态码 ${response.statusCode})`,
        };
      }
    } catch (error) {
      return {
        component: 'Worker',
        status: 'error',
        message: '无法查询 Worker 状态',
        details: (error as Error).message,
      };
    }
  }

  /**
   * 验证 OpenClaw
   */
  private verifyOpenClaw(manifest: Manifest): VerifyResult {
    if (manifest.services.openClaw.deployMode === 'skip') {
      return {
        component: 'OpenClaw',
        status: 'warn',
        message: '已配置为跳过 (deployMode=skip)',
      };
    }

    const url = manifest.services.openClaw.deployMode === 'local'
      ? `http://127.0.0.1:${this.resolveOpenClawLocalPort(manifest)}/healthz`
      : `${manifest.services.openClaw.publicUrl}/healthz`;

    try {
      const response = this.httpGet(url, 5000);

      if (response.statusCode === 200) {
        return {
          component: 'OpenClaw',
          status: 'ok',
          message: `运行正常 (${manifest.services.openClaw.deployMode} 模式)`,
        };
      } else {
        return {
          component: 'OpenClaw',
          status: 'warn',
          message: `响应异常 (状态码 ${response.statusCode})`,
          details: `URL: ${url}`,
        };
      }
    } catch (error) {
      return {
        component: 'OpenClaw',
        status: 'error',
        message: '无法连接',
        details: `请检查 OpenClaw 是否已启动\nURL: ${url}\n错误: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 验证 OpenCode
   */
  private verifyOpenCode(manifest: Manifest): VerifyResult {
    if (!manifest.services.openCode || manifest.services.openCode.installMode === 'skip') {
      return {
        component: 'OpenCode',
        status: 'warn',
        message: '已配置为跳过 (installMode=skip)',
      };
    }

    const port = this.resolveOpenCodePort(manifest);
    const url = `http://127.0.0.1:${port}/global/health`;

    try {
      const response = this.httpGet(url, 5000, {
        username: 'opencode',
        password: this.readOpenCodePassword(),
      });

      if (response.statusCode === 200) {
        return {
          component: 'OpenCode',
          status: 'ok',
          message: `运行正常 (${manifest.services.openCode.installMode} 模式)`,
        };
      } else {
        return {
          component: 'OpenCode',
          status: 'warn',
          message: `响应异常 (状态码 ${response.statusCode})`,
          details: `URL: ${url}`,
        };
      }
    } catch (error) {
      return {
        component: 'OpenCode',
        status: 'error',
        message: '无法连接',
        details: `请检查 OpenCode 是否已启动\nURL: ${url}\n错误: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 验证 Webhook 配置
   */
  private verifyWebhookConfig(manifest: Manifest): VerifyResult {
    const apiKey = manifest.services.openClaw.apiKey?.trim();

    if (!apiKey || apiKey === 'replace-me') {
      return {
        component: 'Webhook 配置',
        status: 'error',
        message: 'Webhook token 未配置或使用默认值',
        details: '请在 manifest 中配置 services.openClaw.apiKey\n或运行: clawkit onboard',
      };
    }

    // 检查 token 长度（至少 32 字符）
    if (apiKey.length < 32) {
      return {
        component: 'Webhook 配置',
        status: 'warn',
        message: 'Webhook token 长度不足（建议至少 32 字符）',
        details: '当前长度: ' + apiKey.length,
      };
    }

    return {
      component: 'Webhook 配置',
      status: 'ok',
      message: 'Token 已配置',
      details: `长度: ${apiKey.length} 字符`,
    };
  }

  private readOpenCodePassword(): string | undefined {
    const passwordEnv = process.env.OPENCODE_SERVER_PASSWORD_ENV ?? 'OPENCODE_SERVER_PASSWORD';
    return process.env[passwordEnv];
  }

  private resolveOpenCodePort(manifest: Manifest): number {
    for (const worker of manifest.workers) {
      const project = worker.projects.find((item) => item.openCode.port && item.openCode.port > 0);
      if (project && project.openCode.port) {
        return project.openCode.port;
      }
    }

    return 4096;
  }

  private resolveOpenClawLocalPort(manifest: Manifest): number {
    try {
      const url = new URL(manifest.services.openClaw.publicUrl);
      const parsed = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
      return Number.isInteger(parsed) && parsed > 0 ? parsed : 18000;
    } catch {
      return 18000;
    }
  }

  /**
   * 打印验证报告
   */
  private printReport(results: VerifyResult[]): void {
    Logger.divider();
    Logger.title('验证报告');
    Logger.info('');

    let okCount = 0;
    let warnCount = 0;
    let errorCount = 0;

    for (const result of results) {
      const icon = result.status === 'ok' ? '✓' : result.status === 'warn' ? '⚠' : '✗';
      const color = result.status === 'ok' ? 'success' : result.status === 'warn' ? 'warn' : 'error';

      if (result.status === 'ok') {
        okCount++;
        Logger.success(`${icon} ${result.component}: ${result.message}`);
      } else if (result.status === 'warn') {
        warnCount++;
        Logger.warn(`${icon} ${result.component}: ${result.message}`);
      } else {
        errorCount++;
        Logger.error(`${icon} ${result.component}: ${result.message}`);
      }

      if (result.details) {
        const lines = result.details.split('\n');
        for (const line of lines) {
          Logger.info(`    ${line}`);
        }
      }

      Logger.info('');
    }

    Logger.divider();
    Logger.info(`总计: ${results.length} 项检查`);
    Logger.success(`  通过: ${okCount}`);
    
    if (warnCount > 0) {
      Logger.warn(`  警告: ${warnCount}`);
    }
    
    if (errorCount > 0) {
      Logger.error(`  失败: ${errorCount}`);
    }

    Logger.info('');

    if (errorCount > 0) {
      Logger.error('验证未通过，请修复上述错误后重试');
      process.exitCode = 1;
    } else if (warnCount > 0) {
      Logger.warn('验证通过，但存在警告项');
    } else {
      Logger.success('所有检查通过！');
    }
  }

  /**
   * HTTP GET 请求（同步方式，使用 curl）
   */
  private httpGet(
    url: string,
    timeoutMs: number,
    auth?: { username: string; password?: string },
  ): { statusCode: number; body: string } {
    try {
      const authArgs = auth?.password ? ['-u', `${auth.username}:${auth.password}`] : [];
      const result = spawnSync('curl', [
        '-s',
        '-w', '\n%{http_code}',
        '-m', String(timeoutMs / 1000),
        ...authArgs,
        url
      ], {
        encoding: 'utf8',
        timeout: timeoutMs,
      });

      if (result.status !== 0) {
        throw new Error('curl 执行失败');
      }

      const output = result.stdout;
      const lines = output.split('\n');
      const statusCode = parseInt(lines[lines.length - 1], 10);
      const body = lines.slice(0, -1).join('\n');

      return {
        statusCode: isNaN(statusCode) ? 0 : statusCode,
        body,
      };
    } catch (error) {
      throw new Error(`HTTP 请求失败: ${(error as Error).message}`);
    }
  }
}
