import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import type { WebConsoleService } from '../services/web-console-service';
import { sendSuccess } from '../types/api-response';

export function buildOverviewRoutes(webConsoleService: WebConsoleService): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/', async (_request, reply) => {
      const overview = await webConsoleService.getOverview();
      sendSuccess(reply, {
        code: 'controller.overview.fetched',
        message: '系统总览查询成功',
        data: overview,
      });
    });
  };
}
