import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

import type { SshNode } from '@clawkit/shared';

import { SshConnectionPool, type SshDeployEvent } from './ssh-connection-pool';
import { SshCommandExecutor } from './ssh-command-executor';

/**
 * systemd 服务状态
 */
export enum SystemdServiceState {
  RUNNING = 'running',
  STOPPED = 'stopped',
  FAILED = 'failed',
  INACTIVE = 'inactive',
  UNKNOWN = 'unknown',
}

/**
 * systemd 服务信息
 */
export interface SystemdServiceInfo {
  name: string;
  state: SystemdServiceState;
  mainPid?: number;
  memoryUsage?: number; // KB
  cpuTime?: number; // seconds
  uptime?: string;
  lastTriggered?: string;
}

/**
 * systemd 服务安装选项
 */
export interface SystemdServiceOptions {
  description?: string;
  workingDirectory?: string;
  execStart: string;
  environmentFile?: string;
  restart?: 'always' | 'on-failure' | 'no';
  restartSec?: number;
  user?: string;
  group?: string;
  after?: string[];
  wantedBy?: string;
}

/**
 * systemd 服务操作结果
 */
export interface SystemdServiceResult {
  success: boolean;
  serviceName: string;
  action: string;
  message: string;
  previousState?: SystemdServiceState;
  newState?: SystemdServiceState;
}

/**
 * systemd 服务管理
 * 提供远程节点的 systemd 服务安装、启停、状态查询等功能
 */
export class SystemdServiceManager {
  private readonly connectionPool: SshConnectionPool;
  private readonly executor: SshCommandExecutor;

  constructor(connectionPool: SshConnectionPool) {
    this.connectionPool = connectionPool;
    this.executor = new SshCommandExecutor(connectionPool);
  }

  /**
   * 安装 systemd 服务
   */
  async install(
    nodeName: string,
    sshNode: SshNode,
    serviceName: string,
    options: SystemdServiceOptions,
  ): Promise<SystemdServiceResult> {
    this.connectionPool.emit('event', {
      type: 'systemd',
      nodeName,
      message: `安装 systemd 服务: ${serviceName}`,
      details: { serviceName, options },
      timestamp: new Date(),
    } as SshDeployEvent);

    // 1. 创建 systemd service 文件内容
    const serviceContent = this.renderServiceFile(serviceName, options);

    // 2. 创建临时本地文件
    const tempPath = path.join(os.tmpdir(), `${serviceName}.service`);

    // 3. 传输到远程
    const fileSync = new (require('./ssh-file-sync').SshFileSync)(this.connectionPool);
    const transferResult = await fileSync.syncFile(nodeName, sshNode, tempPath, `/tmp/${serviceName}.service`);

    if (!transferResult.success) {
      return {
        success: false,
        serviceName,
        action: 'install',
        message: `服务文件传输失败: ${transferResult.errors.join(', ')}`,
      };
    }

    // 4. 移动到 systemd 目录并设置权限
    const moveResult = await this.executor.execute(
      nodeName,
      sshNode,
      [
        `sudo mv /tmp/${serviceName}.service /etc/systemd/system/${serviceName}.service`,
        `sudo chmod 644 /etc/systemd/system/${serviceName}.service`,
        `sudo systemctl daemon-reload`,
      ].join(' && '),
      { timeout: 30000 },
    );

    if (!moveResult.success) {
      return {
        success: false,
        serviceName,
        action: 'install',
        message: `服务文件安装失败: ${moveResult.stderr}`,
      };
    }

    this.connectionPool.emit('event', {
      type: 'systemd',
      nodeName,
      message: `systemd 服务已安装: ${serviceName}`,
      details: { serviceName },
      timestamp: new Date(),
    } as SshDeployEvent);

    return {
      success: true,
      serviceName,
      action: 'install',
      message: `服务 ${serviceName} 已成功安装`,
      newState: SystemdServiceState.INACTIVE,
    };
  }

  /**
   * 启动服务
   */
  async start(nodeName: string, sshNode: SshNode, serviceName: string): Promise<SystemdServiceResult> {
    const previousState = await this.getServiceState(nodeName, sshNode, serviceName);

    this.connectionPool.emit('event', {
      type: 'systemd',
      nodeName,
      message: `启动服务: ${serviceName}`,
      details: { serviceName, previousState },
      timestamp: new Date(),
    } as SshDeployEvent);

    const result = await this.executor.execute(
      nodeName,
      sshNode,
      `sudo systemctl start ${serviceName}`,
      { timeout: 30000 },
    );

    if (result.success) {
      // 等待服务启动
      await this.waitForState(nodeName, sshNode, serviceName, SystemdServiceState.RUNNING, 30000);
    }

    const newState = await this.getServiceState(nodeName, sshNode, serviceName);

    return {
      success: result.success,
      serviceName,
      action: 'start',
      message: result.success ? `服务 ${serviceName} 已启动` : `启动失败: ${result.stderr}`,
      previousState,
      newState,
    };
  }

