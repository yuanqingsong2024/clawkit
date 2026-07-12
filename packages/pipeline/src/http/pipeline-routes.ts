/**
 * 流水线 HTTP 路由
 * 提供 RESTful API 访问流水线服务
 */

import type { PipelineService } from '../services/pipeline.service';
import type { PipelineDefinition, PipelineExecution } from '../types/pipeline.types';

/**
 * HTTP 请求接口（简化版，不依赖 express）
 */
export interface HttpRequest {
  method: string;
  url: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  headers: Record<string, string>;
}

/**
 * HTTP 响应接口（简化版，不依赖 express）
 */
export interface HttpResponse {
  statusCode: number;
  body: unknown;
  setHeader(name: string, value: string): void;
  json(data: unknown): void;
  status(code: number): HttpResponse;
}

/**
 * 请求处理器类型
 */
export type RequestHandler = (req: HttpRequest, res: HttpResponse) => Promise<void>;

/**
 * 流水线路由选项
 */
export interface PipelineRoutesOptions {
  /** 流水线服务 */
  service: PipelineService;
}

/**
 * 创建流水线路由
 */
export function createPipelineRoutes(options: PipelineRoutesOptions) {
  const { service } = options;

  return {
    /**
     * GET /api/pipelines - 列出所有流水线
     */
    async list(req: HttpRequest, res: HttpResponse): Promise<void> {
      try {
        const projectKey = req.query.projectKey;
        const pipelines = await service.list(projectKey);
        res.json({
          success: true,
          data: pipelines,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : '获取流水线列表失败',
        });
      }
    },

    /**
     * POST /api/pipelines - 创建流水线
     */
    async create(req: HttpRequest, res: HttpResponse): Promise<void> {
      try {
        const definition = req.body as Omit<PipelineDefinition, 'id' | 'createdAt' | 'updatedAt'>;
        const pipeline = await service.create(definition);
        res.status(201).json({
          success: true,
          data: pipeline,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : '创建流水线失败',
        });
      }
    },

    /**
     * GET /api/pipelines/:id - 获取流水线详情
     */
    async get(req: HttpRequest, res: HttpResponse): Promise<void> {
      try {
        const { id } = req.params;
        const pipeline = await service.get(id);

        if (!pipeline) {
          res.status(404).json({
            success: false,
            error: `流水线 ${id} 不存在`,
          });
          return;
        }

        res.json({
          success: true,
          data: pipeline,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : '获取流水线详情失败',
        });
      }
    },

    /**
     * PUT /api/pipelines/:id - 更新流水线
     */
    async update(req: HttpRequest, res: HttpResponse): Promise<void> {
      try {
        const { id } = req.params;
        const updates = req.body as Partial<PipelineDefinition>;
        const pipeline = await service.update(id, updates);
        res.json({
          success: true,
          data: pipeline,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : '更新流水线失败',
        });
      }
    },

    /**
     * DELETE /api/pipelines/:id - 删除流水线
     */
    async delete(req: HttpRequest, res: HttpResponse): Promise<void> {
      try {
        const { id } = req.params;
        const deleted = await service.delete(id);

        if (!deleted) {
          res.status(404).json({
            success: false,
            error: `流水线 ${id} 不存在`,
          });
          return;
        }

        res.json({
          success: true,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : '删除流水线失败',
        });
      }
    },

    /**
     * POST /api/pipelines/:id/validate - 验证流水线
     */
    async validate(req: HttpRequest, res: HttpResponse): Promise<void> {
      try {
        const definition = req.body as PipelineDefinition;
        const result = service.validate(definition);
        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : '验证流水线失败',
        });
      }
    },

    /**
     * POST /api/pipelines/:id/execute - 执行流水线
     */
    async execute(req: HttpRequest, res: HttpResponse): Promise<void> {
      try {
        const { id } = req.params;
        const body = req.body as Record<string, unknown> | undefined;
        const trigger = body?.trigger as PipelineExecution['trigger'] | undefined;
        const variables = body?.variables as Record<string, unknown> | undefined;

        const execution = await service.execute(id, trigger, variables);
        res.status(201).json({
          success: true,
          data: execution,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : '执行流水线失败',
        });
      }
    },

    /**
     * GET /api/pipelines/:id/executions - 获取执行历史
     */
    async getExecutions(req: HttpRequest, res: HttpResponse): Promise<void> {
      try {
        const { id } = req.params;
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
        const executions = await service.getExecutionHistory(id, limit);
        res.json({
          success: true,
          data: executions,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : '获取执行历史失败',
        });
      }
    },

    /**
     * GET /api/pipelines/:id/stats - 获取流水线统计
     */
    async getStats(req: HttpRequest, res: HttpResponse): Promise<void> {
      try {
        const { id } = req.params;
        const stats = await service.getStats(id);
        res.json({
          success: true,
          data: stats,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : '获取统计信息失败',
        });
      }
    },

    /**
     * GET /api/executions/:id - 获取执行详情
     */
    async getExecution(req: HttpRequest, res: HttpResponse): Promise<void> {
      try {
        const { id } = req.params;
        const execution = await service.getExecution(id);

        if (!execution) {
          res.status(404).json({
            success: false,
            error: `执行记录 ${id} 不存在`,
          });
          return;
        }

        res.json({
          success: true,
          data: execution,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : '获取执行详情失败',
        });
      }
    },

    /**
     * POST /api/executions/:id/cancel - 取消执行
     */
    async cancelExecution(req: HttpRequest, res: HttpResponse): Promise<void> {
      try {
        const { id } = req.params;
        const cancelled = await service.cancelExecution(id);

        if (!cancelled) {
          res.status(404).json({
            success: false,
            error: `执行 ${id} 不存在或未在运行`,
          });
          return;
        }

        res.json({
          success: true,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : '取消执行失败',
        });
      }
    },

    /**
     * POST /api/executions/:id/pause - 暂停执行
     */
    async pauseExecution(req: HttpRequest, res: HttpResponse): Promise<void> {
      try {
        const { id } = req.params;
        const paused = await service.pauseExecution(id);

        if (!paused) {
          res.status(404).json({
            success: false,
            error: `执行 ${id} 不存在或未在运行`,
          });
          return;
        }

        res.json({
          success: true,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : '暂停执行失败',
        });
      }
    },

    /**
     * POST /api/executions/:id/resume - 恢复执行
     */
    async resumeExecution(req: HttpRequest, res: HttpResponse): Promise<void> {
      try {
        const { id } = req.params;
        const resumed = await service.resumeExecution(id);

        if (!resumed) {
          res.status(404).json({
            success: false,
            error: `执行 ${id} 不存在或未暂停`,
          });
          return;
        }

        res.json({
          success: true,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : '恢复执行失败',
        });
      }
    },
  };
}

