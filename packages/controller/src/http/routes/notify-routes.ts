import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { sendSuccess } from '../types/api-response';

interface NotifyBody {
  taskId?: string;
  event?: string;
  payload?: unknown;
}

export function buildNotifyRoutes(): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.post<{ Body: NotifyBody }>('/', async (request, reply) => {
      sendSuccess(reply, {
        code: 'controller.notify.accepted',
        message: '通知入口已接收请求（当前阶段仅保留入口，不执行真实通知）',
        data: {
          accepted: true,
          request: request.body,
        },
      });
    });
  };
}
