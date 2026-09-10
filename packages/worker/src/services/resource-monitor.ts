import * as os from 'os';
import type { WorkerResourceUsage, ResourceAlertThresholds } from '@clawkit/shared';

/**
 * 默认告警阈值
 */
export const DEFAULT_ALERT_THRESHOLDS: ResourceAlertThresholds = {
  cpuPercent: 80,
  memoryPercent: 85,
  diskPercent: 90,
};

/**
 * 资源监控服务
 * 收集系统资源使用情况，支持告警阈值检测
 */
export class ResourceMonitor {
  private readonly startTime: number;
  private readonly thresholds: ResourceAlertThresholds;
  private lastCpuIdle: number = 0;
  private lastCpuTotal: number = 0;

  constructor(thresholds?: Partial<ResourceAlertThresholds>) {
    this.startTime = Date.now();
    this.thresholds = { ...DEFAULT_ALERT_THRESHOLDS, ...thresholds };
  }

  /**
   * 获取当前资源使用情况
   */
  getResourceUsage(): WorkerResourceUsage {
    return {
      cpuPercent: this.getCpuUsage(),
      memoryUsedBytes: this.getMemoryUsed(),
      memoryTotalBytes: os.totalmem(),
      memoryPercent: this.getMemoryPercent(),
      diskUsedBytes: this.getDiskUsed(),
      diskTotalBytes: this.getDiskTotal(),
      diskPercent: this.getDiskPercent(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 获取 CPU 使用率
   */
  private getCpuUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    const idle = totalIdle - this.lastCpuIdle;
    const total = totalTick - this.lastCpuTotal;
    const usage = total > 0 ? Math.round((1 - idle / total) * 100) : 0;

    this.lastCpuIdle = totalIdle;
    this.lastCpuTotal = totalTick;

    return Math.max(0, Math.min(100, usage));
  }

  /**
   * 获取已用内存（字节）
   */
  private getMemoryUsed(): number {
    return os.totalmem() - os.freemem();
  }

  /**
   * 获取内存使用率（百分比）
   */
  private getMemoryPercent(): number {
    const total = os.totalmem();
    const used = total - os.freemem();
    return Math.round((used / total) * 100);
  }

  /**
   * 获取磁盘使用量（字节）
   */
  private getDiskUsed(): number {
    try {
      if (process.platform !== 'win32') {
        // 使用 df 命令获取磁盘使用量
        const { execSync } = require('child_process');
        const output = execSync('df -k / | tail -1', { encoding: 'utf8' });
        const parts = output.trim().split(/\s+/);
        if (parts.length >= 4) {
          return parseInt(parts[2], 10) * 1024;
        }
      }
    } catch {
      // 忽略错误
    }
    return 0;
  }

  /**
   * 获取磁盘总量（字节）
   */
  private getDiskTotal(): number {
    try {
      if (process.platform !== 'win32') {
        const { execSync } = require('child_process');
        const output = execSync('df -k / | tail -1', { encoding: 'utf8' });
        const parts = output.trim().split(/\s+/);
        if (parts.length >= 4) {
          const usedKB = parseInt(parts[2], 10);
          const availKB = parseInt(parts[3], 10);
          return (usedKB + availKB) * 1024;
        }
      }
    } catch {
      // 忽略错误
    }
    return 0;
  }

  /**
   * 获取磁盘使用率（百分比）
   */
  private getDiskPercent(): number {
    try {
      if (process.platform !== 'win32') {
        const { execSync } = require('child_process');
        const output = execSync('df -k / | tail -1', { encoding: 'utf8' });
        const parts = output.trim().split(/\s+/);
        if (parts.length >= 4) {
          const usedKB = parseInt(parts[2], 10);
          const availKB = parseInt(parts[3], 10);
          const totalKB = usedKB + availKB;
          return Math.round((usedKB / totalKB) * 100);
        }
      }
    } catch {
      // 忽略错误
    }
    return 0;
  }

  /**
   * 检查是否触发告警
   */
  checkAlerts(usage: WorkerResourceUsage): string[] {
    const alerts: string[] = [];

    if (this.thresholds.cpuPercent && usage.cpuPercent >= this.thresholds.cpuPercent) {
      alerts.push(`CPU 使用率过高: ${usage.cpuPercent}% (阈值: ${this.thresholds.cpuPercent}%)`);
    }

    if (this.thresholds.memoryPercent && usage.memoryPercent >= this.thresholds.memoryPercent) {
      alerts.push(`内存使用率过高: ${usage.memoryPercent}% (阈值: ${this.thresholds.memoryPercent}%)`);
    }

    if (this.thresholds.diskPercent && usage.diskPercent && usage.diskPercent >= this.thresholds.diskPercent) {
      alerts.push(`磁盘使用率过高: ${usage.diskPercent}% (阈值: ${this.thresholds.diskPercent}%)`);
    }

    return alerts;
  }

  /**
   * 获取启动时间
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * 格式化字节数为可读字符串
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }
}
