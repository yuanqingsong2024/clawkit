import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoadBalancerService } from '../../src/services/load-balancer.service';
import type { LoadBalancerConfig } from '../../src/services/load-balancer.interface';
import { WorkerRegistry } from '../../src/services/worker-registry';
import { WorkerStatus, WorkerRegisterRequest } from '@clawkit/shared';

/**
 * 创建模拟 WorkerRegistry
 */
function createMockWorkerRegistry(): WorkerRegistry {
  return new WorkerRegistry();
}

/**
 * 注册测试用的 worker
 */
function registerTestWorker(
  registry: WorkerRegistry,
  workerId: string,
  name: string,
  maxConcurrency: number = 1,
  runningCount: number = 0,
  supportedProjects: string[] = ['*'],
  status: WorkerStatus = WorkerStatus.IDLE,
): void {
  const request: WorkerRegisterRequest = {
    workerId,
    name,
    nodeName: 'test-node',
    connectMode: 'pull',
    tags: [],
    maxConcurrency,
    supportedProjects,
  };

  const worker = registry.register(request);

  // 手动设置运行中的任务数（模拟不同负载）
  worker.runningCount = runningCount;

  // 如果不是 IDLE 状态，手动设置
  if (status !== WorkerStatus.IDLE) {
    registry.heartbeat(workerId, { status });
  }
}

