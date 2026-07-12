import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';

import type { SshNode } from '@clawkit/shared';

import { SshConnectionPool, type SshDeployEvent, type SshFileTransferProgress } from './ssh-connection-pool';

/**
 * 文件传输模式
 */
export enum TransferMode {
  RSYNC = 'rsync', // rsync 增量同步（推荐）
  SCP = 'scp',      // scp 直接复制
  SFTP = 'sftp',    // SFTP 协议
}

/**
 * 文件传输选项
 */
export interface FileTransferOptions {
  mode?: TransferMode;
  delete?: boolean; // rsync 是否删除目标端多余文件
  exclude?: string[]; // 排除的文件/目录模式
  include?: string[]; // 包含的文件/目录模式
  bandwidth?: number; // 带宽限制（KB/s）
  progressCallback?: (progress: SshFileTransferProgress) => void;
  dryRun?: boolean;
}

/**
 * 文件传输结果
 */
export interface FileTransferResult {
  success: boolean;
  transferredFiles: number;
  totalFiles: number;
  totalBytes: number;
  duration: number;
  nodeName: string;
  source: string;
  destination: string;
  errors: string[];
}

/**
 * 文件同步服务
 * 提供 rsync/scp 方式的文件同步功能
 */
export class SshFileSync {
  private readonly connectionPool: SshConnectionPool;
  private readonly defaultMode: TransferMode;
  private readonly maxParallelTransfers: number;

  constructor(
    connectionPool: SshConnectionPool,
    options?: {
      defaultMode?: TransferMode;
      maxParallelTransfers?: number;
    },
  ) {
    this.connectionPool = connectionPool;
    this.defaultMode = options?.defaultMode ?? TransferMode.RSYNC;
    this.maxParallelTransfers = options?.maxParallelTransfers ?? 3;
  }

  /**
   * 同步目录到远程节点
   */
  async syncDirectory(
    nodeName: string,
    sshNode: SshNode,
    localPath: string,
    remotePath: string,
    options?: FileTransferOptions,
  ): Promise<FileTransferResult> {
    const startTime = Date.now();
    const mode = options?.mode ?? this.defaultMode;

    // 验证本地路径
    if (!fs.existsSync(localPath)) {
      return {
        success: false,
        transferredFiles: 0,
        totalFiles: 0,
        totalBytes: 0,
        duration: Date.now() - startTime,
        nodeName,
        source: localPath,
        destination: remotePath,
        errors: [`本地路径不存在: ${localPath}`],
      };
    }

    const stats = fs.statSync(localPath);
    if (!stats.isDirectory()) {
      return {
        success: false,
        transferredFiles: 0,
        totalFiles: 0,
        totalBytes: 0,
        duration: Date.now() - startTime,
        nodeName,
        source: localPath,
        destination: remotePath,
        errors: [`本地路径不是目录: ${localPath}`],
      };
    }

    this.connectionPool.emit('event', {
      type: 'transfer',
      nodeName,
      message: `开始同步目录: ${localPath} -> ${sshNode.host}:${remotePath}`,
      details: { localPath, remotePath, mode },
      timestamp: new Date(),
    } as SshDeployEvent);

    switch (mode) {
      case TransferMode.RSYNC:
        return this.syncWithRsync(nodeName, sshNode, localPath, remotePath, options, startTime);
      case TransferMode.SCP:
        return this.syncWithScp(nodeName, sshNode, localPath, remotePath, options, startTime);
      case TransferMode.SFTP:
        return this.syncWithSftp(nodeName, sshNode, localPath, remotePath, options, startTime);
      default:
        return {
          success: false,
          transferredFiles: 0,
          totalFiles: 0,
          totalBytes: 0,
          duration: Date.now() - startTime,
          nodeName,
          source: localPath,
          destination: remotePath,
          errors: [`不支持的传输模式: ${mode}`],
        };
    }
  }

  /**
   * 同步单个文件到远程节点
   */
  async syncFile(
    nodeName: string,
    sshNode: SshNode,
    localPath: string,
    remotePath: string,
    options?: FileTransferOptions,
  ): Promise<FileTransferResult> {
    const startTime = Date.now();
    const mode = options?.mode ?? this.defaultMode;

    // 验证本地文件
    if (!fs.existsSync(localPath)) {
      return {
        success: false,
        transferredFiles: 0,
        totalFiles: 0,
        totalBytes: 0,
        duration: Date.now() - startTime,
        nodeName,
        source: localPath,
        destination: remotePath,
        errors: [`本地文件不存在: ${localPath}`],
      };
    }

    const stats = fs.statSync(localPath);
    const fileSize = stats.size;

    this.connectionPool.emit('event', {
      type: 'transfer',
      nodeName,
      message: `开始同步文件: ${localPath} -> ${sshNode.host}:${remotePath}`,
      details: { localPath, remotePath, fileSize, mode },
      timestamp: new Date(),
    } as SshDeployEvent);

    switch (mode) {
      case TransferMode.RSYNC:
        return this.syncSingleWithRsync(nodeName, sshNode, localPath, remotePath, options, startTime);
      case TransferMode.SCP:
        return this.syncSingleWithScp(nodeName, sshNode, localPath, remotePath, options, startTime);
      default:
        return this.syncSingleWithScp(nodeName, sshNode, localPath, remotePath, options, startTime);
    }
  }

