import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { sendSuccess } from '../types/api-response';

export function buildHealthRoutes(): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/', async (_request, reply) => {
      sendSuccess(reply, {
        code: 'controller.health.ok',
        message: 'controller 服务运行正常',
        data: {
          service: '@clawkit/controller',
          stage: 'controller HTTP API + OpenClaw 接入 + 草稿回传与确认入口设计阶段',
          timestamp: new Date().toISOString(),
        },
      });
    });
  };
}