  /**
   * 停止服务
   */
  async stop(nodeName: string, sshNode: SshNode, serviceName: string): Promise<SystemdServiceResult> {
    const previousState = await this.getServiceState(nodeName, sshNode, serviceName);

    this.connectionPool.emit('event', {
      type: 'systemd',
      nodeName,
      message: `停止服务: ${serviceName}`,
      details: { serviceName, previousState },
      timestamp: new Date(),
    } as SshDeployEvent);

    const result = await this.executor.execute(
      nodeName,
      sshNode,
      `sudo systemctl stop ${serviceName}`,
      { timeout: 30000 },
    );

    if (result.success) {
      // 等待服务停止
      await this.waitForState(nodeName, sshNode, serviceName, SystemdServiceState.STOPPED, 30000);
    }

    const newState = await this.getServiceState(nodeName, sshNode, serviceName);

    return {
      success: result.success,
      serviceName,
      action: 'stop',
      message: result.success ? `服务 ${serviceName} 已停止` : `停止失败: ${result.stderr}`,
      previousState,
      newState,
    };
  }

  /**
   * 重启服务
   */
  async restart(nodeName: string, sshNode: SshNode, serviceName: string): Promise<SystemdServiceResult> {
    const previousState = await this.getServiceState(nodeName, sshNode, serviceName);

    this.connectionPool.emit('event', {
      type: 'systemd',
      nodeName,
      message: `重启服务: ${serviceName}`,
      details: { serviceName, previousState },
      timestamp: new Date(),
    } as SshDeployEvent);

    const result = await this.executor.execute(
      nodeName,
      sshNode,
      `sudo systemctl restart ${serviceName}`,
      { timeout: 60000 },
    );

    if (result.success) {
      // 等待服务重启完成
      await this.waitForState(nodeName, sshNode, serviceName, SystemdServiceState.RUNNING, 60000);
    }

    const newState = await this.getServiceState(nodeName, sshNode, serviceName);

    return {
      success: result.success,
      serviceName,
      action: 'restart',
      message: result.success ? `服务 ${serviceName} 已重启` : `重启失败: ${result.stderr}`,
      previousState,
      newState,
    };
  }

  /**
   * 启用服务（开机自启）
   */
  async enable(nodeName: string, sshNode: SshNode, serviceName: string): Promise<SystemdServiceResult> {
    this.connectionPool.emit('event', {
      type: 'systemd',
      nodeName,
      message: `启用服务: ${serviceName}`,
      details: { serviceName },
      timestamp: new Date(),
    } as SshDeployEvent);

    const result = await this.executor.execute(
      nodeName,
      sshNode,
      `sudo systemctl enable ${serviceName}`,
      { timeout: 30000 },
    );

    return {
      success: result.success,
      serviceName,
      action: 'enable',
      message: result.success ? `服务 ${serviceName} 已启用` : `启用失败: ${result.stderr}`,
    };
  }

  /**
   * 禁用服务
   */
  async disable(nodeName: string, sshNode: SshNode, serviceName: string): Promise<SystemdServiceResult> {
    this.connectionPool.emit('event', {
      type: 'systemd',
      nodeName,
      message: `禁用服务: ${serviceName}`,
      details: { serviceName },
      timestamp: new Date(),
    } as SshDeployEvent);

    const result = await this.executor.execute(
      nodeName,
      sshNode,
      `sudo systemctl disable ${serviceName}`,
      { timeout: 30000 },
    );

    return {
      success: result.success,
      serviceName,
      action: 'disable',
      message: result.success ? `服务 ${serviceName} 已禁用` : `禁用失败: ${result.stderr}`,
    };
  }

  /**
   * 获取服务状态
   */
  async getServiceState(nodeName: string, sshNode: SshNode, serviceName: string): Promise<SystemdServiceState> {
    const result = await this.executor.execute(
      nodeName,
      sshNode,
      `systemctl is-active ${serviceName}`,
      { timeout: 10000 },
    );

    const state = result.stdout.trim().toLowerCase();

    switch (state) {
      case 'active':
        return SystemdServiceState.RUNNING;
      case 'inactive':
      case 'deactivating':
        return SystemdServiceState.STOPPED;
      case 'failed':
        return SystemdServiceState.FAILED;
      default:
        return SystemdServiceState.UNKNOWN;
    }
  }

