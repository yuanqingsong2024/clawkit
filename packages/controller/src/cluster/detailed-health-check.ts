/**
 * 详细健康检查服务
 * 提供 OpenCode、Claude Code、外部服务、磁盘空间等检查
 */

import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '@clawkit/shared';

const execAsync = promisify(exec);
const logger = createLogger('controller.cluster.detailed-health-check');

/**
 * 健康检查结果
 */
export interface DetailedHealthCheckResult {
  /** 检查项名称 */
  name: string;
  /** 是否健康 */
  healthy: boolean;
  /** 状态: healthy | degraded | unhealthy | unreachable */
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unreachable';
  /** 检查时长（毫秒） */
  duration: number;
  /** 错误信息（如果有） */
  error?: string;
  /** 额外信息 */
  details?: Record<string, unknown>;
}

/**
 * OpenCode 健康检查
 */
export async function checkOpenCodeHealth(baseUrl: string = 'http://127.0.0.1:4096'): Promise<DetailedHealthCheckResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${baseUrl}/health`, {
      signal: controller.signal,
      method: 'GET',
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json().catch(() => ({ status: 'unknown' })) as Record<string, unknown>;
      return {
        name: 'opencode',
        healthy: true,
        status: 'healthy',
        duration: Date.now() - startTime,
        details: {
          url: baseUrl,
          responseStatus: response.status,
          ...data,
        } as Record<string, unknown>,
      };
    } else {
      return {
        name: 'opencode',
        healthy: false,
        status: 'unhealthy',
        duration: Date.now() - startTime,
        error: `HTTP ${response.status}: ${response.statusText}`,
        details: { url: baseUrl },
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isTimeout = error instanceof Error && error.name === 'AbortError';

    return {
      name: 'opencode',
      healthy: false,
      status: isTimeout ? 'unreachable' : 'unreachable',
      duration: Date.now() - startTime,
      error: isTimeout ? '连接超时' : errorMsg,
      details: { url: baseUrl },
    };
  }
}

/**
 * Claude Code 健康检查
 */
export async function checkClaudeCodeHealth(cliPath: string = 'claude-code'): Promise<DetailedHealthCheckResult> {
  const startTime = Date.now();

  try {
    const { stdout } = await execAsync(`${cliPath} --version`, { timeout: 5000 });
    const version = stdout.trim();

    return {
      name: 'claude-code',
      healthy: true,
      status: 'healthy',
      duration: Date.now() - startTime,
      details: {
        path: cliPath,
        version,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isNotFound = errorMsg.includes('not found') || errorMsg.includes('ENOENT');

    return {
      name: 'claude-code',
      healthy: false,
      status: isNotFound ? 'unreachable' : 'unhealthy',
      duration: Date.now() - startTime,
      error: isNotFound ? 'Claude Code 未安装或不在 PATH 中' : errorMsg,
      details: { path: cliPath },
    };
  }
}

/**
 * Worker 心跳超时检测
 */
export function checkWorkerHeartbeat(
  getWorkerStats: () => { total: number; online: number; offline: number; timeoutWorkers: string[] }
): DetailedHealthCheckResult {
  const startTime = Date.now();

  try {
    const stats = getWorkerStats();
    const hasTimeoutWorkers = stats.timeoutWorkers.length > 0;

    return {
      name: 'workers',
      healthy: !hasTimeoutWorkers,
      status: hasTimeoutWorkers ? 'degraded' : 'healthy',
      duration: Date.now() - startTime,
      details: {
        totalWorkers: stats.total,
        onlineWorkers: stats.online,
        offlineWorkers: stats.offline,
        timeoutWorkers: stats.timeoutWorkers,
      },
    };
  } catch (error) {
    return {
      name: 'workers',
      healthy: false,
      status: 'unhealthy',
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 数据库健康检查
 */
export async function checkDatabaseHealth(
  checkFn: () => Promise<{ healthy: boolean; error?: string; details?: Record<string, unknown> }>
): Promise<DetailedHealthCheckResult> {
  const startTime = Date.now();

  try {
    const result = await checkFn();

    return {
      name: 'database',
      healthy: result.healthy,
      status: result.healthy ? 'healthy' : 'unhealthy',
      duration: Date.now() - startTime,
      error: result.error,
      details: result.details,
    };
  } catch (error) {
    return {
      name: 'database',
      healthy: false,
      status: 'unhealthy',
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 磁盘空间检查
 */
export async function checkDiskSpace(path: string = '.'): Promise<DetailedHealthCheckResult> {
  const startTime = Date.now();

  try {
    // 使用 df 命令获取磁盘使用情况
    const { stdout } = await execAsync(`df -k "${path}" | tail -1`, { timeout: 3000 });
    const parts = stdout.trim().split(/\s+/);

    if (parts.length < 4) {
      return {
        name: 'disk',
        healthy: false,
        status: 'unhealthy',
        duration: Date.now() - startTime,
        error: '无法解析磁盘使用情况',
      };
    }

    const totalKb = parseInt(parts[1], 10);
    const usedKb = parseInt(parts[2], 10);
    const availKb = parseInt(parts[3], 10);
    const usePercent = parseInt(parts[4]?.replace('%', '') || '0', 10);

    // 判断磁盘使用率阈值
    const WARNING_THRESHOLD = 80;
    const CRITICAL_THRESHOLD = 90;

    let status: DetailedHealthCheckResult['status'] = 'healthy';
    let healthy = true;

    if (usePercent >= CRITICAL_THRESHOLD) {
      status = 'unhealthy';
      healthy = false;
    } else if (usePercent >= WARNING_THRESHOLD) {
      status = 'degraded';
      healthy = false;
    }

    return {
      name: 'disk',
      healthy,
      status,
      duration: Date.now() - startTime,
      details: {
        path,
        totalMB: Math.round(totalKb / 1024),
        usedMB: Math.round(usedKb / 1024),
        availableMB: Math.round(availKb / 1024),
        usePercent,
        warningThreshold: WARNING_THRESHOLD,
        criticalThreshold: CRITICAL_THRESHOLD,
      },
    };
  } catch (error) {
    return {
      name: 'disk',
      healthy: false,
      status: 'unhealthy',
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 内存使用检查
 */
export function checkMemoryUsage(): DetailedHealthCheckResult {
  const startTime = Date.now();

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const usePercent = Math.round((usedMem / totalMem) * 100);

  const WARNING_THRESHOLD = 80;
  const CRITICAL_THRESHOLD = 90;

  let status: DetailedHealthCheckResult['status'] = 'healthy';
  let healthy = true;

  if (usePercent >= CRITICAL_THRESHOLD) {
    status = 'unhealthy';
    healthy = false;
  } else if (usePercent >= WARNING_THRESHOLD) {
    status = 'degraded';
  }

  return {
    name: 'memory',
    healthy,
    status,
    duration: Date.now() - startTime,
    details: {
      totalMB: Math.round(totalMem / 1024 / 1024),
      usedMB: Math.round(usedMem / 1024 / 1024),
      freeMB: Math.round(freeMem / 1024 / 1024),
      usePercent,
      warningThreshold: WARNING_THRESHOLD,
      criticalThreshold: CRITICAL_THRESHOLD,
    },
  };
}

/**
 * 综合健康检查
 */
export interface ComprehensiveHealthResult {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: DetailedHealthCheckResult[];
  uptime: number;
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unreachable: number;
  };
}

export async function performComprehensiveHealthCheck(options: {
  openCodeUrl?: string;
  claudeCodePath?: string;
  getWorkerStats?: () => { total: number; online: number; offline: number; timeoutWorkers: string[] };
  checkDatabase?: () => Promise<{ healthy: boolean; error?: string; details?: Record<string, unknown> }>;
  diskPath?: string;
}): Promise<ComprehensiveHealthResult> {
  const checks: DetailedHealthCheckResult[] = [];
  const startTime = Date.now();

  // 并行执行所有检查
  const checkPromises: Promise<DetailedHealthCheckResult>[] = [];

  // OpenCode 检查
  if (options.openCodeUrl) {
    checkPromises.push(checkOpenCodeHealth(options.openCodeUrl));
  }

  // Claude Code 检查
  if (options.claudeCodePath !== undefined) {
    checkPromises.push(checkClaudeCodeHealth(options.claudeCodePath));
  }

  // Worker 心跳检查
  if (options.getWorkerStats) {
    checks.push(checkWorkerHeartbeat(options.getWorkerStats));
  }

  // 数据库检查
  if (options.checkDatabase) {
    checkPromises.push(checkDatabaseHealth(options.checkDatabase));
  }

  // 磁盘空间检查
  checkPromises.push(checkDiskSpace(options.diskPath || process.cwd()));

  // 内存检查
  checks.push(checkMemoryUsage());

  // 等待所有异步检查完成
  const asyncResults = await Promise.all(checkPromises);
  checks.push(...asyncResults);

  // 计算汇总
  const summary = {
    total: checks.length,
    healthy: checks.filter((c) => c.status === 'healthy').length,
    degraded: checks.filter((c) => c.status === 'degraded').length,
    unhealthy: checks.filter((c) => c.status === 'unhealthy').length,
    unreachable: checks.filter((c) => c.status === 'unreachable').length,
  };

  // 计算总体状态
  let overall: ComprehensiveHealthResult['overall'] = 'healthy';
  if (summary.unreachable > 0 || summary.unhealthy > 0) {
    overall = 'unhealthy';
  } else if (summary.degraded > 0) {
    overall = 'degraded';
  }

  return {
    overall,
    timestamp: new Date(),
    checks,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    summary,
  };
}
