import type { FastifyInstance } from 'fastify';

import type { ServiceContainer } from '../services/service-container';
import { buildApprovalRoutes } from './approval-routes';
import { buildOpenClawRoutes } from './openclaw-routes';
import { buildDraftsRoutes } from './drafts-routes';
import { buildHealthRoutes } from './health-routes';
import { buildNotifyRoutes } from './notify-routes';
import { buildTasksRoutes } from './tasks-routes';
import { buildDispatchesRoutes } from './dispatches-routes';
import { buildWorkersRoutes } from './workers-routes';
import { buildManifestRoutes } from './manifest-routes';
import { buildOverviewRoutes } from './overview-routes';
import { buildSystemRoutes } from './system-routes';
import { buildControllerConfigRoutes } from './controller-config-routes';
import { buildFileBrowserRoutes } from './file-browser-routes';
import { buildLogsRoutes } from './logs-routes';
import { buildProjectsRoutes } from './projects-routes';
import { buildRuntimeRoutes } from './runtime-routes';
import { buildLoadBalancerRoutes } from './load-balancer-routes';
import { buildOpenApiRoutes } from './openapi-routes';
import { createPluginMarketplaceRoutes } from './plugin-marketplace-routes';
import { createPipelineRoutes } from './pipeline-routes';
import type { MetricsServiceContext } from './metrics-routes';

export async function registerApiRoutes(app: FastifyInstance, container: ServiceContainer, metricsContext?: MetricsServiceContext): Promise<void> {
  await app.register(buildTasksRoutes(container.apiService), { prefix: '/api/tasks' });
  await app.register(buildDraftsRoutes(container.apiService), { prefix: '/api/drafts' });
  await app.register(buildApprovalRoutes(container.apiService), { prefix: '/api/approval' });
  await app.register(buildOpenClawRoutes(container.openclawWebhookAdapter), { prefix: '/api/openclaw' });
  await app.register(buildWorkersRoutes(container.workerRegistry, container.dispatchService), { prefix: '/api/workers' });
  await app.register(buildDispatchesRoutes(container.dispatchService), { prefix: '/api/dispatches' });
  await app.register(buildNotifyRoutes(), { prefix: '/api/notify' });
  await app.register(buildHealthRoutes(), { prefix: '/api/health' });
  await app.register(buildOverviewRoutes(container.webConsoleService), { prefix: '/api/overview' });
  await app.register(buildManifestRoutes(container.webConsoleService), { prefix: '/api/manifest' });
  await app.register(buildControllerConfigRoutes(container.webConsoleService), { prefix: '/api/controller-config' });
  await app.register(buildSystemRoutes(container), { prefix: '/api/system' });
  await app.register(buildProjectsRoutes(container.projectRegistry, container.manifestManager), { prefix: '/api/projects' });
  await app.register(buildFileBrowserRoutes(), { prefix: '/api/file-browser' });
  await app.register(buildLogsRoutes(), { prefix: '/api/logs' });
  await app.register(buildRuntimeRoutes(container.runtimeService));
  await app.register(buildLoadBalancerRoutes(container.loadBalancerService), { prefix: '/api/loadbalancer' });
  await app.register(createPluginMarketplaceRoutes(container.marketplaceService), { prefix: '/api/plugins' });
  await app.register(createPipelineRoutes(container.pipelineService), { prefix: '/api/pipelines' });
  
  // 注册指标路由（如果提供了 metrics 上下文）
  if (metricsContext) {
    const { buildMetricsRoutes } = await import('./metrics-routes');
    await app.register(buildMetricsRoutes(metricsContext), { prefix: '/api/metrics' });
  }

  // 注册 OpenAPI 文档路由
  await app.register(buildOpenApiRoutes({
    title: 'ClawKit API',
    version: '1.0.0',
    description: 'ClawKit 控制器服务 API 文档',
    enableSwaggerUi: true,
  }), { prefix: '/docs' });
}
