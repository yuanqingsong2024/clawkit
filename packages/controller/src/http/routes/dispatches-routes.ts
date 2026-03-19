import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify';

import type { DispatchService } from '../../services/dispatch-service';
import { sendSuccess } from '../types/api-response';

export function buildDispatchesRoutes(dispatchService: DispatchService): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.post<{ Body: { taskId: string } }>('/', async (request, reply) => {
      const dispatch = dispatchService.dispatchTask(request.body.taskId);
      sendSuccess(reply, {
        statusCode: 201,
        code: 'controller.dispatches.created',
        message: '任务派发成功',
        data: dispatch,
      });
    });

    const handleFetchDispatchByTaskId = async (
      request: { params: { taskId: string } },
      reply: FastifyReply,
    ): Promise<unknown> => {
      const dispatch = dispatchService.getDispatchByTaskId(request.params.taskId);
      if (!dispatch) {
        return reply.status(404).send({
          success: false,
          code: 'controller.dispatches.not_found',
          message: `任务 ${request.params.taskId} 的派发记录未找到`,
        });
      }
      sendSuccess(reply, {
        code: 'controller.dispatches.fetched',
        message: '派发记录查询成功',
        data: dispatch,
      });
    };

    app.get<{ Params: { taskId: string } }>('/:taskId', handleFetchDispatchByTaskId);
    app.get<{ Params: { taskId: string } }>('/task/:taskId', handleFetchDispatchByTaskId);

    app.get('/', async (_request, reply) => {
      const dispatches = dispatchService.getAllDispatches();
      sendSuccess(reply, {
        code: 'controller.dispatches.list_fetched',
        message: '派发记录列表查询成功',
        data: { dispatches, total: dispatches.length },
      });
    });
  };
}
