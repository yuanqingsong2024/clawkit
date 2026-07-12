import type {
  LoadBalancerStrategy,
  WorkerSelectionCandidate,
  LoadBalanceResult,
  LoadBalancerConfig,
  DEFAULT_LOAD_BALANCER_CONFIG,
} from './load-balancer.interface';

/**
 * 负载最小优先策略
 * 选择当前负载最低的 worker
 */
export class LeastLoadStrategy implements LoadBalancerStrategy {
  selectWorker(
    taskId: string,
    projectKey: string,
    workers: WorkerSelectionCandidate[],
  ): string | null {
    // 过滤出支持该项目的可用 worker
    const eligibleWorkers = workers.filter((w) => {
      // 检查项目支持
      const supportsProject =
        w.supportedProjects.includes(projectKey) ||
        w.supportedProjects.includes('*');
      return supportsProject && w.status === 'idle';
    });

    if (eligibleWorkers.length === 0) {
      return null;
    }

    // 按负载升序排序（负载最低的在前）
    eligibleWorkers.sort((a, b) => {
      // 首先计算负载率（当前负载 / 最大并发数）
      const loadRateA = a.currentLoad / a.maxConcurrency;
      const loadRateB = b.currentLoad / b.maxConcurrency;

      // 负载率低的优先
      if (loadRateA !== loadRateB) {
        return loadRateA - loadRateB;
      }

      // 负载率相同时，选择当前负载数值低的
      return a.currentLoad - b.currentLoad;
    });

    return eligibleWorkers[0].workerId;
  }
}

/**
 * 轮询策略
 * 依次选择每个 worker
 */
export class RoundRobinStrategy implements LoadBalancerStrategy {
  private currentIndex = 0;
  private projectRoundRobins: Map<string, number> = new Map();

  selectWorker(
    taskId: string,
    projectKey: string,
    workers: WorkerSelectionCandidate[],
  ): string | null {
    const eligibleWorkers = workers.filter((w) => {
      const supportsProject =
        w.supportedProjects.includes(projectKey) ||
        w.supportedProjects.includes('*');
      return supportsProject && w.status === 'idle';
    });

    if (eligibleWorkers.length === 0) {
      return null;
    }

    // 获取该项目对应的轮询索引
    const roundRobinIndex = this.projectRoundRobins.get(projectKey) ?? 0;
    const selectedIndex = roundRobinIndex % eligibleWorkers.length;

    // 更新索引
    this.projectRoundRobins.set(projectKey, roundRobinIndex + 1);

    return eligibleWorkers[selectedIndex].workerId;
  }

  /**
   * 重置轮询状态
   */
  reset(): void {
    this.currentIndex = 0;
    this.projectRoundRobins.clear();
  }
}

/**
 * 随机策略
 * 随机选择一个可用的 worker
 */
export class RandomStrategy implements LoadBalancerStrategy {
  selectWorker(
    taskId: string,
    projectKey: string,
    workers: WorkerSelectionCandidate[],
  ): string | null {
    const eligibleWorkers = workers.filter((w) => {
      const supportsProject =
        w.supportedProjects.includes(projectKey) ||
        w.supportedProjects.includes('*');
      return supportsProject && w.status === 'idle';
    });

    if (eligibleWorkers.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * eligibleWorkers.length);
    return eligibleWorkers[randomIndex].workerId;
  }
}

/**
 * 项目亲和性策略
 * 优先选择处理过该项目任务的 worker（如果有的话）
 * 如果没有，则使用负载最小策略
 */
export class ProjectAffinityStrategy implements LoadBalancerStrategy {
  private projectWorkerHistory: Map<string, Set<string>> = new Map();
  private leastLoadStrategy = new LeastLoadStrategy();

  selectWorker(
    taskId: string,
    projectKey: string,
    workers: WorkerSelectionCandidate[],
  ): string | null {
    const eligibleWorkers = workers.filter((w) => {
      const supportsProject =
        w.supportedProjects.includes(projectKey) ||
        w.supportedProjects.includes('*');
      return supportsProject && w.status === 'idle';
    });

    if (eligibleWorkers.length === 0) {
      return null;
    }

    // 查找历史处理过该项目的 worker
    const historicalWorkers = this.projectWorkerHistory.get(projectKey);
    if (historicalWorkers && historicalWorkers.size > 0) {
      // 优先选择历史处理过的 worker 中负载最低的
      const historicalEligible = eligibleWorkers.filter((w) =>
        historicalWorkers.has(w.workerId),
      );

      if (historicalEligible.length > 0) {
        return this.leastLoadStrategy.selectWorker(
          taskId,
          projectKey,
          historicalEligible,
        );
      }
    }

    // 如果没有历史记录，使用负载最小策略
    return this.leastLoadStrategy.selectWorker(taskId, projectKey, eligibleWorkers);
  }

  /**
   * 记录 worker 处理过某个项目的任务
   */
  recordProjectWorker(projectKey: string, workerId: string): void {
    let workers = this.projectWorkerHistory.get(projectKey);
    if (!workers) {
      workers = new Set();
      this.projectWorkerHistory.set(projectKey, workers);
    }
    workers.add(workerId);
  }

  /**
   * 获取项目的历史 worker 列表
   */
  getProjectWorkers(projectKey: string): string[] {
    const workers = this.projectWorkerHistory.get(projectKey);
    return workers ? Array.from(workers) : [];
  }
}

/**
 * 加权策略工厂
 * 根据配置创建对应的策略实例
 */
export function createLoadBalancerStrategy(
  config: LoadBalancerConfig,
): LoadBalancerStrategy {
  switch (config.strategy) {
    case 'round-robin':
      return new RoundRobinStrategy();
    case 'random':
      return new RandomStrategy();
    case 'project-affinity':
      return new ProjectAffinityStrategy();
    case 'least-load':
    default:
      return new LeastLoadStrategy();
  }
}
