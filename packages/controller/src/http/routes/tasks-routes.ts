import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import type { ControllerApiService, OpenClawTaskRequest } from '../services/controller-api-service';
import { sendSuccess } from '../types/api-response';

interface IngestTaskBody {
  text: string;
}

interface CancelTaskBody {
  operator?: string;
  comment?: string;
  force?: boolean;
}

interface TasksQueryParams {
  page?: string;
  pageSize?: string;
  status?: string;
  projectKey?: string;
  startDate?: string;
  endDate?: string;
}

export function buildTasksRoutes(apiService: ControllerApiService): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.get<{ Querystring: TasksQueryParams }>('/', async (request, reply) => {
      const { page = '1', pageSize = '20', status, projectKey, startDate, endDate } = request.query;
      
      const pageNum = parseInt(page, 10);
      const pageSizeNum = parseInt(pageSize, 10);
      const offset = (pageNum - 1) * pageSizeNum;

      // 使用数据库级分页
      const result = apiService.listTasksPaginated({
        status,
        projectKey,
        startDate,
        endDate,
        limit: pageSizeNum,
        offset,
      });

      const totalPages = Math.ceil(result.total / pageSizeNum);

      sendSuccess(reply, {
        code: 'controller.tasks.list_fetched',
        message: '任务列表查询成功',
        data: {
          tasks: result.tasks,
          pagination: {
            page: pageNum,
            pageSize: pageSizeNum,
            total: result.total,
            totalPages,
            hasMore: pageNum < totalPages,
          },
        },
      });
    });

    app.post<{ Body: IngestTaskBody }>('/', async (request, reply) => {
      const result = await apiService.ingestTaskText(request.body.text);
      sendSuccess(reply, {
        statusCode: 201,
        code: 'controller.tasks.ingested',
        message: '任务草稿与提示草稿已生成，等待确认',
        data: result,
      });
    });

    app.post<{ Body: OpenClawTaskRequest }>('/from-openclaw', async (request, reply) => {
      const result = await apiService.handleOpenClawRequest(request.body);
      sendSuccess(reply, result);
    });

    app.get<{ Params: { taskId: string } }>('/:taskId/status', async (request, reply) => {
      const status = apiService.getTaskStatus(request.params.taskId);
      sendSuccess(reply, {
        code: 'controller.tasks.status_fetched',
        message: '任务状态查询成功',
        data: status,
      });
    });

    app.get<{ Params: { taskId: string } }>('/:taskId', async (request, reply) => {
      const detail = apiService.getTaskDetail(request.params.taskId);
      sendSuccess(reply, {
        code: 'controller.tasks.detail_fetched',
        message: '任务详情查询成功',
        data: detail,
      });
    });

    // 取消任务
    app.post<{ Params: { taskId: string }; Body: CancelTaskBody }>('/:taskId/cancel', async (request, reply) => {
      const { taskId } = request.params;
      const { operator = 'web-console', comment, force = false } = request.body ?? {};

      const cancelled = apiService.cancelTask(taskId, operator, comment);
      sendSuccess(reply, {
        code: 'controller.tasks.cancelled',
        message: '任务已取消',
        data: {
          taskId: cancelled.taskId,
          status: cancelled.status,
          cancelledAt: new Date().toISOString(),
          nextStageHint: cancelled.nextStageHint,
          force,
        },
      });
    });
  };
}
