import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { createLogger } from '@clawkit/shared';

const logger = createLogger('controller.cluster.health-check');

/**
 * 健康检查项
 */
export interface HealthCheckResult {
  /** 检查项名称 */
  name: string;
  /** 是否健康 */
  healthy: boolean;
  /** 检查时长（毫秒） */
  duration: number;
  /** 错误信息（如果有） */
  error?: string;
  /** 额外信息 */
  details?: Record<string, unknown>;
}

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  /** 启用详细健康检查（更全面的检查） */
  detailed?: boolean;
  /** 检查间隔（毫秒） */
  intervalMs?: number;
  /** 超时时间（毫秒） */
  timeoutMs?: number;
  /** 是否在检查失败时记录日志 */
  logOnFailure?: boolean;
}

/**
 * 系统健康状态
 */
export interface SystemHealth {
  /** 总体状态 */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** 检查时间 */
  timestamp: Date;
  /** 实例 ID */
  instanceId: string;
  /** 各检查项结果 */
  checks: HealthCheckResult[];
  /** 运行时间（秒） */
  uptime: number;
  /** 内存使用情况 */
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

/**
 * 就绪探针结果
 */
export interface ReadinessResult {
  ready: boolean;
  reasons: string[];
}

/**
 * 存活探针结果
 */
export interface LivenessResult {
  alive: boolean;
  reason?: string;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<HealthCheckConfig> = {
  detailed: false,
  intervalMs: 30000,
  timeoutMs: 10000,
  logOnFailure: true,
};

/**
 * 健康检查服务
 * 提供系统健康检查、就绪探针、存活探针等功能
 */
export class HealthCheckService extends EventEmitter {
  private readonly config: Required<HealthCheckConfig>;
  private startTime: Date;
  private checkInterval?: NodeJS.Timeout;
  private lastCheckResult?: SystemHealth;
  private readonly checks: Map<string, () => Promise<HealthCheckResult>> = new Map();

  constructor(config?: Partial<HealthCheckConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = new Date();
  }

  /**
   * 注册健康检查项
   */
  registerCheck(name: string, checkFn: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, checkFn);
  }

  /**
   * 注册数据库健康检查
   */
  registerDatabaseCheck(checkFn: () => Promise<{ healthy: boolean; error?: string }>): void {
    this.registerCheck('database', async () => {
      const start = Date.now();
      try {
        const result = await checkFn();
        return {
          name: 'database',
          healthy: result.healthy,
          duration: Date.now() - start,
          error: result.error,
          details: result.healthy ? { status: 'connected' } : undefined,
        };
      } catch (error) {
        return {
          name: 'database',
          healthy: false,
          duration: Date.now() - start,
          error: (error as Error).message,
        };
      }
    });
  }

  /**
   * 注册 Worker 注册表健康检查
   */
  registerWorkerRegistryCheck(
    getWorkerCount: () => number,
    getOfflineWorkerCount: () => number,
  ): void {
    this.registerCheck('worker_registry', async () => {
      const start = Date.now();
      const onlineCount = getWorkerCount();
      const offlineCount = getOfflineWorkerCount();

      return {
        name: 'worker_registry',
        healthy: true,
        duration: Date.now() - start,
        details: {
          onlineWorkers: onlineCount,
          offlineWorkers: offlineCount,
        },
      };
    });
  }

  /**
   * 注册任务队列健康检查
   */
  registerTaskQueueCheck(getQueueStats: () => { pending: number; running: number }): void {
    this.registerCheck('task_queue', async () => {
      const start = Date.now();
      const stats = getQueueStats();

      return {
        name: 'task_queue',
        healthy: true,
        duration: Date.now() - start,
        details: {
          pending: stats.pending,
          running: stats.running,
        },
      };
    });
  }

