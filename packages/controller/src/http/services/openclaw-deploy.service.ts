import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface OpenClawDeployResult {
  success: boolean;
  message: string;
  details?: string;
  openClawUrl?: string;
}

interface SpawnResult {
  code: number | null;
  stdout: string;
  stderr: string;
  errorMessage: string | null;
}

/**
 * OpenClaw 部署事件类型
 */
export type OpenClawDeployEvent =
  | { event: 'openclaw.stage'; data: { stage: string; progress: number } }
  | { event: 'openclaw.log'; data: { log: string } }
  | { event: 'openclaw.complete'; data: { success: boolean; message: string; openClawUrl?: string } }
  | { event: 'openclaw.error'; data: { error: string; details?: string } };

/**
 * 事件发布回调函数
 */
export type OpenClawDeployEventCallback = (event: OpenClawDeployEvent) => void;

export class OpenClawDeployService {
  private readonly openClawUrl = 'http://localhost:18000';
  private eventCallback?: OpenClawDeployEventCallback;
  private activeProcesses: Set<ReturnType<typeof spawn>> = new Set();

  /**
   * 设置事件回调函数
   */
  setEventCallback(callback: OpenClawDeployEventCallback): void {
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
  private emitEvent(event: OpenClawDeployEvent): void {
    this.eventCallback?.(event);
  }

  /**
   * 主入口:按顺序执行生成配置文件、拉取镜像、启动容器、健康检查。
   * 注意:所有错误都通过返回值表达,不抛异常。
   */
  async deploy(): Promise<OpenClawDeployResult> {
    try {
      // 第一步:确保配置文件存在
      this.emitEvent({ event: 'openclaw.stage', data: { stage: 'preparing', progress: 0 } });
      const prepareResult = await this.prepareComposeFile();
      if (!prepareResult.success) {
        this.emitEvent({ event: 'openclaw.error', data: { error: prepareResult.message, details: prepareResult.details } });
        return prepareResult;
      }

      this.emitEvent({ event: 'openclaw.stage', data: { stage: 'pulling', progress: 25 } });
      const pullResult = await this.pullImage();
      if (!pullResult.success) {
        this.emitEvent({ event: 'openclaw.error', data: { error: pullResult.message, details: pullResult.details } });
        return pullResult;
      }

      this.emitEvent({ event: 'openclaw.stage', data: { stage: 'starting', progress: 50 } });
      const startResult = await this.startContainer();
      if (!startResult.success) {
        this.emitEvent({ event: 'openclaw.error', data: { error: startResult.message, details: startResult.details } });
        return startResult;
      }

      this.emitEvent({ event: 'openclaw.stage', data: { stage: 'health-check', progress: 75 } });
      const healthResult = await this.waitForHealthy();
      
      if (healthResult.success) {
        this.emitEvent({ event: 'openclaw.stage', data: { stage: 'complete', progress: 100 } });
        this.emitEvent({ 
          event: 'openclaw.complete', 
          data: { success: true, message: healthResult.message, openClawUrl: healthResult.openClawUrl } 
        });
      } else {
        this.emitEvent({ event: 'openclaw.error', data: { error: healthResult.message, details: healthResult.details } });
      }

      return healthResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emitEvent({ event: 'openclaw.error', data: { error: '部署过程发生未预期错误', details: errorMessage } });
      return {
        success: false,
        message: '部署过程发生未预期错误',
        details: errorMessage,
      };
    }
  }

  /**
   * 准备 docker-compose.yml 配置文件
   */
  private async prepareComposeFile(): Promise<OpenClawDeployResult> {
    try {
      const composeFile = this.getComposeFilePath();
      const composeDir = path.dirname(composeFile);

      if (!fs.existsSync(composeDir)) {
        fs.mkdirSync(composeDir, { recursive: true });
      }

      const content = this.renderDockerCompose();
      fs.writeFileSync(composeFile, content, 'utf8');

      return {
        success: true,
        message: '配置文件生成成功',
      };
    } catch (error) {
      return {
        success: false,
        message: '配置文件生成失败',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 渲染 docker-compose.yml 内容
   */
  private renderDockerCompose(): string {
    return [
      '# OpenClaw Docker Compose 配置',
      '# 由 clawkit 自动生成，请勿手动编辑',
      '',
      "version: '3.8'",
      '',
      'services:',
      '  openclaw-gateway:',
      '    image: ${OPENCLAW_IMAGE:-ghcr.io/openclaw/openclaw:latest}',
      '    container_name: openclaw-gateway',
      '    ports:',
      '      - "18000:18000"',
      '    volumes:',
      '      - ~/.openclaw:/home/node/.openclaw',
      '      - ~/.openclaw/workspace:/home/node/.openclaw/workspace',
      '    environment:',
      '      - OPENCLAW_GATEWAY_PORT=18000',
      '      - OPENCLAW_GATEWAY_BIND=lan',
      '      - OPENCLAW_HOME_VOLUME=/home/node/.openclaw',
      '    healthcheck:',
      "      test: [\"CMD\", \"node\", \"-e\", \"fetch('http://127.0.0.1:18000/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\"]",
      '      interval: 30s',
      '      timeout: 10s',
      '      start_period: 15s',
      '      retries: 3',
      '    restart: unless-stopped',
      '',
    ].join('\n');
  }

  /**
   * 拉取镜像：docker compose -f ~/.openclaw/docker-compose.yml pull
   */
  async pullImage(): Promise<OpenClawDeployResult> {
    const composeFile = this.getComposeFilePath();
    const result = await this.spawnCommand('docker', ['compose', '-f', composeFile, 'pull']);

    if (result.errorMessage) {
      return {
        success: false,
        message: '镜像拉取失败',
        details: this.enhanceDockerError(result.stderr || result.stdout || result.errorMessage),
      };
    }

    if (result.code !== 0) {
      return {
        success: false,
        message: '镜像拉取失败',
        details: this.enhanceDockerError(result.stderr || result.stdout),
      };
    }

    return {
      success: true,
      message: '镜像拉取成功',
      details: result.stdout || result.stderr,
    };
  }

  /**
   * 启动容器：docker compose -f ~/.openclaw/docker-compose.yml up -d openclaw-gateway
   */
  async startContainer(): Promise<OpenClawDeployResult> {
    const composeFile = this.getComposeFilePath();
    const result = await this.spawnCommand('docker', ['compose', '-f', composeFile, 'up', '-d', 'openclaw-gateway']);

    if (result.errorMessage) {
      return {
        success: false,
        message: '容器启动失败',
        details: this.enhanceDockerError(result.stderr || result.stdout || result.errorMessage),
      };
    }

    if (result.code !== 0) {
      return {
        success: false,
        message: '容器启动失败',
        details: this.enhanceDockerError(result.stderr || result.stdout),
      };
    }

    return {
      success: true,
      message: '容器启动成功',
      details: result.stdout || result.stderr,
    };
  }

  /**
   * 健康检查：轮询 http://localhost:18000/healthz，每 3 秒一次，最多 40 次（共 120 秒）。
   */
  async waitForHealthy(): Promise<OpenClawDeployResult> {
    const maxAttempts = 40;
    const intervalMs = 3000;
    const requestTimeoutMs = 5000;
    const healthzUrl = `${this.openClawUrl}/healthz`;

    let lastError: string | null = null;
    let lastStatusCode: number | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        // 使用超时信号，避免请求卡死导致整体阻塞
        const response = await fetch(healthzUrl, {
          signal: AbortSignal.timeout(requestTimeoutMs),
        });

        if (response.ok) {
          return {
            success: true,
            message: 'OpenClaw 部署成功',
            openClawUrl: this.openClawUrl,
          };
        }

        // 记录非 2xx 状态码
        lastStatusCode = response.status;
        lastError = `服务返回异常状态码 ${response.status}`;
      } catch (error) {
        // 记录最后一次失败原因
        if (error instanceof Error) {
          if (error.name === 'AbortError' || error.message.includes('aborted')) {
            lastError = `请求超时（${requestTimeoutMs}ms）`;
          } else if (error.message.includes('ECONNREFUSED')) {
            lastError = '连接被拒绝（端口未监听）';
          } else if (error.message.includes('ENOTFOUND')) {
            lastError = '域名无法解析';
          } else if (error.message.includes('fetch failed')) {
            lastError = '网络请求失败';
          } else {
            lastError = error.message;
          }
        } else {
          lastError = String(error);
        }
      }

      if (attempt < maxAttempts) {
        await this.sleep(intervalMs);
      }
    }

    // 构建详细的超时错误信息
    const totalWaitSeconds = Math.floor((maxAttempts * intervalMs) / 1000);
    let details = `在 ${totalWaitSeconds} 秒内未能通过健康检查`;

    if (lastError) {
      details += `\n\n最后一次检查失败原因：${lastError}`;
    }

    if (lastStatusCode !== null) {
      details += `\n最后返回状态码：${lastStatusCode}`;
    }

    details += '\n\n可能的原因：';
    details += '\n1. 容器启动时间较长，超过了等待窗口';
    details += '\n2. OpenClaw 服务内部启动失败';
    details += '\n3. 端口 18000 被其他进程占用';
    details += '\n\n建议操作：';
    details += '\n1. 检查容器状态：docker ps -a';
    details += '\n2. 查看容器日志：docker logs openclaw-gateway';
    details += '\n3. 手动访问健康检查：curl http://localhost:18000/healthz';

    return {
      success: false,
      message: 'OpenClaw 健康检查超时',
      details,
      openClawUrl: this.openClawUrl,
    };
  }

  private getComposeFilePath(): string {
    // 使用 homedir，避免硬编码 ~ 路径
    return path.join(os.homedir(), '.openclaw', 'docker-compose.yml');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * 增强 Docker 错误信息，识别常见问题并提供友好提示
   */
  private enhanceDockerError(rawError: string): string {
    const lowerError = rawError.toLowerCase();

    // Docker 权限问题
    if (lowerError.includes('permission denied') && lowerError.includes('docker')) {
      return [
        '❌ Docker 权限不足',
        '',
        '原因：当前用户没有权限访问 Docker API',
        '',
        '解决方案：',
        '1. 将当前用户加入 docker 组：',
        '   sudo usermod -aG docker $USER',
        '',
        '2. 重新登录系统（或执行 newgrp docker）',
        '',
        '3. 验证权限：docker ps',
        '',
        '原始错误：',
        rawError,
      ].join('\n');
    }

    // Docker 守护进程未运行
    if (lowerError.includes('cannot connect to the docker daemon')) {
      return [
        '❌ Docker 服务未运行',
        '',
        '原因：Docker 守护进程未启动',
        '',
        '解决方案：',
        '1. 启动 Docker 服务：',
        '   sudo systemctl start docker',
        '',
        '2. 设置开机自启：',
        '   sudo systemctl enable docker',
        '',
        '原始错误：',
        rawError,
      ].join('\n');
    }

    // 网络问题
    if (lowerError.includes('timeout') || lowerError.includes('network')) {
      return [
        '❌ 网络连接问题',
        '',
        '原因：无法连接到镜像仓库',
        '',
        '解决方案：',
        '1. 检查网络连接',
        '2. 配置镜像加速器（如阿里云、腾讯云）',
        '3. 检查防火墙设置',
        '',
        '原始错误：',
        rawError,
      ].join('\n');
    }

    // 返回原始错误
    return rawError;
  }

  private spawnCommand(command: string, args: string[]): Promise<SpawnResult> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let errorMessage: string | null = null;

      const logBuffer: string[] = [];
      let lastFlushTime = Date.now();
      const flushInterval = 100;
      const maxLogsPerFlush = 10;

      const flushLogs = (): void => {
        if (logBuffer.length === 0) return;
        
        const logsToSend = logBuffer.splice(0, maxLogsPerFlush);
        for (const log of logsToSend) {
          this.emitEvent({ event: 'openclaw.log', data: { log } });
        }
        lastFlushTime = Date.now();
      };

      const addLog = (line: string): void => {
        logBuffer.push(line);
        const now = Date.now();
        if (now - lastFlushTime >= flushInterval) {
          flushLogs();
        }
      };

      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.activeProcesses.add(child);

      child.stdout?.on('data', (chunk: Buffer | string) => {
        const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        stdout += text;
        
        const lines = text.split('\n').filter((line) => line.trim().length > 0);
        for (const line of lines) {
          addLog(line);
        }
      });

      child.stderr?.on('data', (chunk: Buffer | string) => {
        const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        stderr += text;
        
        const lines = text.split('\n').filter((line) => line.trim().length > 0);
        for (const line of lines) {
          addLog(line);
        }
      });

      child.on('error', (error) => {
        errorMessage = error.message;
      });

      child.on('close', (code) => {
        this.activeProcesses.delete(child);
        flushLogs();
        resolve({
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          errorMessage,
        });
      });
    });
  }
}
