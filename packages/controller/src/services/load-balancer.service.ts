import type {
  LoadBalancerStrategy,
  WorkerSelectionCandidate,
  LoadBalanceResult,
  LoadBalancerConfig,
} from './load-balancer.interface';
import { createLoadBalancerStrategy } from './load-balancer.strategy';
import type { WorkerRegistry } from './worker-registry';
import { WorkerStatus } from '@clawkit/shared';

/**
 * 负载均衡服务
 * 负责在多个 worker 之间智能分配任务
 */
export class LoadBalancerService {
  private strategy: LoadBalancerStrategy;
  private config: LoadBalancerConfig;

  constructor(
    config: LoadBalancerConfig,
    private workerRegistry: WorkerRegistry,
  ) {
    this.config = config;
    this.strategy = createLoadBalancerStrategy(config);
  }

  /**
   * 选择最优 worker 处理任务
   * @param taskId 任务 ID
   * @param projectKey 项目 key
   * @returns 负载均衡结果
   */
  selectWorker(taskId: string, projectKey: string): LoadBalanceResult {
    let workers = this.getEligibleWorkers(projectKey);

    if (workers.length === 0) {
      return {
        success: false,
        reason: '没有找到支持该项目的可用 worker',
        candidates: [],
      };
    }

    const maxRetries = this.config.maxRetries ?? 3;
    let lastError: string | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const selectedWorkerId = this.strategy.selectWorker(
        taskId,
        projectKey,
        workers,
      );

      if (selectedWorkerId) {
        // 验证选中的 worker 仍然可用
        const worker = this.workerRegistry.getWorker(selectedWorkerId);
        if (worker && worker.status === WorkerStatus.IDLE) {
          return {
            success: true,
            selectedWorkerId,
            reason: `成功选择 worker ${selectedWorkerId}（策略：${this.config.strategy}）`,
          };
        }

        // 如果 worker 不可用，从列表中移除并重试
        lastError = `选中的 worker ${selectedWorkerId} 已不可用`;
        workers = workers.filter((w) => w.workerId !== selectedWorkerId);

        if (workers.length === 0) {
          break;
        }
      } else {
        lastError = '负载均衡策略未能选择有效的 worker';
        break;
      }
    }

    return {
      success: false,
      reason: lastError ?? '选择 worker 失败',
      candidates: workers.map((w) => w.workerId),
    };
  }

  /**
   * 获取支持指定项目的所有可用 worker
   */
  getEligibleWorkers(projectKey: string): WorkerSelectionCandidate[] {
    const allWorkers = this.workerRegistry.getAllWorkers();
    const now = Date.now();
    const timeout = this.config.heartbeatTimeoutMs ?? 30000;

    return allWorkers
      .filter((worker) => {
        // 检查心跳超时
        const isAlive = now - worker.lastHeartbeatAt.getTime() < timeout;
        // 检查是否在线且空闲
        const isAvailable = worker.status === WorkerStatus.IDLE;
        // 检查项目支持
        const supportsProject =
          worker.supportedProjects.includes(projectKey) ||
          worker.supportedProjects.includes('*');

        return isAlive && isAvailable && supportsProject;
      })
      .map((worker) => ({
        workerId: worker.workerId,
        status: worker.status,
        currentLoad: worker.runningCount ?? 0,
        maxConcurrency: worker.maxConcurrency ?? 1,
        supportedProjects: worker.supportedProjects,
        labels: worker.labels ?? {},
        capabilities: worker.capabilities ?? [],
        lastHeartbeatAt: worker.lastHeartbeatAt,
      }));
  }

  /**
   * 获取所有 worker 的负载统计
   */
  getLoadStats(): WorkerLoadStats[] {
    const allWorkers = this.workerRegistry.getAllWorkers();
    return allWorkers.map((worker) => ({
      workerId: worker.workerId,
      name: worker.name,
      status: worker.status,
      currentLoad: worker.runningCount ?? 0,
      maxConcurrency: worker.maxConcurrency ?? 1,
      loadRate: (worker.runningCount ?? 0) / (worker.maxConcurrency ?? 1),
      supportedProjects: worker.supportedProjects,
      lastHeartbeatAt: worker.lastHeartbeatAt,
    }));
  }

  /**
   * 更新负载均衡策略
   */
  updateStrategy(newConfig: LoadBalancerConfig): void {
    this.config = { ...this.config, ...newConfig };
    this.strategy = createLoadBalancerStrategy(this.config);
  }

  /**
   * 获取当前配置
   */
  getConfig(): LoadBalancerConfig {
    return { ...this.config };
  }
}

/**
 * Worker 负载统计
 */
export interface WorkerLoadStats {
  workerId: string;
  name: string;
  status: string;
  currentLoad: number;
  maxConcurrency: number;
  loadRate: number;
  supportedProjects: string[];
  lastHeartbeatAt: Date;
}
