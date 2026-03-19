import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import type {
  WorkerRegisterRequest,
  WorkerHeartbeatRequest,
  WorkerSubmitResultRequest,
} from '@clawkit/shared';

import type { DispatchService } from '../../services/dispatch-service';
import type { WorkerRegistry } from '../../services/worker-registry';
import { sendSuccess } from '../types/api-response';

export function buildWorkersRoutes(
  workerRegistry: WorkerRegistry,
  dispatchService: DispatchService,
): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.post<{ Body: WorkerRegisterRequest }>('/register', async (request, reply) => {
      const record = workerRegistry.register(request.body);
      sendSuccess(reply, {
        statusCode: 201,
        code: 'controller.workers.registered',
        message: 'Worker 注册成功',
        data: record,
      });
    });

    app.post<{ Params: { workerId: string }; Body: WorkerHeartbeatRequest }>(
      '/:workerId/heartbeat',
      async (request, reply) => {
        const record = workerRegistry.heartbeat(request.params.workerId, request.body);
        sendSuccess(reply, {
          code: 'controller.workers.heartbeat_received',
          message: '心跳接收成功',
          data: {
            success: true,
            serverTime: new Date(),
            worker: record,
          },
        });
      },
    );

    app.get<{ Params: { workerId: string } }>('/:workerId/pull', async (request, reply) => {
      const response = dispatchService.pullTask(request.params.workerId);
      sendSuccess(reply, {
        code: 'controller.workers.task_pulled',
        message: response.hasTask ? '任务拉取成功' : '当前无可用任务',
        data: response,
      });
    });

    app.post<{ Params: { workerId: string }; Body: WorkerSubmitResultRequest }>(
      '/:workerId/result',
      async (request, reply) => {
        dispatchService.submitResult(request.params.workerId, request.body);
        sendSuccess(reply, {
          code: 'controller.workers.result_submitted',
          message: '任务结果提交成功',
          data: {
            success: true,
            taskId: request.body.taskId,
          },
        });
      },
    );

    app.get('/', async (_request, reply) => {
      const workers = workerRegistry.getAllWorkers();
      sendSuccess(reply, {
        code: 'controller.workers.list_fetched',
        message: 'Worker 列表查询成功',
        data: { workers, total: workers.length },
      });
    });

    app.get<{ Params: { workerId: string } }>('/:workerId', async (request, reply) => {
      const worker = workerRegistry.getWorker(request.params.workerId);
      if (!worker) {
        return reply.status(404).send({
          success: false,
          code: 'controller.workers.not_found',
          message: `Worker ${request.params.workerId} 未找到`,
        });
      }
      sendSuccess(reply, {
        code: 'controller.workers.detail_fetched',
        message: 'Worker 详情查询成功',
        data: worker,
      });
    });
  };
}
