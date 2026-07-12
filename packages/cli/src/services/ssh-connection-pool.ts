import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';

import type { SshNode } from '@clawkit/shared';

import { Logger } from '../utils/logger';

/**
 * SSH 连接状态
 */
export enum SshConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

/**
 * SSH 命令执行结果
 */
export interface SshCommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number; // 毫秒
}

/**
 * SSH 文件传输进度
 */
export interface SshFileTransferProgress {
  file: string;
  transferred: number;
  total: number;
  percentage: number;
}

/**
 * SSH 连接配置
 */
export interface SshConnectionConfig {
  host: string;
  port: number;
  user: string;
  keyPath?: string;
  password?: string;
  connectionTimeout: number; // 毫秒
  commandTimeout: number; // 毫秒
}

/**
 * SSH 连接池条目
 */
interface SshConnectionPoolEntry {
  config: SshConnectionConfig;
  state: SshConnectionState;
  lastUsed: number;
  activeCommands: number;
  error?: string;
}

/**
 * SSH 部署事件
 */
export interface SshDeployEvent {
  type: 'connection' | 'command' | 'transfer' | 'systemd' | 'rollback' | 'error' | 'info';
  nodeName: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * SSH 连接池管理器
 * 提供 SSH 连接复用、心跳检测、连接健康检查等功能
 */
export class SshConnectionPool extends EventEmitter {
  private readonly pool = new Map<string, SshConnectionPoolEntry>();
  private readonly maxConnectionsPerHost: number;
  private readonly connectionTimeout: number;
  private readonly commandTimeout: number;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(options?: {
    maxConnectionsPerHost?: number;
    connectionTimeout?: number;
    commandTimeout?: number;
  }) {
    super();
    this.maxConnectionsPerHost = options?.maxConnectionsPerHost ?? 5;
    this.connectionTimeout = options?.connectionTimeout ?? 30000;
    this.commandTimeout = options?.commandTimeout ?? 300000; // 5 分钟默认
  }

  /**
   * 获取连接池大小
   */
  getPoolSize(): number {
    return this.pool.size;
  }

  /**
   * 获取活跃连接数
   */
  getActiveConnections(): number {
    let count = 0;
    for (const entry of this.pool.values()) {
      if (entry.state === SshConnectionState.CONNECTED) {
        count++;
      }
    }
    return count;
  }

  /**
   * 生成连接池键
   */
  private getPoolKey(host: string, port: number, user: string): string {
    return `${user}@${host}:${port}`;
  }

  /**
   * 创建 SSH 连接配置
   */
  private createConnectionConfig(sshNode: SshNode): SshConnectionConfig {
    return {
      host: sshNode.host,
      port: sshNode.port ?? 22,
      user: sshNode.user,
      keyPath: sshNode.keyPath,
      password: sshNode.password,
      connectionTimeout: this.connectionTimeout,
      commandTimeout: this.commandTimeout,
    };
  }

  /**
   * 获取或创建连接
   */
  async getConnection(nodeName: string, sshNode: SshNode): Promise<SshConnectionState> {
    const key = this.getPoolKey(sshNode.host, sshNode.port ?? 22, sshNode.user);
    let entry = this.pool.get(key);

    if (!entry) {
      entry = {
        config: this.createConnectionConfig(sshNode),
        state: SshConnectionState.DISCONNECTED,
        lastUsed: Date.now(),
        activeCommands: 0,
      };
      this.pool.set(key, entry);
    }

    // 检查连接是否可用
    if (entry.state === SshConnectionState.CONNECTED) {
      entry.lastUsed = Date.now();
      this.emit('event', {
        type: 'connection',
        nodeName,
        message: `使用已有连接: ${key}`,
        details: { state: entry.state },
        timestamp: new Date(),
      } as SshDeployEvent);
      return entry.state;
    }

    // 尝试建立连接
    entry.state = SshConnectionState.CONNECTING;
    try {
      await this.testConnection(sshNode);
      entry.state = SshConnectionState.CONNECTED;
      entry.error = undefined;
      this.emit('event', {
        type: 'connection',
        nodeName,
        message: `连接成功: ${key}`,
        details: { state: entry.state },
        timestamp: new Date(),
      } as SshDeployEvent);
    } catch (error) {
      entry.state = SshConnectionState.ERROR;
      entry.error = (error as Error).message;
      this.emit('event', {
        type: 'error',
        nodeName,
        message: `连接失败: ${key}`,
        details: { error: (error as Error).message },
        timestamp: new Date(),
      } as SshDeployEvent);
      throw error;
    }

    return entry.state;
  }

  /**
   * 测试 SSH 连接
   */
  private async testConnection(sshNode: SshNode): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = this.buildSshArgs(sshNode, ['echo', 'connection_test']);

      const proc = spawn('ssh', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.connectionTimeout,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0 && stdout.trim() === 'connection_test') {
          resolve();
        } else {
          reject(new Error(stderr.trim() || `SSH 连接测试失败，退出码: ${code}`));
        }
      });

      proc.on('error', (error) => {
        reject(new Error(`SSH 连接错误: ${error.message}`));
      });

      // 设置超时
      setTimeout(() => {
        proc.kill();
        reject(new Error('SSH 连接超时'));
      }, this.connectionTimeout);
    });
  }

  /**
   * 构建 SSH 参数
   */
  private buildSshArgs(sshNode: SshNode, command: string[]): string[] {
    const args: string[] = [];

    // 连接选项
    args.push('-o', 'StrictHostKeyChecking=no');
    args.push('-o', 'UserKnownHostsFile=/dev/null');
    args.push('-o', `ConnectTimeout=${Math.floor(this.connectionTimeout / 1000)}`);
    args.push('-o', 'BatchMode=yes'); // 非交互模式
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

    // 命令
    args.push(...command);

    return args;
  }

  /**
   * 释放连接
   */
  releaseConnection(sshNode: SshNode): void {
    const key = this.getPoolKey(sshNode.host, sshNode.port ?? 22, sshNode.user);
    const entry = this.pool.get(key);

    if (entry) {
      entry.activeCommands = Math.max(0, entry.activeCommands - 1);
    }
  }

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    this.pool.clear();
    this.emit('event', {
      type: 'info',
      nodeName: 'pool',
      message: 'SSH 连接池已关闭',
      timestamp: new Date(),
    } as SshDeployEvent);
  }

  /**
   * 获取连接池状态
   */
  getStatus(): { poolSize: number; activeConnections: number; connections: Record<string, SshConnectionState> } {
    const connections: Record<string, SshConnectionState> = {};
    for (const [key, entry] of this.pool.entries()) {
      connections[key] = entry.state;
    }

    return {
      poolSize: this.pool.size,
      activeConnections: this.getActiveConnections(),
      connections,
    };
  }
}
