import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import type { WebConsoleService } from '../services/web-console-service';
import { sendSuccess } from '../types/api-response';

interface SaveControllerConfigBody {
  manifestPath: string;
}

export function buildControllerConfigRoutes(webConsoleService: WebConsoleService): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/', async (_request, reply) => {
      const config = webConsoleService.getControllerConfig();
      sendSuccess(reply, {
        code: 'controller.config.fetched',
        message: 'Controller 配置查询成功',
        data: config,
      });
    });

    app.put<{ Body: SaveControllerConfigBody }>('/', async (request, reply) => {
      const config = webConsoleService.saveControllerConfig(request.body.manifestPath);
      sendSuccess(reply, {
        code: 'controller.config.saved',
        message: 'Controller 配置保存成功',
        data: config,
      });
    });
  };
}
