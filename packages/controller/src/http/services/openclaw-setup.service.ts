import http from 'node:http';
import https from 'node:https';

import { OpenClawDeployService, type OpenClawDeployResult } from './openclaw-deploy.service';

/**
 * OpenClaw 独立配置请求参数
 */
export interface OpenClawSetupRequest {
  deployMode: 'local' | 'external' | 'skip';
  publicUrl?: string;
  apiKey?: string;
}

/**
 * OpenClaw 配置结果
 */
export interface OpenClawSetupResult {
  success: boolean;
  message: string;
  details?: string;
  openClawUrl?: string;
  deployMode: 'local' | 'external' | 'skip';
  healthCheckPassed?: boolean;
}

/**
 * OpenClaw 独立配置服务
 * 负责处理 OpenClaw 的部署和健康检查
 */
export class OpenClawSetupService {
  /**
   * 执行 OpenClaw 配置流程
   */
  async setup(request: OpenClawSetupRequest): Promise<OpenClawSetupResult> {
    if (request.deployMode === 'skip') {
      return {
        success: true,
        message: 'OpenClaw 配置已跳过',
        deployMode: 'skip',
      };
    }

    if (request.deployMode === 'external') {
      return this.setupExternal(request);
    }

    // deployMode === 'local'
    return this.setupLocal();
  }

  /**
   * 本地部署模式：拉取镜像、启动容器、健康检查
   */
  private async setupLocal(): Promise<OpenClawSetupResult> {
    const deployService = new OpenClawDeployService();
    const deployResult = await deployService.deploy();

    return {
      success: deployResult.success,
      message: deployResult.message,
      details: deployResult.details,
      openClawUrl: deployResult.openClawUrl,
      deployMode: 'local',
      healthCheckPassed: deployResult.success,
    };
  }

  /**
   * 外部模式：验证提供的 URL 是否可达
   */
  private async setupExternal(request: OpenClawSetupRequest): Promise<OpenClawSetupResult> {
    if (!request.publicUrl || request.publicUrl.trim().length === 0) {
      return {
        success: false,
        message: 'External 模式需要提供 publicUrl',
        deployMode: 'external',
        healthCheckPassed: false,
      };
    }

    const healthCheckUrl = `${request.publicUrl.replace(/\/$/, '')}/healthz`;
    const healthCheck = await this.checkHttp(healthCheckUrl, 5000);

    if (!healthCheck.ok) {
      return {
        success: false,
        message: 'OpenClaw 健康检查失败',
        details: healthCheck.message,
        openClawUrl: request.publicUrl,
        deployMode: 'external',
        healthCheckPassed: false,
      };
    }

    return {
      success: true,
      message: 'OpenClaw 外部服务验证成功',
      openClawUrl: request.publicUrl,
      deployMode: 'external',
      healthCheckPassed: true,
    };
  }

  /**
   * HTTP 健康检查
   */
  private async checkHttp(url: string, timeoutMs: number): Promise<{ ok: boolean; message: string }> {
    try {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      return await new Promise<{ ok: boolean; message: string }>((resolve) => {
        const request = client.get(
          url,
          {
            timeout: timeoutMs,
          },
          (response) => {
            if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
              resolve({ ok: true, message: `服务可达（HTTP ${response.statusCode}）` });
            } else {
              resolve({ ok: false, message: `服务返回异常状态码：${response.statusCode}` });
            }
            response.resume();
          },
        );

        request.on('error', (error) => {
          const message = error.message.includes('ECONNREFUSED')
            ? '服务未启动（连接被拒绝）'
            : error.message.includes('ETIMEDOUT')
              ? '服务响应超时'
              : error.message.includes('ENOTFOUND')
                ? '域名无法解析'
                : `连接失败：${error.message}`;
          resolve({ ok: false, message });
        });

        request.on('timeout', () => {
          request.destroy();
          resolve({ ok: false, message: `请求超时（${timeoutMs}ms）` });
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      return { ok: false, message: `URL 解析失败：${message}` };
    }
  }
}