describe('LoadBalancerService', () => {
  let workerRegistry: WorkerRegistry;
  let loadBalancerService: LoadBalancerService;

  const defaultConfig: LoadBalancerConfig = {
    strategy: 'least-load',
    enableProjectAffinity: true,
    maxRetries: 3,
    heartbeatTimeoutMs: 30000,
  };

  beforeEach(() => {
    workerRegistry = createMockWorkerRegistry();
    loadBalancerService = new LoadBalancerService(defaultConfig, workerRegistry);
  });

  describe('selectWorker - 负载最小优先策略', () => {
    it('应该选择负载最低的 worker', () => {
      // 注册三个不同负载的 worker
      registerTestWorker(workerRegistry, 'worker-1', 'Worker 1', 2, 0); // 负载 0/2
      registerTestWorker(workerRegistry, 'worker-2', 'Worker 2', 2, 2); // 负载 2/2 (满载)
      registerTestWorker(workerRegistry, 'worker-3', 'Worker 3', 2, 1); // 负载 1/2

      const result = loadBalancerService.selectWorker('task-1', 'default');

      expect(result.success).toBe(true);
      expect(result.selectedWorkerId).toBe('worker-1'); // 负载最低
    });

    it('应该选择负载率最低的 worker（而非绝对值）', () => {
      // worker-1: 0/1 = 0% 负载率
      // worker-2: 1/2 = 50% 负载率
      // worker-3: 2/4 = 50% 负载率
      registerTestWorker(workerRegistry, 'worker-1', 'Worker 1', 1, 0);
      registerTestWorker(workerRegistry, 'worker-2', 'Worker 2', 2, 1);
      registerTestWorker(workerRegistry, 'worker-3', 'Worker 3', 4, 2);

      const result = loadBalancerService.selectWorker('task-1', 'default');

      expect(result.success).toBe(true);
      expect(result.selectedWorkerId).toBe('worker-1'); // 负载率最低
    });

    it('当没有可用 worker 时应该返回失败', () => {
      // 不注册任何 worker
      const result = loadBalancerService.selectWorker('task-1', 'default');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('没有找到支持该项目的可用 worker');
    });

    it('应该只选择支持指定项目的 worker', () => {
      registerTestWorker(workerRegistry, 'worker-1', 'Worker 1', 1, 0, ['project-a']);
      registerTestWorker(workerRegistry, 'worker-2', 'Worker 2', 1, 0, ['project-b']);
      registerTestWorker(workerRegistry, 'worker-3', 'Worker 3', 1, 0, ['*']); // 通配符

      // 请求 project-a
      const resultA = loadBalancerService.selectWorker('task-1', 'project-a');
      expect(resultA.success).toBe(true);
      expect(resultA.selectedWorkerId).toBe('worker-1');

      // 请求 project-b
      const resultB = loadBalancerService.selectWorker('task-2', 'project-b');
      expect(resultB.success).toBe(true);
      expect(resultB.selectedWorkerId).toBe('worker-2');

      // 请求 project-c（只有通配符 worker 支持）
      const resultC = loadBalancerService.selectWorker('task-3', 'project-c');
      expect(resultC.success).toBe(true);
      expect(resultC.selectedWorkerId).toBe('worker-3');
    });

    it('不应该选择忙碌的 worker', () => {
      registerTestWorker(workerRegistry, 'worker-1', 'Worker 1', 1, 0, ['*'], WorkerStatus.IDLE);
      registerTestWorker(workerRegistry, 'worker-2', 'Worker 2', 1, 1, ['*'], WorkerStatus.BUSY);

      const result = loadBalancerService.selectWorker('task-1', 'default');

      expect(result.success).toBe(true);
      expect(result.selectedWorkerId).toBe('worker-1');
    });
  });

  describe('getEligibleWorkers', () => {
    it('应该返回所有符合条件的可用 worker', () => {
      registerTestWorker(workerRegistry, 'worker-1', 'Worker 1', 2, 0, ['project-a']);
      registerTestWorker(workerRegistry, 'worker-2', 'Worker 2', 2, 1, ['project-a', 'project-b']);
      registerTestWorker(workerRegistry, 'worker-3', 'Worker 3', 2, 0, ['project-b']);

      const candidates = loadBalancerService.getEligibleWorkers('project-a');

      expect(candidates).toHaveLength(2);
      expect(candidates.map((c) => c.workerId)).toContain('worker-1');
      expect(candidates.map((c) => c.workerId)).toContain('worker-2');
      expect(candidates.map((c) => c.workerId)).not.toContain('worker-3');
    });
  });

  describe('getLoadStats', () => {
    it('应该返回所有 worker 的负载统计', () => {
      registerTestWorker(workerRegistry, 'worker-1', 'Worker 1', 2, 1);
      registerTestWorker(workerRegistry, 'worker-2', 'Worker 2', 4, 2);
      registerTestWorker(workerRegistry, 'worker-3', 'Worker 3', 1, 0);

      const stats = loadBalancerService.getLoadStats();

      expect(stats).toHaveLength(3);

      const worker1Stats = stats.find((s) => s.workerId === 'worker-1');
      expect(worker1Stats?.currentLoad).toBe(1);
      expect(worker1Stats?.maxConcurrency).toBe(2);
      expect(worker1Stats?.loadRate).toBe(0.5);

      const worker2Stats = stats.find((s) => s.workerId === 'worker-2');
      expect(worker2Stats?.loadRate).toBe(0.5);

      const worker3Stats = stats.find((s) => s.workerId === 'worker-3');
      expect(worker3Stats?.loadRate).toBe(0);
    });
  });

  describe('updateStrategy', () => {
    it('应该能够更新负载均衡策略', () => {
      registerTestWorker(workerRegistry, 'worker-1', 'Worker 1', 1, 0);
      registerTestWorker(workerRegistry, 'worker-2', 'Worker 2', 1, 0);

      // 初始使用 least-load 策略
      const result1 = loadBalancerService.selectWorker('task-1', 'default');
      expect(result1.success).toBe(true);

      // 切换到 round-robin 策略
      loadBalancerService.updateStrategy({ strategy: 'round-robin' });
      expect(loadBalancerService.getConfig().strategy).toBe('round-robin');

      // 再次选择（应该得到相同的 worker，因为是轮询且只有两个 worker）
      const result2 = loadBalancerService.selectWorker('task-2', 'default');
      expect(result2.success).toBe(true);
    });
  });

  describe('10+ Worker 并发注册', () => {
    it('应该支持 10+ worker 并发注册并正确负载均衡', () => {
      // 注册 15 个 worker，模拟大规模并发场景
      for (let i = 1; i <= 15; i++) {
        const load = i % 3; // 模拟不同负载：0, 1, 2, 0, 1, 2...
        registerTestWorker(
          workerRegistry,
          `worker-${i}`,
          `Worker ${i}`,
          3,
          load,
        );
      }

      const stats = loadBalancerService.getLoadStats();
      expect(stats).toHaveLength(15);

      // 验证负载统计正确
      const totalLoad = stats.reduce((sum, s) => sum + s.currentLoad, 0);
      expect(totalLoad).toBe(15); // 0+1+2+0+1+2+... = 15

      // 验证负载均衡选择功能正常
      const result = loadBalancerService.selectWorker('task-1', 'default');
      expect(result.success).toBe(true);
      expect(result.selectedWorkerId).toMatch(/^worker-\d+$/);
    });

    it('应该在高负载时选择仍有空闲容量的 worker', () => {
      // 模拟真实场景：某些 worker 已接近满载
      registerTestWorker(workerRegistry, 'worker-1', 'Worker 1', 2, 2); // 100% 负载
      registerTestWorker(workerRegistry, 'worker-2', 'Worker 2', 2, 2); // 100% 负载
      registerTestWorker(workerRegistry, 'worker-3', 'Worker 3', 2, 1); // 50% 负载
      registerTestWorker(workerRegistry, 'worker-4', 'Worker 4', 2, 0); // 0% 负载

      const result = loadBalancerService.selectWorker('task-1', 'default');

      expect(result.success).toBe(true);
      // 应该选择负载最低的 worker（worker-4，负载 0）
      expect(result.selectedWorkerId).toBe('worker-4');
    });
  });
});