  /**
   * 获取服务详细信息
   */
  async getServiceInfo(nodeName: string, sshNode: SshNode, serviceName: string): Promise<SystemdServiceInfo | null> {
    const result = await this.executor.execute(
      nodeName,
      sshNode,
      `systemctl status ${serviceName} --no-pager`,
      { timeout: 10000 },
    );

    if (!result.success && !result.stdout.includes(serviceName)) {
      return null;
    }

    const output = result.stdout;

    // 解析状态
    let state = SystemdServiceState.UNKNOWN;
    if (output.includes('Active: active')) {
      state = SystemdServiceState.RUNNING;
    } else if (output.includes('Active: inactive')) {
      state = SystemdServiceState.STOPPED;
    } else if (output.includes('Active: failed')) {
      state = SystemdServiceState.FAILED;
    }

    // 解析 PID
    const pidMatch = output.match(/Main PID:\s+(\d+)/);
    const mainPid = pidMatch ? parseInt(pidMatch[1], 10) : undefined;

    // 解析内存使用
    const memoryMatch = output.match(/Memory:\s+([\d.]+\s*\w+)/);
    const memoryUsage = memoryMatch ? this.parseMemorySize(memoryMatch[1]) : undefined;

    // 解析 CPU 时间
    const cpuMatch = output.match(/CPU:\s+([\d.]+s)/);
    const cpuTime = cpuMatch ? parseFloat(cpuMatch[1]) : undefined;

    // 解析启动时间
    const uptimeMatch = output.match(/(?:Active|Loaded):.*;\s*(.+)$/m);
    const uptime = uptimeMatch ? uptimeMatch[1].trim() : undefined;

    // 解析触发时间
    const triggeredMatch = output.match(/(?:Triggered|TriggeredBy)=\[.*\]\s+(.+)$/m);
    const lastTriggered = triggeredMatch ? triggeredMatch[1].trim() : undefined;

    return {
      name: serviceName,
      state,
      mainPid,
      memoryUsage,
      cpuTime,
      uptime,
      lastTriggered,
    };
  }

  /**
   * 检查服务是否存在
   */
  async exists(nodeName: string, sshNode: SshNode, serviceName: string): Promise<boolean> {
    const result = await this.executor.execute(
      nodeName,
      sshNode,
      `systemctl list-unit-files ${serviceName}.service`,
      { timeout: 10000 },
    );

    return result.stdout.includes(serviceName);
  }

  /**
   * 卸载服务
   */
  async uninstall(nodeName: string, sshNode: SshNode, serviceName: string): Promise<SystemdServiceResult> {
    // 先停止服务
    await this.stop(nodeName, sshNode, serviceName);

    this.connectionPool.emit('event', {
      type: 'systemd',
      nodeName,
      message: `卸载服务: ${serviceName}`,
      details: { serviceName },
      timestamp: new Date(),
    } as SshDeployEvent);

    const result = await this.executor.execute(
      nodeName,
      sshNode,
      [
        `sudo systemctl disable ${serviceName} 2>/dev/null || true`,
        `sudo rm -f /etc/systemd/system/${serviceName}.service`,
        `sudo systemctl daemon-reload`,
        `sudo systemctl reset-failed ${serviceName} 2>/dev/null || true`,
      ].join(' && '),
      { timeout: 30000 },
    );

    return {
      success: result.success,
      serviceName,
      action: 'uninstall',
      message: result.success ? `服务 ${serviceName} 已卸载` : `卸载失败: ${result.stderr}`,
    };
  }

  /**
   * 查看服务日志
   */
  async getJournal(
    nodeName: string,
    sshNode: SshNode,
    serviceName: string,
    lines?: number,
    since?: Date,
  ): Promise<string> {
    let command = `sudo journalctl -u ${serviceName} --no-pager`;

    if (lines) {
      command += ` -n ${lines}`;
    }

    if (since) {
      command += ` --since "${since.toISOString()}"`;
    }

    const result = await this.executor.execute(nodeName, sshNode, command, { timeout: 30000 });

    return result.stdout;
  }

  /**
   * 渲染 systemd service 文件
   */
  private renderServiceFile(serviceName: string, options: SystemdServiceOptions): string {
    const lines: string[] = ['[Unit]'];

    if (options.description) {
      lines.push(`Description=${options.description}`);
    }

    lines.push('After=network.target');

    if (options.after) {
      for (const dep of options.after) {
        lines.push(`After=${dep}`);
      }
    }

    lines.push('', '[Service]');
    lines.push('Type=simple');

    if (options.workingDirectory) {
      lines.push(`WorkingDirectory=${options.workingDirectory}`);
    }

    if (options.environmentFile) {
      lines.push(`EnvironmentFile=${options.environmentFile}`);
    }

    lines.push(`ExecStart=${options.execStart}`);

    if (options.restart) {
      lines.push(`Restart=${options.restart}`);
    }

    if (options.restartSec) {
      lines.push(`RestartSec=${options.restartSec}`);
    }

    if (options.user) {
      lines.push(`User=${options.user}`);
    }

    if (options.group) {
      lines.push(`Group=${options.group}`);
    }

    lines.push('', '[Install]');
    lines.push(`WantedBy=${options.wantedBy ?? 'multi-user.target'}`);

    return lines.join('\n') + '\n';
  }

  /**
   * 等待服务达到目标状态
   */
  private async waitForState(
    nodeName: string,
    sshNode: SshNode,
    serviceName: string,
    targetState: SystemdServiceState,
    timeoutMs: number,
  ): Promise<boolean> {
    const startTime = Date.now();
    const interval = 1000;

    while (Date.now() - startTime < timeoutMs) {
      const currentState = await this.getServiceState(nodeName, sshNode, serviceName);

      if (currentState === targetState) {
        return true;
      }

      // 短暂等待后重试
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    return false;
  }

  /**
   * 解析内存大小字符串
   */
  private parseMemorySize(sizeStr: string): number {
    const match = sizeStr.match(/([\d.]+)\s*(\w+)?/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();

    const multipliers: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
    };

    return Math.round(value * (multipliers[unit] || 1));
  }
}
