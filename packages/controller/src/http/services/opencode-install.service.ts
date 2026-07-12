import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export interface OpenCodeInstallResult {
  success: boolean;
  message: string;
  details?: string;
  openCodeUrl?: string;
  binaryPath?: string;
  alreadyInstalled?: boolean;
}

interface SpawnResult {
  code: number | null;
  stdout: string;
  stderr: string;
  errorMessage: string | null;
  timedOut: boolean;
}

/**
 * OpenCode 安装事件类型
 */
export type OpenCodeInstallEvent =
  | { event: 'opencode.stage'; data: { stage: string; progress: number } }
  | { event: 'opencode.log'; data: { log: string } }
  | { event: 'opencode.complete'; data: { success: boolean; message: string; openCodeUrl?: string; binaryPath?: string; alreadyInstalled?: boolean } }
  | { event: 'opencode.error'; data: { error: string; details?: string } };

/**
 * 事件发布回调函数
 */
export type OpenCodeInstallEventCallback = (event: OpenCodeInstallEvent) => void;

export class OpenCodeInstallService {
  private readonly binaryPath: string;
  private readonly startScriptPath: string;
  private readonly port: number;
  private readonly openCodeUrl: string;
  private readonly installCommand: string;
  private eventCallback?: OpenCodeInstallEventCallback;
  private activeProcesses: Set<ReturnType<typeof spawn>> = new Set();

  constructor() {
    // 使用 homedir，避免硬编码 ~ 路径
    this.binaryPath = path.join(os.homedir(), '.opencode', 'bin', 'opencode');
    this.startScriptPath = path.join(os.homedir(), '.opencode', 'start-opencode.sh');
    this.port = 4096;
    this.openCodeUrl = `http://localhost:${this.port}`;
    this.installCommand = 'curl -fsSL https://opencode.ai/install | bash';
  }

  /**
   * 设置事件回调函数
   */
  setEventCallback(callback: OpenCodeInstallEventCallback): void {
    this.eventCallback = callback;
  }

  /**
   * 终止所有活动进程
   */
  terminateAllProcesses(): void {
    for (const process of this.activeProcesses) {
      try {
        process.kill();
      } catch {
        // 忽略终止失败的情况
      }
    }
    this.activeProcesses.clear();
  }

  /**
   * 发布事件
   */
  private emitEvent(event: OpenCodeInstallEvent): void {
    this.eventCallback?.(event);
  }

  /**
   * 主入口：按顺序执行检查安装、安装、启动、健康检查。
   * 注意：所有错误都通过返回值表达，不抛异常。
   */
  async install(): Promise<OpenCodeInstallResult> {
    try {
      this.emitEvent({ event: 'opencode.stage', data: { stage: 'checking', progress: 0 } });
      const alreadyInstalled = await this.checkAlreadyInstalled();

      if (!alreadyInstalled) {
        this.emitEvent({ event: 'opencode.stage', data: { stage: 'installing', progress: 20 } });
        const installResult = await this.runInstallScript();
        if (!installResult.success) {
          this.emitEvent({ event: 'opencode.error', data: { error: installResult.message, details: installResult.details } });
          return installResult;
        }

        // 安装成功后再确认一次二进制是否可用，避免"安装脚本执行成功但未落地"的误判
        const installedNow = await this.checkAlreadyInstalled();
        if (!installedNow) {
          const result = {
            success: false,
            message: 'OpenCode 安装失败',
            details: `安装脚本已执行，但未检测到可执行文件：${this.binaryPath}`,
            binaryPath: this.binaryPath,
          };
          this.emitEvent({ event: 'opencode.error', data: { error: result.message, details: result.details } });
          return result;
        }
      }

      this.emitEvent({ event: 'opencode.stage', data: { stage: 'starting', progress: 60 } });
      const startResult = await this.startServe();
      if (!startResult.success) {
        this.emitEvent({ event: 'opencode.error', data: { error: startResult.message, details: startResult.details } });
        return startResult;
      }

      this.emitEvent({ event: 'opencode.stage', data: { stage: 'health-check', progress: 80 } });
      const healthyResult = await this.waitForHealthy();
      
      if (healthyResult.success) {
        this.emitEvent({ event: 'opencode.stage', data: { stage: 'complete', progress: 100 } });
        this.emitEvent({ 
          event: 'opencode.complete', 
          data: { 
            success: true, 
            message: healthyResult.message, 
            openCodeUrl: healthyResult.openCodeUrl,
            binaryPath: healthyResult.binaryPath,
            alreadyInstalled 
          } 
        });
      } else {
        this.emitEvent({ event: 'opencode.error', data: { error: healthyResult.message, details: healthyResult.details } });
      }

      return healthyResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emitEvent({ event: 'opencode.error', data: { error: '安装过程发生未预期错误', details: errorMessage } });
      return {
        success: false,
        message: '安装过程发生未预期错误',
        details: errorMessage,
      };
    }
  }

