import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import type { OpenClawWebhookRequest } from '../services/openclaw-response';
import { OpenClawAdapter } from '../services/openclaw-adapter';

export function buildOpenClawRoutes(adapter: OpenClawAdapter): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.post<{ Body: OpenClawWebhookRequest }>('/webhook', async (request, reply) => {
      const response = await adapter.handleWebhook(
        request.body,
        typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined,
      );
      reply.status(200).send(response);
    });
  };
}
