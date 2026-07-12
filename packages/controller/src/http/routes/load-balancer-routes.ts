import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import type { LoadBalancerService, WorkerLoadStats } from '../../services/load-balancer.service';
import type { LoadBalancerConfig } from '../../services/load-balancer.interface';
import { sendSuccess } from '../types/api-response';

/**
 * 构建负载均衡相关路由
 */
export function buildLoadBalancerRoutes(
  loadBalancerService: LoadBalancerService,
): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    /**
     * 获取负载均衡统计
     */
    app.get('/stats', async (_request, reply) => {
      const stats = loadBalancerService.getLoadStats();
      const config = loadBalancerService.getConfig();

      // 计算聚合统计
      const totalWorkers = stats.length;
      const idleWorkers = stats.filter((s) => s.status === 'idle').length;
      const busyWorkers = stats.filter((s) => s.status === 'busy').length;
      const totalLoad = stats.reduce((sum, s) => sum + s.currentLoad, 0);
      const totalCapacity = stats.reduce((sum, s) => sum + s.maxConcurrency, 0);
      const overallLoadRate = totalCapacity > 0 ? totalLoad / totalCapacity : 0;

      sendSuccess(reply, {
        code: 'controller.loadbalancer.stats_fetched',
        message: '负载统计查询成功',
        data: {
          workers: stats,
          summary: {
            totalWorkers,
            idleWorkers,
            busyWorkers,
            totalLoad,
            totalCapacity,
            overallLoadRate: Math.round(overallLoadRate * 100) / 100,
          },
          config: {
            strategy: config.strategy,
            enableProjectAffinity: config.enableProjectAffinity,
          },
        },
      });
    });

    /**
     * 获取支持特定项目的 worker 候选项
     */
    app.get<{ Querystring: { projectKey?: string } }>(
      '/candidates',
      async (request, reply) => {
        const projectKey = request.query.projectKey ?? '*';
        const candidates = loadBalancerService.getEligibleWorkers(projectKey);

        sendSuccess(reply, {
          code: 'controller.loadbalancer.candidates_fetched',
          message: `获取项目 ${projectKey} 的候选项成功`,
          data: {
            projectKey,
            candidates,
            count: candidates.length,
          },
        });
      },
    );

    /**
     * 获取当前负载均衡配置
     */
    app.get('/config', async (_request, reply) => {
      const config = loadBalancerService.getConfig();

      sendSuccess(reply, {
        code: 'controller.loadbalancer.config_fetched',
        message: '负载均衡配置查询成功',
        data: config,
      });
    });

    /**
     * 更新负载均衡配置
     */
    app.put<{ Body: { config: LoadBalancerConfig } }>(
      '/config',
      async (request, reply) => {
        const { config } = request.body;

        if (!config || !config.strategy) {
          return reply.status(400).send({
            success: false,
            code: 'controller.loadbalancer.invalid_config',
            message: '无效的负载均衡配置，必须指定 strategy',
          });
        }

        const validStrategies = ['least-load', 'round-robin', 'random', 'project-affinity'];
        if (!validStrategies.includes(config.strategy)) {
          return reply.status(400).send({
            success: false,
            code: 'controller.loadbalancer.invalid_strategy',
            message: `无效的策略类型，可选值：${validStrategies.join(', ')}`,
          });
        }

        loadBalancerService.updateStrategy(config);

        sendSuccess(reply, {
          code: 'controller.loadbalancer.config_updated',
          message: '负载均衡配置更新成功',
          data: loadBalancerService.getConfig(),
        });
      },
    );

    /**
     * 测试负载均衡选择
     */
    app.post<{ Body: { taskId: string; projectKey: string } }>(
      '/select',
      async (request, reply) => {
        const { taskId, projectKey } = request.body;

        if (!taskId || !projectKey) {
          return reply.status(400).send({
            success: false,
            code: 'controller.loadbalancer.missing_params',
            message: '缺少必要参数：taskId 和 projectKey',
          });
        }

        const result = loadBalancerService.selectWorker(taskId, projectKey);

        sendSuccess(reply, {
          code: 'controller.loadbalancer.selection_completed',
          message: result.success
            ? `成功选择 worker：${result.selectedWorkerId}`
            : result.reason ?? '选择失败',
          data: result,
        });
      },
    );
  };
}
