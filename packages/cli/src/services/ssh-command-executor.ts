import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';

import type { SshNode } from '@clawkit/shared';

import { SshConnectionPool, type SshDeployEvent } from './ssh-connection-pool';

/**
 * 命令执行模式
 */
export enum CommandExecutionMode {
  SYNCHRONOUS = 'synchronous', // 同步等待结果
  BACKGROUND = 'background',   // 后台执行
  STREAM = 'stream',           // 流式输出
}

/**
 * 命令执行结果
 */
export interface CommandExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number; // 毫秒
  nodeName: string;
  command: string;
}

/**
 * 命令执行选项
 */
export interface CommandExecutionOptions {
  timeout?: number; // 毫秒
  cwd?: string;
  env?: Record<string, string>;
  mode?: CommandExecutionMode;
  streamCallback?: (data: string, isStderr: boolean) => void;
}

/**
 * 远程命令执行服务
 * 提供远程命令执行、脚本执行、管道命令等功能
 */
export class SshCommandExecutor {
  private readonly connectionPool: SshConnectionPool;
  private readonly defaultTimeout: number;

  constructor(connectionPool: SshConnectionPool, defaultTimeout?: number) {
    this.connectionPool = connectionPool;
    this.defaultTimeout = defaultTimeout ?? 300000; // 5 分钟
  }

  /**
   * 执行远程命令
   */
  async execute(
    nodeName: string,
    sshNode: SshNode,
    command: string,
    options?: CommandExecutionOptions,
  ): Promise<CommandExecutionResult> {
    const startTime = Date.now();
    const timeout = options?.timeout ?? this.defaultTimeout;

    // 确保连接可用
    await this.connectionPool.getConnection(nodeName, sshNode);

    const args = this.buildSshArgs(sshNode);
    const fullCommand = this.buildRemoteCommand(command, options);

    this.connectionPool.emit('event', {
      type: 'command',
      nodeName,
      message: `执行命令: ${command}`,
      details: { command, timeout },
      timestamp: new Date(),
    } as SshDeployEvent);

    return new Promise((resolve) => {
      const proc = spawn('ssh', [...args, fullCommand], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
      });

      let stdout = '';
      let stderr = '';
      let resolved = false;

      proc.stdout?.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        if (options?.streamCallback) {
          options.streamCallback(text, false);
        }
      });