  private async checkAlreadyInstalled(): Promise<boolean> {
    try {
      // 同时检查文件存在与可执行权限
      await fs.access(this.binaryPath, fs.constants.X_OK);
      return true;
    } catch (error) {
      // 不抛异常：按“未安装”处理
      void error;
      return false;
    }
  }

  private async runInstallScript(): Promise<OpenCodeInstallResult> {
    // 官方一键安装命令需要通过 shell 管道执行，因此使用 bash -c
    const result = await this.spawnCommand(
      'bash',
      ['-c', this.installCommand],
      300_000,
    );

    if (result.timedOut) {
      return {
        success: false,
        message: 'OpenCode 安装失败',
        details: '安装超时（5 分钟内未完成）',
        binaryPath: this.binaryPath,
      };
    }

    if (result.errorMessage) {
      return {
        success: false,
        message: 'OpenCode 安装失败',
        details: result.stderr || result.stdout || result.errorMessage,
        binaryPath: this.binaryPath,
      };
    }

    if (result.code !== 0) {
      return {
        success: false,
        message: 'OpenCode 安装失败',
        details: result.stderr || result.stdout,
        binaryPath: this.binaryPath,
      };
    }

    return {
      success: true,
      message: 'OpenCode 安装成功',
      details: result.stdout || result.stderr,
      binaryPath: this.binaryPath,
    };
  }

  private async startServe(): Promise<OpenCodeInstallResult> {
    // apply 阶段已生成启动脚本：~/.opencode/start-opencode.sh
    const result = await this.spawnCommand('bash', [this.startScriptPath], 60_000);

    if (result.timedOut) {
      return {
        success: false,
        message: 'OpenCode 启动失败',
        details: '启动超时（60 秒内未完成）',
        openCodeUrl: this.openCodeUrl,
        binaryPath: this.binaryPath,
      };
    }

    if (result.errorMessage) {
      return {
        success: false,
        message: 'OpenCode 启动失败',
        details: result.stderr || result.stdout || result.errorMessage,
        openCodeUrl: this.openCodeUrl,
        binaryPath: this.binaryPath,
      };
    }

    if (result.code !== 0) {
      return {
        success: false,
        message: 'OpenCode 启动失败',
        details: result.stderr || result.stdout,
        openCodeUrl: this.openCodeUrl,
        binaryPath: this.binaryPath,
      };
    }

    return {
      success: true,
      message: 'OpenCode 启动成功',
      details: result.stdout || result.stderr,
      openCodeUrl: this.openCodeUrl,
      binaryPath: this.binaryPath,
    };
  }

  private async waitForHealthy(): Promise<OpenCodeInstallResult> {
    const maxAttempts = 30;
    const intervalMs = 2000;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        // OpenCode serve 没有标准 /health：根目录可达即视为服务已启动
        // 使用超时信号，避免请求卡死导致整体阻塞
        await fetch(this.openCodeUrl, {
          signal: AbortSignal.timeout(3000),
        });

        return {
          success: true,
          message: 'OpenCode 已启动并通过健康检查',
          openCodeUrl: this.openCodeUrl,
          binaryPath: this.binaryPath,
        };
      } catch (error) {
        // 不抛异常：失败时继续等待下一轮轮询
        void error;
      }

      if (attempt < maxAttempts) {
        await this.sleep(intervalMs);
      }
    }

    return {
      success: false,
      message: 'OpenCode 健康检查超时',
      details: '在 60 秒内未能连通端口 4096',
      openCodeUrl: this.openCodeUrl,
      binaryPath: this.binaryPath,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private spawnCommand(command: string, args: string[], timeoutMs: number): Promise<SpawnResult> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let errorMessage: string | null = null;
      let timedOut = false;

      // 使用 spawn 而非 exec：避免输出过大导致缓冲区问题，并支持流式采集
      // 继承父进程环境变量，包括 http_proxy/https_proxy 等代理配置
      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });

      this.activeProcesses.add(child);

      const timeout = setTimeout(() => {
        timedOut = true;
        // 仅作为兜底：避免子进程无响应导致 install() 永久挂起
        // 这里不抛异常，交由上层根据 timedOut 返回失败结果
        child.kill('SIGKILL');
      }, timeoutMs);

      child.stdout?.on('data', (chunk: Buffer | string) => {
        const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        stdout += text;
        // 实时推送日志
        this.emitEvent({ event: 'opencode.log', data: { log: text.trim() } });
      });

      child.stderr?.on('data', (chunk: Buffer | string) => {
        const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        stderr += text;
        // 实时推送日志
        this.emitEvent({ event: 'opencode.log', data: { log: text.trim() } });
      });

      child.on('error', (error) => {
        errorMessage = error.message;
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        this.activeProcesses.delete(child);
        resolve({
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          errorMessage,
          timedOut,
        });
      });
    });
  }
}
