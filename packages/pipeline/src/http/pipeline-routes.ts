/**
 * Pipeline 路由定义
 * 用于将 Pipeline 服务挂载到 Web 服务器
 */

import type { PipelineService } from '../services/pipeline.service';
import type { PipelineStage, PipelineTrigger, PipelineVariable, PipelineConfig, Pipeline } from '../models';

/**
 * HTTP 请求（泛型版本）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HttpRequest<P = any, Q = any, B = any> = {
  params: P;
  query: Q;
  body: B;
};

/**
 * HTTP 响应
 */
export interface HttpResponse {
  success(code: number, data?: unknown): this;
  json(data: unknown): this;
}

/**
 * 路由处理器
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RequestHandler<P = any, Q = any, B = any> = (
  req: HttpRequest<P, Q, B>,
  res: HttpResponse
) => Promise<void> | void;

/**
 * 路由信息
 */
export interface PipelineRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: RequestHandler;
}

/**
 * 创建流水线路由
 */
export function createPipelineRoutes(service: PipelineService): PipelineRoute[] {
  return [
    // 列出所有流水线
    {
      method: 'GET',
      path: '/pipelines',
      handler: async (_req, res) => {
        try {
          const pipelines = await service.list();
          res.success(200, { pipelines });
        } catch (error) {
          res.success(500, {
            error: error instanceof Error ? error.message : '获取流水线列表失败',
          });
        }
      },
    },

    // 创建流水线
    {
      method: 'POST',
      path: '/pipelines',
      handler: async (req, res) => {
        try {
          const body = req.body as {
            name: string;
            stages?: PipelineStage[];
            triggers?: PipelineTrigger[];
            variables?: PipelineVariable[];
            config?: PipelineConfig;
          };

          if (!body.name) {
            res.success(400, { error: '流水线名称不能为空' });
            return;
          }

          const pipeline = await service.create(body.name, body.stages || [], {
            triggers: body.triggers,
            variables: body.variables,
            config: body.config,
          });
          res.success(201, { pipeline });
        } catch (error) {
          res.success(400, {
            error: error instanceof Error ? error.message : '创建流水线失败',
          });
        }
      },
    },

    // 获取流水线详情
    {
      method: 'GET',
      path: '/pipelines/:id',
      handler: async (req, res) => {
        try {
          const { id } = req.params as { id: string };
          const pipeline = await service.get(id);

          if (!pipeline) {
            res.success(404, { error: `流水线 ${id} 不存在` });
            return;
          }

          res.success(200, { pipeline });
        } catch (error) {
          res.success(500, {
            error: error instanceof Error ? error.message : '获取流水线详情失败',
          });
        }
      },
    },

    // 更新流水线
    {
      method: 'PUT',
      path: '/pipelines/:id',
      handler: async (req, res) => {
        try {
          const { id } = req.params as { id: string };
          const updates = req.body as Partial<Pipeline>;
          const pipeline = await service.update(id, updates);

          if (!pipeline) {
            res.success(404, { error: `流水线 ${id} 不存在` });
            return;
          }

          res.success(200, { pipeline });
        } catch (error) {
          res.success(400, {
            error: error instanceof Error ? error.message : '更新流水线失败',
          });
        }
      },
    },

    // 删除流水线
    {
      method: 'DELETE',
      path: '/pipelines/:id',
      handler: async (req, res) => {
        try {
          const { id } = req.params as { id: string };
          const deleted = await service.delete(id);

          if (!deleted) {
            res.success(404, { error: `流水线 ${id} 不存在` });
            return;
          }

          res.success(200, { deleted: true });
        } catch (error) {
          res.success(400, {
            error: error instanceof Error ? error.message : '删除流水线失败',
          });
        }
      },
    },

    // 验证流水线
    {
      method: 'POST',
      path: '/pipelines/:id/validate',
      handler: async (req, res) => {
        try {
          const { id } = req.params as { id: string };
          const pipeline = await service.get(id);

          if (!pipeline) {
            res.success(404, { error: `流水线 ${id} 不存在` });
            return;
          }

          const result = service.validate(pipeline);
          res.success(200, result);
        } catch (error) {
          res.success(400, {
            error: error instanceof Error ? error.message : '验证流水线失败',
          });
        }
      },
    },

    // 执行流水线
    {
      method: 'POST',
      path: '/pipelines/:id/execute',
      handler: async (req, res) => {
        try {
          const { id } = req.params as { id: string };
          const { triggerType } = (req.body || {}) as { triggerType?: string };
          const execution = await service.execute(id, triggerType);
          res.success(202, { execution });
        } catch (error) {
          res.success(400, {
            error: error instanceof Error ? error.message : '执行流水线失败',
          });
        }
      },
    },

    // 获取执行历史
    {
      method: 'GET',
      path: '/pipelines/:id/executions',
      handler: async (req, res) => {
        try {
          const { id } = req.params as { id: string };
          const executions = await service.getExecutionHistory(id);
          res.success(200, { executions });
        } catch (error) {
          res.success(500, {
            error: error instanceof Error ? error.message : '获取执行历史失败',
          });
        }
      },
    },

    // 获取执行详情
    {
      method: 'GET',
      path: '/pipelines/executions/:executionId',
      handler: async (req, res) => {
        try {
          const { executionId } = req.params as { executionId: string };
          const execution = await service.getExecution(executionId);

          if (!execution) {
            res.success(404, { error: `执行记录 ${executionId} 不存在` });
            return;
          }

          res.success(200, { execution });
        } catch (error) {
          res.success(500, {
            error: error instanceof Error ? error.message : '获取执行详情失败',
          });
        }
      },
    },

    // 取消执行
    {
      method: 'POST',
      path: '/pipelines/executions/:executionId/cancel',
      handler: async (req, res) => {
        try {
          const { executionId } = req.params as { executionId: string };
          const cancelled = await service.cancelExecution(executionId);

          if (!cancelled) {
            res.success(404, { error: `执行 ${executionId} 不存在或未在运行` });
            return;
          }

          res.success(200, { cancelled: true });
        } catch (error) {
          res.success(400, {
            error: error instanceof Error ? error.message : '取消执行失败',
          });
        }
      },
    },

    // 获取统计信息
    {
      method: 'GET',
      path: '/pipelines/stats',
      handler: async (_req, res) => {
        try {
          const stats = service.getStats();
          res.success(200, { stats });
        } catch (error) {
          res.success(500, {
            error: error instanceof Error ? error.message : '获取统计信息失败',
          });
        }
      },
    },
  ];
}