      proc.stderr?.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        if (options?.streamCallback) {
          options.streamCallback(text, true);
        }
      });

      proc.on('close', (code) => {
        if (resolved) return;
        resolved = true;

        const duration = Date.now() - startTime;
        const exitCode = code ?? -1;

        this.connectionPool.emit('event', {
          type: 'command',
          nodeName,
          message: `命令执行完成: ${command}`,
          details: { exitCode, duration, success: exitCode === 0 },
          timestamp: new Date(),
        } as SshDeployEvent);

        resolve({
          success: exitCode === 0,
          stdout,
          stderr,
          exitCode,
          duration,
          nodeName,
          command,
        });

        // 释放连接
        this.connectionPool.releaseConnection(sshNode);
      });

      proc.on('error', (error) => {
        if (resolved) return;
        resolved = true;

        const duration = Date.now() - startTime;

        this.connectionPool.emit('event', {
          type: 'error',
          nodeName,
          message: `命令执行失败: ${command}`,
          details: { error: error.message, duration },
          timestamp: new Date(),
        } as SshDeployEvent);

        resolve({
          success: false,
          stdout,
          stderr: error.message,
          exitCode: -1,
          duration,
          nodeName,
          command,
        });

        this.connectionPool.releaseConnection(sshNode);
      });

      // 设置超时
      if (timeout > 0) {
        setTimeout(() => {
          if (!resolved) {
            proc.kill();
            resolved = true;

            const duration = Date.now() - startTime;

            this.connectionPool.emit('event', {
              type: 'error',
              nodeName,
              message: `命令执行超时: ${command}`,
              details: { timeout, duration },
              timestamp: new Date(),
            } as SshDeployEvent);

            resolve({
              success: false,
              stdout,
              stderr: `命令执行超时 (${timeout}ms)`,
              exitCode: -1,
              duration,
              nodeName,
              command,
            });

            this.connectionPool.releaseConnection(sshNode);
          }
        }, timeout);
      }
    });
  }

  /**
   * 执行多个命令（管道）
   */
  async executePipe(
    nodeName: string,
    sshNode: SshNode,
    commands: string[],
    options?: CommandExecutionOptions,
  ): Promise<CommandExecutionResult> {
    const pipeline = commands.join(' | ');
    return this.execute(nodeName, sshNode, pipeline, options);
  }

  /**
   * 执行远程脚本文件
   */
  async executeScript(
    nodeName: string,
    sshNode: SshNode,
    scriptContent: string,
    options?: CommandExecutionOptions,
  ): Promise<CommandExecutionResult> {
    // 对脚本内容进行 base64 编码，避免转义问题
    const encoded = Buffer.from(scriptContent).toString('base64');
    const command = `echo '${encoded}' | base64 -d | bash`;

    return this.execute(nodeName, sshNode, command, options);
  }

  /**
   * 检查远程命令是否存在
   */
  async commandExists(nodeName: string, sshNode: SshNode, command: string): Promise<boolean> {
    const result = await this.execute(nodeName, sshNode, `command -v ${command}`);
    return result.success;
  }

  /**
   * 获取远程系统信息
   */
  async getSystemInfo(nodeName: string, sshNode: SshNode): Promise<{
    os: string;
    hostname: string;
    user: string;
    cpuCount: number;
    memory: { total: number; available: number };
    disk: { total: number; available: number };
  }> {
    const commands = [
      "uname -s",
      "hostname",
      "whoami",
      "nproc",
      "free -b | awk 'NR==2 {print $2,$7}'",
      "df -B1 / | awk 'NR==2 {print $2,$4}'",
    ];

    const results = await Promise.all(
      commands.map((cmd) => this.execute(nodeName, sshNode, cmd, { timeout: 10000 })),
    );

    const parseMemory = (line: string) => {
      const parts = line.trim().split(/\s+/);
      return {
        total: parseInt(parts[0], 10) || 0,
        available: parseInt(parts[1], 10) || 0,
      };
    };

    const parseDisk = (line: string) => {
      const parts = line.trim().split(/\s+/);
      return {
        total: parseInt(parts[0], 10) || 0,
        available: parseInt(parts[1], 10) || 0,
      };
    };

    return {
      os: results[0].stdout.trim(),
      hostname: results[1].stdout.trim(),
      user: results[2].stdout.trim(),
      cpuCount: parseInt(results[3].stdout.trim(), 10) || 1,
      memory: parseMemory(results[4].stdout),
      disk: parseDisk(results[5].stdout),
    };
  }

  /**
   * 构建 SSH 参数
   */
  private buildSshArgs(sshNode: SshNode): string[] {
    const args: string[] = [];

    // 连接选项
    args.push('-o', 'StrictHostKeyChecking=no');
    args.push('-o', 'UserKnownHostsFile=/dev/null');
    args.push('-o', 'BatchMode=yes');
    args.push('-o', 'ServerAliveInterval=30');
    args.push('-o', 'ServerAliveCountMax=3');

    // 端口
    if (sshNode.port && sshNode.port !== 22) {
      args.push('-p', String(sshNode.port));
    }

    // 密钥文件
    if (sshNode.keyPath) {
      const resolvedKeyPath = sshNode.keyPath.startsWith('~/')
        ? path.join(os.homedir(), sshNode.keyPath.slice(2))
        : sshNode.keyPath;
      args.push('-i', resolvedKeyPath);
    }

    // 用户@主机
    args.push(`${sshNode.user}@${sshNode.host}`);

    return args;
  }

  /**
   * 构建远程命令
   */
  private buildRemoteCommand(command: string, options?: CommandExecutionOptions): string {
    let fullCommand = command;

    // 设置工作目录
    if (options?.cwd) {
      fullCommand = `cd ${this.escapeShell(options.cwd)} && ${fullCommand}`;
    }

    // 设置环境变量
    if (options?.env && Object.keys(options.env).length > 0) {
      const envVars = Object.entries(options.env)
        .map(([key, value]) => `${key}=${this.escapeShell(value)}`)
        .join(' ');
      fullCommand = `export ${envVars} && ${fullCommand}`;
    }

    return fullCommand;
  }

  /**
   * 转义 Shell 特殊字符
   */
  private escapeShell(value: string): string {
    return `'${value.replace(/'/g, `'"'"'`)}'`;
  }
}
