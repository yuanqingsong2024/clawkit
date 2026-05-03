import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { OpenClawSetupService, type OpenClawSetupRequest } from '../services/openclaw-setup.service';
import { sendSuccess } from '../types/api-response';

interface SetupOpenClawBody {
  deployMode: 'local' | 'external' | 'skip';
  publicUrl?: string;
  apiKey?: string;
}

export function buildOpenClawSetupRoutes(): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    const openClawSetupService = new OpenClawSetupService();

    app.post<{ Body: SetupOpenClawBody }>('/configure', async (request, reply) => {
      const setupRequest: OpenClawSetupRequest = {
        deployMode: request.body.deployMode,
        publicUrl: request.body.publicUrl,
        apiKey: request.body.apiKey,
      };

      const result = await openClawSetupService.setup(setupRequest);

      if (!result.success) {
        sendSuccess(reply, {
          statusCode: 400,
          code: 'controller.openclaw_setup.failed',
          message: result.message,
          data: result,
        });
        return;
      }

      sendSuccess(reply, {
        statusCode: 200,
        code: 'controller.openclaw_setup.success',
        message: result.message,
        data: result,
      });
    });
  };
}