  /**
   * 注册共享状态健康检查
   */
  registerSharedStateCheck(
    getStateStats: () => { healthy: boolean; error?: string },
  ): void {
    this.registerCheck('shared_state', async () => {
      const start = Date.now();
      try {
        const result = getStateStats();
        return {
          name: 'shared_state',
          healthy: result.healthy,
          duration: Date.now() - start,
          error: result.error,
        };
      } catch (error) {
        return {
          name: 'shared_state',
          healthy: false,
          duration: Date.now() - start,
          error: (error as Error).message,
        };
      }
    });
  }

  /**
   * 执行所有健康检查
   */
  async checkHealth(instanceId: string, detailed?: boolean): Promise<SystemHealth> {
    const checkResults: HealthCheckResult[] = [];
    const now = Date.now();

    // 执行所有注册的检查
    const checkPromises = Array.from(this.checks.entries()).map(
      async ([name, checkFn]) => {
        try {
          const timeoutPromise = new Promise<HealthCheckResult>((_, reject) => {
            setTimeout(
              () => reject(new Error(`检查 ${name} 超时`)),
              this.config.timeoutMs,
            );
          });

          return await Promise.race([checkFn(), timeoutPromise]);
        } catch (error) {
          return {
            name,
            healthy: false,
            duration: 0,
            error: (error as Error).message,
          };
        }
      },
    );

    // 添加基础检查
    checkPromises.push(this.performBasicChecks());

    const results = await Promise.all(checkPromises);
    checkResults.push(...results);

    // 计算总体状态
    const unhealthyCount = checkResults.filter((r) => !r.healthy).length;
    let status: SystemHealth['status'];

    if (unhealthyCount === 0) {
      status = 'healthy';
    } else if (unhealthyCount <= checkResults.length * 0.3) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    // 记录失败日志
    if (status !== 'healthy' && this.config.logOnFailure) {
      const failedChecks = checkResults.filter((r) => !r.healthy);
      this.emit('unhealthy', {
        status,
        checks: failedChecks,
        timestamp: new Date(),
      });
    }

    // 获取内存信息
    const memoryUsage = process.memoryUsage();
    const memoryTotal = memoryUsage.heapTotal;
    const memoryUsed = memoryUsage.heapUsed;

    const health: SystemHealth = {
      status,
      timestamp: new Date(),
      instanceId,
      checks: detailed || this.config.detailed ? checkResults : [],
      uptime: Math.floor((now - this.startTime.getTime()) / 1000),
      memory: {
        used: memoryUsed,
        total: memoryTotal,
        percentage: Math.round((memoryUsed / memoryTotal) * 100),
      },
    };

    this.lastCheckResult = health;
    return health;
  }

