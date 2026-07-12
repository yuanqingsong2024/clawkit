import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import type { ControllerApiService } from '../services/controller-api-service';
import { sendSuccess } from '../types/api-response';

interface ConfirmBody {
  operator: string;
  comment?: string;
}

interface CancelBody {
  operator: string;
  comment?: string;
}

export function buildApprovalRoutes(apiService: ControllerApiService): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.post<{ Params: { taskId: string }; Body: ConfirmBody }>('/:taskId/approve', async (request, reply) => {
      const status = apiService.approveDraftAndDispatch(request.params.taskId, request.body.operator, request.body.comment);
      sendSuccess(reply, {
        code: 'controller.approval.approved',
        message: status.dispatch
          ? '草稿确认成功，任务已进入执行链路'
          : '草稿确认成功',
        data: status,
      });
    });

    app.post<{ Params: { taskId: string }; Body: CancelBody }>('/:taskId/cancel', async (request, reply) => {
      const status = apiService.cancelTask(request.params.taskId, request.body.operator, request.body.comment);
      sendSuccess(reply, {
        code: 'controller.approval.cancelled',
        message: '任务已取消',
        data: status,
      });
    });
  };
}
