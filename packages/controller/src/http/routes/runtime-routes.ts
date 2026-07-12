import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { sendFailure, sendSuccess } from '../types/api-response';
import type { RuntimeService } from '../services/runtime-service';

export function buildRuntimeRoutes(runtimeService: RuntimeService): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/health', async (_request, reply) => {
      sendSuccess(reply, {
        code: 'controller.runtime.health_ok',
        message: 'Runtime 健康检查成功',
        data: runtimeService.buildHealth(),
      });
    });

    app.get('/status', async (_request, reply) => {
      sendSuccess(reply, {
        code: 'controller.runtime.status_ok',
        message: 'Runtime 状态查询成功',
        data: runtimeService.buildStatus(),
      });
    });

    app.get('/version', async (_request, reply) => {
      sendSuccess(reply, {
        code: 'controller.runtime.version_ok',
        message: 'Runtime 版本查询成功',
        data: runtimeService.buildVersion(),
      });
    });

    app.get('/capabilities', async (_request, reply) => {
      sendSuccess(reply, {
        code: 'controller.runtime.capabilities_ok',
        message: 'Runtime 能力查询成功',
        data: runtimeService.buildCapabilities(),
      });
    });

    app.get('/workers', async (_request, reply) => {
      sendSuccess(reply, {
        code: 'controller.runtime.workers_ok',
        message: 'Worker 列表查询成功',
        data: runtimeService.listWorkers(),
      });
    });

    app.get('/workers/status', async (_request, reply) => {
      sendSuccess(reply, {
        code: 'controller.runtime.workers_status_ok',
        message: 'Worker 状态查询成功',
        data: runtimeService.listWorkers(),
      });
    });

    app.post<{ Body: Parameters<RuntimeService['createTaskDraft']>[0] }>('/task-drafts', async (request, reply) => {
      sendSuccess(reply, {
        statusCode: 201,
        code: 'controller.runtime.task_draft_created',
        message: 'TaskDraft 创建成功',
        data: runtimeService.createTaskDraft(request.body),
      });
    });

    app.post<{ Body: Parameters<RuntimeService['dryRun']>[0] }>('/dispatch/dry-run', async (request, reply) => {
      sendSuccess(reply, {
        code: 'controller.runtime.dispatch_dry_run_ok',
        message: 'Dispatch dry-run 成功',
        data: runtimeService.dryRun(request.body),
      });
    });

    app.post<{ Body: Parameters<RuntimeService['dispatch']>[0] }>('/dispatch', async (request, reply) => {
      sendSuccess(reply, {
        statusCode: 201,
        code: 'controller.runtime.dispatch_created',
        message: 'Sandbox Dispatch 成功',
        data: runtimeService.dispatch(request.body),
      });
    });

    app.post<{ Body: Parameters<RuntimeService['dispatch']>[0] }>('/dispatches', async (request, reply) => {
      sendSuccess(reply, {
        statusCode: 201,
        code: 'controller.runtime.dispatch_created',
        message: 'Sandbox Dispatch 成功',
        data: runtimeService.dispatch(request.body),
      });
    });

    app.get<{ Params: { id: string } }>('/dispatch/:id/status', async (request, reply) => {
      sendSuccess(reply, {
        code: 'controller.runtime.dispatch_status_ok',
        message: 'Dispatch 状态查询成功',
        data: runtimeService.getDispatchStatus(request.params.id),
      });
    });

    app.get<{ Params: { id: string } }>('/dispatches/:id/status', async (request, reply) => {
      sendSuccess(reply, {
        code: 'controller.runtime.dispatch_status_ok',
        message: 'Dispatch 状态查询成功',
        data: runtimeService.getDispatchStatus(request.params.id),
      });
    });

    app.get<{ Params: { id: string } }>('/dispatch/:id', async (request, reply) => {
      sendSuccess(reply, {
        code: 'controller.runtime.dispatch_status_ok',
        message: 'Dispatch 查询成功',
        data: runtimeService.getDispatchStatus(request.params.id),
      });
    });

    app.get<{ Params: { id: string } }>('/dispatches/:id', async (request, reply) => {
      sendSuccess(reply, {
        code: 'controller.runtime.dispatch_status_ok',
        message: 'Dispatch 查询成功',
        data: runtimeService.getDispatchStatus(request.params.id),
      });
    });

    app.get<{ Params: { id: string } }>('/dispatch/:id/result', async (request, reply) => {
      const result = runtimeService.getWorkerResultResponse(request.params.id);
      if (!result.success) {
        return reply.status(409).send(result);
      }

      sendSuccess(reply, {
        code: 'controller.runtime.dispatch_result_ok',
        message: 'Worker 结果查询成功',
        data: result.data,
      });
    });

    app.get<{ Params: { id: string } }>('/dispatches/:id/result', async (request, reply) => {
      const result = runtimeService.getWorkerResultResponse(request.params.id);
      if (!result.success) {
        return reply.status(409).send(result);
      }

      sendSuccess(reply, {
        code: 'controller.runtime.dispatch_result_ok',
        message: 'Worker 结果查询成功',
        data: result.data,
      });
    });

    app.get<{ Params: { workerId: string }; Querystring: { dispatchId?: string } }>('/workers/:workerId/result', async (request, reply) => {
      const dispatchId = request.query.dispatchId?.trim();
      if (!dispatchId) {
        return reply.status(400).send({ success: false, code: 'controller.invalid_request', message: '必须提供 dispatchId', details: null });
      }

      const result = runtimeService.getWorkerResultResponse(dispatchId);
      if (!result.success) {
        return reply.status(409).send(result);
      }

      if (result.data.workerId !== request.params.workerId) {
        return reply.status(404).send({ success: false, code: 'controller.worker_not_found', message: 'Worker 与 dispatch 不匹配', details: null });
      }

      sendSuccess(reply, {
        code: 'controller.runtime.dispatch_result_ok',
        message: 'Worker 结果查询成功',
        data: result.data,
      });
    });

    app.post<{ Params: { id: string }; Body: { requestId?: string; reason?: string } }>('/dispatch/:id/cancel', async (_request, reply) => {
      sendFailure(reply, {
        statusCode: 501,
        code: 'controller.cancel_unsupported',
        message: '当前版本仅保留取消接口契约，尚未实现 sandbox dispatch 取消',
        details: null,
      });
    });

    app.post<{ Params: { id: string }; Body: { requestId?: string; reason?: string } }>('/dispatches/:id/cancel', async (_request, reply) => {
      sendFailure(reply, {
        statusCode: 501,
        code: 'controller.cancel_unsupported',
        message: '当前版本仅保留取消接口契约，尚未实现 sandbox dispatch 取消',
        details: null,
      });
    });
  };
}