/**
 * 路由定义
 */
export interface Route {
  method: string;
  path: string;
  handler: RequestHandler;
}

/**
 * 获取所有流水线路由
 */
export function getPipelineRoutes(options: PipelineRoutesOptions): Route[] {
  const routes = createPipelineRoutes(options);
  const basePath = '/api/pipelines';

  return [
    { method: 'GET', path: basePath, handler: routes.list },
    { method: 'POST', path: basePath, handler: routes.create },
    { method: 'GET', path: `${basePath}/:id`, handler: routes.get },
    { method: 'PUT', path: `${basePath}/:id`, handler: routes.update },
    { method: 'DELETE', path: `${basePath}/:id`, handler: routes.delete },
    { method: 'POST', path: `${basePath}/:id/validate`, handler: routes.validate },
    { method: 'POST', path: `${basePath}/:id/execute`, handler: routes.execute },
    { method: 'GET', path: `${basePath}/:id/executions`, handler: routes.getExecutions },
    { method: 'GET', path: `${basePath}/:id/stats`, handler: routes.getStats },
    { method: 'GET', path: `${basePath}/executions/:id`, handler: routes.getExecution },
    { method: 'POST', path: `${basePath}/executions/:id/cancel`, handler: routes.cancelExecution },
    { method: 'POST', path: `${basePath}/executions/:id/pause`, handler: routes.pauseExecution },
    { method: 'POST', path: `${basePath}/executions/:id/resume`, handler: routes.resumeExecution },
  ];
}