  /**
   * 使用 rsync 同步目录
   */
  private async syncWithRsync(
    nodeName: string,
    sshNode: SshNode,
    localPath: string,
    remotePath: string,
    options: FileTransferOptions | undefined,
    startTime: number,
  ): Promise<FileTransferResult> {
    const args: string[] = [];

    // rsync 选项
    args.push('-avz'); // 归档、详细、压缩
    args.push('--progress');

    if (options?.delete) {
      args.push('--delete');
    }

    if (options?.exclude && options.exclude.length > 0) {
      for (const pattern of options.exclude) {
        args.push(`--exclude=${pattern}`);
      }
    }

    if (options?.include && options.include.length > 0) {
      for (const pattern of options.include) {
        args.push(`--include=${pattern}`);
      }
    }

    if (options?.bandwidth) {
      args.push(`--bwlimit=${options.bandwidth}`);
    }

    // 指定 SSH 命令
    const sshCmd = this.buildRsyncSshCommand(sshNode);
    args.push('-e', sshCmd);

    // 源和目标
    const normalizedLocalPath = localPath.endsWith('/') ? localPath : `${localPath}/`;
    const remoteTarget = `${sshNode.user}@${sshNode.host}:${remotePath}`;

    args.push(normalizedLocalPath);
    args.push(remoteTarget);

    if (options?.dryRun) {
      args.push('--dry-run');
    }

    return this.runRsync(nodeName, args, localPath, remotePath, startTime);
  }

  /**
   * 使用 rsync 同步单个文件
   */
  private async syncSingleWithRsync(
    nodeName: string,
    sshNode: SshNode,
    localPath: string,
    remotePath: string,
    options: FileTransferOptions | undefined,
    startTime: number,
  ): Promise<FileTransferResult> {
    const args: string[] = ['-avz', '--progress'];

    const sshCmd = this.buildRsyncSshCommand(sshNode);
    args.push('-e', sshCmd);

    args.push(localPath);
    args.push(`${sshNode.user}@${sshNode.host}:${remotePath}`);

    if (options?.dryRun) {
      args.push('--dry-run');
    }

    return this.runRsync(nodeName, args, localPath, remotePath, startTime);
  }