  /**
   * 执行基础检查
   */
  private async performBasicChecks(): Promise<HealthCheckResult> {
    const start = Date.now();

    try {
      // 检查事件循环是否阻塞
      const eventLoopBlocked = await this.checkEventLoop();

      // 检查内存使用
      const memoryUsage = process.memoryUsage();
      const memoryPercentage = memoryUsage.heapUsed / memoryUsage.heapTotal;
      const memoryHealthy = memoryPercentage < 0.9;

      // 检查 CPU 使用（简单检查）
      const cpuHealthy = true; // 简化检查

      return {
        name: 'system',
        healthy: eventLoopBlocked && memoryHealthy && cpuHealthy,
        duration: Date.now() - start,
        details: {
          eventLoopBlocked,
          memoryUsage: Math.round(memoryPercentage * 100),
          memoryUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        },
      };
    } catch (error) {
      return {
        name: 'system',
        healthy: false,
        duration: Date.now() - start,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 检查事件循环是否阻塞
   */
  private async checkEventLoop(): Promise<boolean> {
    return new Promise((resolve) => {
      const start = Date.now();
      setImmediate(() => {
        const elapsed = Date.now() - start;
        // 如果延迟超过 100ms，认为事件循环可能阻塞
        resolve(elapsed < 100);
      });
    });
  }

  /**
   * 执行就绪探针检查
   */
  async checkReadiness(): Promise<ReadinessResult> {
    const reasons: string[] = [];

    // 检查是否已完成启动
    if (!this.lastCheckResult) {
      reasons.push('健康检查尚未完成');
    }

    // 检查各组件状态
    if (this.lastCheckResult) {
      const unhealthyChecks = this.lastCheckResult.checks.filter((c) => !c.healthy);

      for (const check of unhealthyChecks) {
        // 关键检查失败时不可就绪
        if (['database', 'system'].includes(check.name)) {
          reasons.push(`关键检查失败: ${check.name} - ${check.error ?? '未知错误'}`);
        }
      }
    }

    return {
      ready: reasons.length === 0,
      reasons,
    };
  }

  /**
   * 执行存活探针检查
   */
  async checkLiveness(): Promise<LivenessResult> {
    // 检查进程是否响应
    try {
      const alive = await this.checkEventLoop();
      return {
        alive,
        reason: alive ? undefined : '事件循环可能阻塞',
      };
    } catch (error) {
      logger.debug('存活探针检查失败', { error: error instanceof Error ? error.message : String(error) });
      return {
        alive: false,
        reason: '进程响应异常',
      };
    }
  }

  /**
   * 启动定期健康检查
   */
  startPeriodicCheck(instanceId: string): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // 立即执行一次
    this.checkHealth(instanceId).catch((error) => {
      console.error('健康检查执行失败:', error);
    });

    // 设置定期检查
    this.checkInterval = setInterval(() => {
      this.checkHealth(instanceId).catch((error) => {
        console.error('健康检查执行失败:', error);
      });
    }, this.config.intervalMs);
  }

  /**
   * 停止定期健康检查
   */
  stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  /**
   * 获取上一次检查结果
   */
  getLastCheckResult(): SystemHealth | undefined {
    return this.lastCheckResult;
  }

  /**
   * 注册 HTTP 健康检查路由
   */
  registerRoutes(app: FastifyInstance, instanceId: string): void {
    // 详细健康检查
    app.get<{ Querystring: { detailed?: string } }>('/health', async (request, reply) => {
      const detailed = request.query.detailed === 'true';
      const health = await this.checkHealth(instanceId, detailed);

      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
      return reply.status(statusCode).send(health);
    });

    // 就绪探针（用于 Kubernetes）
    app.get('/ready', async (request, reply) => {
      const readiness = await this.checkReadiness();

      if (readiness.ready) {
        return reply.status(200).send({ ready: true });
      } else {
        return reply.status(503).send({
          ready: false,
          reasons: readiness.reasons,
        });
      }
    });

    // 存活探针（用于 Kubernetes）
    app.get('/live', async (request, reply) => {
      const liveness = await this.checkLiveness();

      if (liveness.alive) {
        return reply.status(200).send({ alive: true });
      } else {
        return reply.status(503).send({
          alive: false,
          reason: liveness.reason,
        });
      }
    });
  }

  /**
   * 生成健康检查摘要（用于日志）
   */
  generateSummary(health: SystemHealth): string {
    const lines = [
      `状态: ${health.status}`,
      `实例: ${health.instanceId}`,
      `运行时间: ${health.uptime}s`,
      `内存: ${Math.round(health.memory.used / 1024 / 1024)}MB / ${Math.round(health.memory.total / 1024 / 1024)}MB (${health.memory.percentage}%)`,
      '检查项:',
    ];

    for (const check of health.checks) {
      const icon = check.healthy ? '✅' : '❌';
      const error = check.error ? ` - ${check.error}` : '';
      lines.push(`  ${icon} ${check.name}: ${check.duration}ms${error}`);
    }

    return lines.join('\n');
  }

  /**
   * 获取健康状态的哈希值（用于一致性哈希）
   */
  getHealthHash(health: SystemHealth): string {
    const data = JSON.stringify({
      status: health.status,
      timestamp: health.timestamp.toISOString(),
      uptime: health.uptime,
    });

    return createHash('sha256').update(data).digest('hex').substring(0, 8);
  }
}
