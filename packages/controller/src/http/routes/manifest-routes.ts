import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import type { WebConsoleService } from '../services/web-console-service';
import { sendSuccess } from '../types/api-response';

interface SaveManifestBody {
  yamlText: string;
}

export function buildManifestRoutes(webConsoleService: WebConsoleService): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/', async (_request, reply) => {
      const document = webConsoleService.getManifest();
      sendSuccess(reply, {
        code: 'controller.manifest.fetched',
        message: 'Manifest 查询成功',
        data: document,
      });
    });

    app.put<{ Body: SaveManifestBody }>('/', async (request, reply) => {
      const document = webConsoleService.saveManifest(request.body.yamlText);
      sendSuccess(reply, {
        code: 'controller.manifest.saved',
        message: 'Manifest 保存成功',
        data: document,
      });
    });
  };
}