  /**
   * 运行 rsync 命令
   */
  private runRsync(
    nodeName: string,
    args: string[],
    source: string,
    destination: string,
    startTime: number,
  ): Promise<FileTransferResult> {
    return new Promise((resolve) => {
      let transferredFiles = 0;
      let totalBytes = 0;
      const errors: string[] = [];

      const proc = spawn('rsync', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      proc.stderr?.on('data', (data) => {
        const text = data.toString();
        // rsync 进度输出到 stderr
        if (text.includes('sending incremental file list') || text.includes('sent ') || text.includes('total size')) {
          // 解析 rsync 输出
          const sentMatch = text.match(/sent (\d+)/);
          if (sentMatch) {
            totalBytes = parseInt(sentMatch[1], 10);
          }
        }
      });

      proc.stdout?.on('data', (data) => {
        const text = data.toString();
        if (text.includes(' ')) {
          transferredFiles++;
        }
      });

      proc.on('close', (code) => {
        const duration = Date.now() - startTime;

        if (code === 0) {
          this.connectionPool.emit('event', {
            type: 'transfer',
            nodeName,
            message: `目录同步完成: ${source} -> ${destination}`,
            details: { transferredFiles, totalBytes, duration },
            timestamp: new Date(),
          } as SshDeployEvent);
        } else {
          errors.push(`rsync 退出码: ${code}`);
          this.connectionPool.emit('event', {
            type: 'error',
            nodeName,
            message: `目录同步失败: ${source} -> ${destination}`,
            details: { exitCode: code, duration },
            timestamp: new Date(),
          } as SshDeployEvent);
        }

        resolve({
          success: code === 0,
          transferredFiles,
          totalFiles: transferredFiles,
          totalBytes,
          duration,
          nodeName,
          source,
          destination,
          errors,
        });
      });

      proc.on('error', (error) => {
        const duration = Date.now() - startTime;
        errors.push(`rsync 错误: ${error.message}`);

        this.connectionPool.emit('event', {
          type: 'error',
          nodeName,
          message: `目录同步异常: ${source} -> ${destination}`,
          details: { error: error.message, duration },
          timestamp: new Date(),
        } as SshDeployEvent);

        resolve({
          success: false,
          transferredFiles: 0,
          totalFiles: 0,
          totalBytes: 0,
          duration,
          nodeName,
          source,
          destination,
          errors,
        });
      });
    });
  }

  /**
   * 使用 scp 同步目录
   */
  private async syncWithScp(
    nodeName: string,
    sshNode: SshNode,
    localPath: string,
    remotePath: string,
    options: FileTransferOptions | undefined,
    startTime: number,
  ): Promise<FileTransferResult> {
    // scp 不支持目录直接同步，需要先打包再传输
    const tempTar = path.join(os.tmpdir(), `clawkit-sync-${Date.now()}.tar.gz`);

    // 1. 创建 tar 包
    try {
      await this.createTarArchive(localPath, tempTar, options?.exclude);
    } catch (error) {
      return {
        success: false,
        transferredFiles: 0,
        totalFiles: 0,
        totalBytes: 0,
        duration: Date.now() - startTime,
        nodeName,
        source: localPath,
        destination: remotePath,
        errors: [`创建 tar 包失败: ${(error as Error).message}`],
      };
    }

    // 2. 传输 tar 包
    const remoteTar = `${remotePath}/../sync-package.tar.gz`;
    const result = await this.syncSingleWithScp(nodeName, sshNode, tempTar, remoteTar, options, startTime);

    // 3. 远程解压
    if (result.success) {
      const executor = new (require('./ssh-command-executor').SshCommandExecutor)(this.connectionPool);
      await executor.execute(nodeName, sshNode, `cd ${remotePath} && tar -xzf ${remoteTar} && rm ${remoteTar}`);
    }

    // 4. 清理本地临时文件
    try {
      fs.unlinkSync(tempTar);
    } catch {
      // 忽略清理错误
    }

    return result;
  }

  /**
   * 使用 scp 同步单个文件
   */
  private async syncSingleWithScp(
    nodeName: string,
    sshNode: SshNode,
    localPath: string,
    remotePath: string,
    options: FileTransferOptions | undefined,
    startTime: number,
  ): Promise<FileTransferResult> {
    return new Promise((resolve) => {
      const args: string[] = ['-v']; // 详细输出

      if (options?.bandwidth) {
        args.push('-l', String(options.bandwidth));
      }

      args.push('-p'); // 保留权限和时间
      args.push(localPath);
      args.push(`${sshNode.user}@${sshNode.host}:${remotePath}`);

      const proc = spawn('scp', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stderr = '';

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        const duration = Date.now() - startTime;

        if (code === 0) {
          this.connectionPool.emit('event', {
            type: 'transfer',
            nodeName,
            message: `文件同步完成: ${localPath} -> ${sshNode.host}:${remotePath}`,
            details: { duration },
            timestamp: new Date(),
          } as SshDeployEvent);
        }

        resolve({
          success: code === 0,
          transferredFiles: code === 0 ? 1 : 0,
          totalFiles: 1,
          totalBytes: fs.existsSync(localPath) ? fs.statSync(localPath).size : 0,
          duration,
          nodeName,
          source: localPath,
          destination: remotePath,
          errors: code !== 0 ? [stderr] : [],
        });
      });

      proc.on('error', (error) => {
        resolve({
          success: false,
          transferredFiles: 0,
          totalFiles: 1,
          totalBytes: 0,
          duration: Date.now() - startTime,
          nodeName,
          source: localPath,
          destination: remotePath,
          errors: [error.message],
        });
      });
    });
  }

  /**
   * 使用 SFTP 同步（备用方案）
   */
  private async syncWithSftp(
    nodeName: string,
    sshNode: SshNode,
    localPath: string,
    remotePath: string,
    options: FileTransferOptions | undefined,
    startTime: number,
  ): Promise<FileTransferResult> {
    // SFTP 实现较复杂，降级为 scp
    this.connectionPool.emit('event', {
      type: 'info',
      nodeName,
      message: 'SFTP 模式暂未实现，降级为 SCP',
      timestamp: new Date(),
    } as SshDeployEvent);

    return this.syncWithScp(nodeName, sshNode, localPath, remotePath, options, startTime);
  }

  /**
   * 创建 tar 归档文件
   */
  private createTarArchive(sourcePath: string, targetPath: string, exclude?: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['-czf', targetPath, '-C', path.dirname(sourcePath), path.basename(sourcePath)];

      if (exclude && exclude.length > 0) {
        for (const pattern of exclude) {
          args.push(`--exclude=${pattern}`);
        }
      }

      const proc = spawn('tar', args);

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`tar 退出码: ${code}`));
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * 构建 rsync 的 SSH 命令
   */
  private buildRsyncSshCommand(sshNode: SshNode): string {
    const parts: string[] = ['ssh'];

    if (sshNode.port && sshNode.port !== 22) {
      parts.push('-p', String(sshNode.port));
    }

    if (sshNode.keyPath) {
      const resolvedKeyPath = sshNode.keyPath.startsWith('~/')
        ? path.join(os.homedir(), sshNode.keyPath.slice(2))
        : sshNode.keyPath;
      parts.push('-i', resolvedKeyPath);
    }

    parts.push('-o', 'StrictHostKeyChecking=no');
    parts.push('-o', 'UserKnownHostsFile=/dev/null');

    return parts.join(' ');
  }

  /**
   * 检查 rsync 是否可用
   */
  async isRsyncAvailable(nodeName: string, sshNode: SshNode): Promise<boolean> {
    const executor = new (require('./ssh-command-executor').SshCommandExecutor)(this.connectionPool);
    const result = await executor.execute(nodeName, sshNode, 'command -v rsync', { timeout: 10000 });
    return result.success;
  }
}
