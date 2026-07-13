/**
 * Pipeline API 路由
 * 提供流水线管理的 REST API 接口
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { PipelineService } from '../../services/pipeline-service';
import { sendSuccess, sendFailure } from '../types/api-response';
import type { PipelineStage } from '@clawkit/pipeline';

/**
 * 创建 Pipeline 路由
 */
export function createPipelineRoutes(
  pipelineService: PipelineService,
): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    /**
     * 列出所有流水线
     * GET /api/pipelines
     */
    app.get('/', async (_request, reply) => {
      try {
        const pipelines = await pipelineService.list();
        sendSuccess(reply, {
          code: 'pipelines.list.fetched',
          message: '流水线列表获取成功',
          data: pipelines,
        });
      } catch (error) {
        sendFailure(reply, {
          code: 'pipelines.list.error',
          message: '获取流水线列表失败',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    /**
     * 获取流水线详情
     * GET /api/pipelines/:id
     */
    app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
      try {
        const pipeline = await pipelineService.get(request.params.id);
        if (!pipeline) {
          sendFailure(reply, {
            code: 'pipelines.not.found',
            message: '流水线不存在',
            statusCode: 404,
            details: null,
          });
          return;
        }
        sendSuccess(reply, {
          code: 'pipelines.get.fetched',
          message: '流水线详情获取成功',
          data: pipeline,
        });
      } catch (error) {
        sendFailure(reply, {
          code: 'pipelines.get.error',
          message: '获取流水线详情失败',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    /**
     * 创建流水线
     * POST /api/pipelines
     */
    app.post<{
      Body: {
        name: string;
        stages?: PipelineStage[];
        description?: string;
      };
    }>('/', async (request, reply) => {
      try {
        const { name, stages, description } = request.body;
        if (!name) {
          sendFailure(reply, {
            code: 'pipelines.create.validation',
            message: '流水线名称不能为空',
            statusCode: 400,
            details: null,
          });
          return;
        }
        const pipeline = await pipelineService.create(name, stages || [], { description });
        sendSuccess(reply, {
          code: 'pipelines.create.created',
          message: '流水线创建成功',
          data: pipeline,
        });
        reply.status(201);
      } catch (error) {
        sendFailure(reply, {
          code: 'pipelines.create.error',
          message: '创建流水线失败',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    /**
     * 更新流水线
     * PUT /api/pipelines/:id
     */
    app.put<{
      Params: { id: string };
      Body: Partial<{
        name: string;
        stages: PipelineStage[];
        description: string;
      }>;
    }>('/:id', async (request, reply) => {
      try {
        const { id } = request.params;
        const pipeline = await pipelineService.update(id, request.body);
        if (!pipeline) {
          sendFailure(reply, {
            code: 'pipelines.not.found',
            message: '流水线不存在',
            statusCode: 404,
            details: null,
          });
          return;
        }
        sendSuccess(reply, {
          code: 'pipelines.update.updated',
          message: '流水线更新成功',
          data: pipeline,
        });
      } catch (error) {
        sendFailure(reply, {
          code: 'pipelines.update.error',
          message: '更新流水线失败',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    /**
     * 删除流水线
     * DELETE /api/pipelines/:id
     */
    app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
      try {
        const { id } = request.params;
        const deleted = await pipelineService.delete(id);
        if (!deleted) {
          sendFailure(reply, {
            code: 'pipelines.not.found',
            message: '流水线不存在',
            statusCode: 404,
            details: null,
          });
          return;
        }
        sendSuccess(reply, {
          code: 'pipelines.delete.deleted',
          message: '流水线删除成功',
          data: { id },
        });
      } catch (error) {
        sendFailure(reply, {
          code: 'pipelines.delete.error',
          message: '删除流水线失败',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    /**
     * 验证流水线
     * POST /api/pipelines/:id/validate
     */
    app.post<{ Params: { id: string } }>('/:id/validate', async (request, reply) => {
      try {
        const { id } = request.params;
        const pipeline = await pipelineService.get(id);
        if (!pipeline) {
          sendFailure(reply, {
            code: 'pipelines.not.found',
            message: '流水线不存在',
            statusCode: 404,
            details: null,
          });
          return;
        }
        const result = pipelineService.validate(pipeline);
        sendSuccess(reply, {
          code: 'pipelines.validate.validated',
          message: result.valid ? '流水线配置有效' : '流水线配置无效',
          data: result,
        });
      } catch (error) {
        sendFailure(reply, {
          code: 'pipelines.validate.error',
          message: '验证流水线失败',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    /**
     * 执行流水线
     * POST /api/pipelines/:id/execute
     */
    app.post<{
      Params: { id: string };
      Body: { triggerType?: string };
    }>('/:id/execute', async (request, reply) => {
      try {
        const { id } = request.params;
        const { triggerType } = request.body || {};
        const execution = await pipelineService.execute(id, triggerType);
        sendSuccess(reply, {
          code: 'pipelines.execute.started',
          message: '流水线执行已启动',
          data: execution,
        });
        reply.status(202);
      } catch (error) {
        sendFailure(reply, {
          code: 'pipelines.execute.error',
          message: '执行流水线失败',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    /**
     * 获取执行历史
     * GET /api/pipelines/:id/executions
     */
    app.get<{ Params: { id: string } }>('/:id/executions', async (request, reply) => {
      try {
        const { id } = request.params;
        const executions = await pipelineService.getExecutionHistory(id);
        sendSuccess(reply, {
          code: 'pipelines.executions.fetched',
          message: '执行历史获取成功',
          data: executions,
        });
      } catch (error) {
        sendFailure(reply, {
          code: 'pipelines.executions.error',
          message: '获取执行历史失败',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    /**
     * 获取执行详情
     * GET /api/pipelines/executions/:executionId
     */
    app.get<{ Params: { executionId: string } }>(
      '/executions/:executionId',
      async (request, reply) => {
        try {
          const { executionId } = request.params;
          const execution = await pipelineService.getExecution(executionId);
          if (!execution) {
            sendFailure(reply, {
              code: 'pipelines.executions.not.found',
              message: '执行记录不存在',
              statusCode: 404,
              details: null,
            });
            return;
          }
          sendSuccess(reply, {
            code: 'pipelines.executions.get',
            message: '执行详情获取成功',
            data: execution,
          });
        } catch (error) {
          sendFailure(reply, {
            code: 'pipelines.executions.error',
            message: '获取执行详情失败',
            details: error instanceof Error ? error.message : String(error),
          });
        }
      }
    );

    /**
     * 取消执行
     * POST /api/pipelines/executions/:executionId/cancel
     */
    app.post<{ Params: { executionId: string } }>(
      '/executions/:executionId/cancel',
      async (request, reply) => {
        try {
          const { executionId } = request.params;
          const cancelled = await pipelineService.cancelExecution(executionId);
          if (!cancelled) {
            sendFailure(reply, {
              code: 'pipelines.executions.not.found',
              message: '执行记录不存在或未在运行',
              statusCode: 404,
              details: null,
            });
            return;
          }
          sendSuccess(reply, {
            code: 'pipelines.executions.cancelled',
            message: '执行已取消',
            data: { executionId },
          });
        } catch (error) {
          sendFailure(reply, {
            code: 'pipelines.executions.cancel.error',
            message: '取消执行失败',
            details: error instanceof Error ? error.message : String(error),
          });
        }
      }
    );

    /**
     * 获取统计信息
     * GET /api/pipelines/stats
     */
    app.get('/stats', async (_request, reply) => {
      try {
        const stats = pipelineService.getStats();
        sendSuccess(reply, {
          code: 'pipelines.stats.fetched',
          message: '统计信息获取成功',
          data: stats,
        });
      } catch (error) {
        sendFailure(reply, {
          code: 'pipelines.stats.error',
          message: '获取统计信息失败',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });
  };
}