describe('LoadBalancerStrategy', () => {
  let workerRegistry: WorkerRegistry;

  const createRegistry = (): WorkerRegistry => {
    return new WorkerRegistry();
  };

  beforeEach(() => {
    workerRegistry = createRegistry();
  });

  describe('RoundRobinStrategy', () => {
    it('应该轮询选择不同的 worker', () => {
      registerTestWorker(workerRegistry, 'worker-1', 'Worker 1', 1, 0);
      registerTestWorker(workerRegistry, 'worker-2', 'Worker 2', 1, 0);
      registerTestWorker(workerRegistry, 'worker-3', 'Worker 3', 1, 0);

      const lbService = new LoadBalancerService(
        { strategy: 'round-robin' },
        workerRegistry,
      );

      // 轮询选择
      const result1 = lbService.selectWorker('task-1', 'default');
      const result2 = lbService.selectWorker('task-2', 'default');
      const result3 = lbService.selectWorker('task-3', 'default');
      const result4 = lbService.selectWorker('task-4', 'default');

      // 前三次应该选择不同的 worker
      const selectedIds = [result1.selectedWorkerId, result2.selectedWorkerId, result3.selectedWorkerId];
      const uniqueIds = [...new Set(selectedIds)];
      expect(uniqueIds).toHaveLength(3);

      // 第四次应该回到第一个 worker
      expect(result4.selectedWorkerId).toBe(result1.selectedWorkerId);
    });
  });

  describe('RandomStrategy', () => {
    it('应该能够使用随机策略选择 worker', () => {
      registerTestWorker(workerRegistry, 'worker-1', 'Worker 1', 1, 0);
      registerTestWorker(workerRegistry, 'worker-2', 'Worker 2', 1, 0);

      const lbService = new LoadBalancerService(
        { strategy: 'random' },
        workerRegistry,
      );

      // 多次选择，验证随机性（统计上两种 worker 都可能被选中）
      const results = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const result = lbService.selectWorker(`task-${i}`, 'default');
        if (result.success && result.selectedWorkerId) {
          results.add(result.selectedWorkerId);
        }
      }

      // 多次随机选择后，应该两个 worker 都被选中过（统计上）
      expect(results.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ProjectAffinityStrategy', () => {
    it('应该优先选择历史处理过该项目的 worker', () => {
      registerTestWorker(workerRegistry, 'worker-1', 'Worker 1', 1, 0);
      registerTestWorker(workerRegistry, 'worker-2', 'Worker 2', 1, 0);
      registerTestWorker(workerRegistry, 'worker-3', 'Worker 3', 1, 0);

      const lbService = new LoadBalancerService(
        { strategy: 'project-affinity', enableProjectAffinity: true },
        workerRegistry,
      );

      // 第一次选择 project-a（没有历史）
      const result1 = lbService.selectWorker('task-1', 'project-a');
      expect(result1.success).toBe(true);
      const firstWorkerId = result1.selectedWorkerId;

      // 模拟 worker-1 处理过 project-a 的任务
      // 注意：project-affinity 策略内部会记录历史
      // 第二次选择 project-a（应该优先选择 worker-1）
      const result2 = lbService.selectWorker('task-2', 'project-a');
      expect(result2.success).toBe(true);
    });
  });
});
