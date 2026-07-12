import { OpenCodeInstallService, type OpenCodeInstallResult } from './opencode-install.service';

/**
 * OpenCode 独立配置请求参数
 */
export interface OpenCodeSetupRequest {
  installMode: 'local' | 'external' | 'skip';
  serverUrl?: string;
}

/**
 * OpenCode 配置结果
 */
export interface OpenCodeSetupResult {
  success: boolean;
  message: string;
  details?: string;
  openCodeUrl?: string;
  binaryPath?: string;
  installMode: 'local' | 'external' | 'skip';
  alreadyInstalled?: boolean;
  healthCheckPassed?: boolean;
}

/**
 * OpenCode 独立配置服务
 * 负责处理 OpenCode 的安装、启动和健康检查
 */
export class OpenCodeSetupService {
  /**
   * 执行 OpenCode 配置流程
   */
  async setup(request: OpenCodeSetupRequest): Promise<OpenCodeSetupResult> {
    if (request.installMode === 'skip') {
      return {
        success: true,
        message: 'OpenCode 配置已跳过',
        installMode: 'skip',
      };
    }

    if (request.installMode === 'external') {
      return this.setupExternal(request);
    }

    // installMode === 'local'
    return this.setupLocal();
  }

  /**
   * 本地安装模式：检查安装、安装、启动、健康检查
   */
  private async setupLocal(): Promise<OpenCodeSetupResult> {
    const installService = new OpenCodeInstallService();
    const installResult = await installService.install();

    return {
      success: installResult.success,
      message: installResult.message,
      details: installResult.details,
      openCodeUrl: installResult.openCodeUrl,
      binaryPath: installResult.binaryPath,
      installMode: 'local',
      alreadyInstalled: installResult.alreadyInstalled,
      healthCheckPassed: installResult.success,
    };
  }

  /**
   * 外部模式：验证提供的 URL 是否可达
   */
  private async setupExternal(request: OpenCodeSetupRequest): Promise<OpenCodeSetupResult> {
    if (!request.serverUrl || request.serverUrl.trim().length === 0) {
      return {
        success: false,
        message: 'External 模式需要提供 serverUrl',
        installMode: 'external',
        healthCheckPassed: false,
      };
    }

    const healthCheck = await this.checkOpenCode(request.serverUrl, 5000);

    if (!healthCheck.ok) {
      return {
        success: false,
        message: 'OpenCode 健康检查失败',
        details: healthCheck.message,
        openCodeUrl: request.serverUrl,
        installMode: 'external',
        healthCheckPassed: false,
      };
    }

    return {
      success: true,
      message: 'OpenCode 外部服务验证成功',
      openCodeUrl: request.serverUrl,
      installMode: 'external',
      healthCheckPassed: true,
    };
  }

  /**
   * OpenCode 健康检查
   * OpenCode serve 没有标准 /health 端点，根目录可达即视为服务已启动
   */
  private async checkOpenCode(url: string, timeoutMs: number): Promise<{ ok: boolean; message: string }> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.ok) {
        return { ok: true, message: '服务可达' };
      }

      return { ok: false, message: `服务返回异常状态码：${response.status}` };
    } catch (error) {
      if (error instanceof Error) {
        const message = error.name === 'AbortError'
          ? `请求超时（${timeoutMs}ms）`
          : error.message.includes('ECONNREFUSED')
            ? '服务未启动（端口无响应）'
            : error.message.includes('ETIMEDOUT')
              ? '服务响应超时'
              : error.message.includes('ENOTFOUND')
                ? '域名无法解析'
                : `连接失败：${error.message}`;
        return { ok: false, message };
      }
      return { ok: false, message: '未知错误' };
    }
  }
}
