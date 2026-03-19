import type { FastifyInstance } from 'fastify';

import type { ServiceContainer } from '../services/service-container';
import { buildOpenClawRoutes } from './openclaw-routes';
import { buildApprovalRoutes } from './approval-routes';
import { buildDraftsRoutes } from './drafts-routes';
import { buildHealthRoutes } from './health-routes';
import { buildNotifyRoutes } from './notify-routes';
import { buildTasksRoutes } from './tasks-routes';
import { buildDispatchesRoutes } from './dispatches-routes';
import { buildWorkersRoutes } from './workers-routes';
import { buildManifestRoutes } from './manifest-routes';
import { buildOverviewRoutes } from './overview-routes';
import { buildSetupRoutes } from './setup-routes';
import { buildSystemRoutes } from './system-routes';

export async function registerApiRoutes(app: FastifyInstance, container: ServiceContainer): Promise<void> {
  await app.register(buildOpenClawRoutes(container.openClawAdapter), { prefix: '/api/openclaw' });
  await app.register(buildTasksRoutes(container.apiService), { prefix: '/api/tasks' });
  await app.register(buildDraftsRoutes(container.apiService), { prefix: '/api/drafts' });
  await app.register(buildApprovalRoutes(container.apiService), { prefix: '/api/approval' });
  await app.register(buildWorkersRoutes(container.workerRegistry, container.dispatchService), { prefix: '/api/workers' });
  await app.register(buildDispatchesRoutes(container.dispatchService), { prefix: '/api/dispatches' });
  await app.register(buildNotifyRoutes(), { prefix: '/api/notify' });
  await app.register(buildHealthRoutes(), { prefix: '/api/health' });
  await app.register(buildOverviewRoutes(container.webConsoleService), { prefix: '/api/overview' });
  await app.register(buildManifestRoutes(container.webConsoleService), { prefix: '/api/manifest' });
  await app.register(buildSystemRoutes(container.webConsoleService), { prefix: '/api/system' });
  await app.register(buildSetupRoutes(container.setupOrchestrator), { prefix: '/api/setup' });
}
