import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { OpenCodeSetupService, type OpenCodeSetupRequest } from '../services/opencode-setup.service';
import { sendSuccess } from '../types/api-response';

interface SetupOpenCodeBody {
  installMode: 'local' | 'external' | 'skip';
  serverUrl?: string;
}

export function buildOpenCodeSetupRoutes(): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    const openCodeSetupService = new OpenCodeSetupService();

    app.post<{ Body: SetupOpenCodeBody }>('/configure', async (request, reply) => {
      const setupRequest: OpenCodeSetupRequest = {
        installMode: request.body.installMode,
        serverUrl: request.body.serverUrl,
      };

      const result = await openCodeSetupService.setup(setupRequest);

      if (!result.success) {
        sendSuccess(reply, {
          statusCode: 400,
          code: 'controller.opencode_setup.failed',
          message: result.message,
          data: result,
        });
        return;
      }

      sendSuccess(reply, {
        statusCode: 200,
        code: 'controller.opencode_setup.success',
        message: result.message,
        data: result,
      });
    });
  };
}
