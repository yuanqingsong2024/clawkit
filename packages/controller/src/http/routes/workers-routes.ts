import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import type {
  WorkerRegisterRequest,
  WorkerHeartbeatRequest,
  WorkerSubmitResultRequest,
} from '@clawkit/shared';

import type { DispatchService } from '../../services/dispatch-service';
import type { WorkerRegistry } from '../../services/worker-registry';
import { HttpError } from '../errors/http-error';
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
        let record;
        try {
          record = workerRegistry.heartbeat(request.params.workerId, request.body);
        } catch (error) {
          if (error instanceof Error && error.message.includes('controller.worker_not_found')) {
            throw new HttpError({
              statusCode: 404,
              errorCode: 'controller.worker_not_found',
              message: error.message,
              details: { workerId: request.params.workerId },
            });
          }

          throw error;
        }

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

    // SSE 任务推送端点
    app.get<{ Params: { workerId: string } }>('/:workerId/task-stream', async (request, reply) => {
      const workerId = request.params.workerId;
      
      // 验证 Worker 是否存在
      const worker = workerRegistry.getWorker(workerId);
      if (!worker) {
        return reply.status(404).send({
          success: false,
          code: 'controller.workers.not_found',
          message: `Worker ${workerId} 未找到`,
        });
      }

      // 设置 SSE 响应头
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // 发送初始连接成功消息
      reply.raw.write(`data: ${JSON.stringify({ type: 'connected', workerId })}\n\n`);

      // 注册任务通知监听器
      const listener = (notifiedWorkerId: string) => {
        if (notifiedWorkerId === workerId) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'task-available' })}\n\n`);
        }
      };
      dispatchService.onTaskAvailable(listener);

      // 定期发送心跳保持连接
      const heartbeatInterval = setInterval(() => {
        reply.raw.write(`: heartbeat\n\n`);
      }, 30000); // 每 30 秒发送一次心跳

      // 连接关闭时清理
      request.raw.on('close', () => {
        clearInterval(heartbeatInterval);
        dispatchService.offTaskAvailable(listener);
      });
    });
  };
}
