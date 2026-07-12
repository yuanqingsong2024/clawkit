import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import type { ControllerApiService, OpenClawTaskRequest } from '../services/controller-api-service';
import { sendSuccess } from '../types/api-response';

interface IngestTaskBody {
  text: string;
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
      
      let allTasks = apiService.listTasks().tasks;
      
      if (status) {
        allTasks = allTasks.filter(task => task.status === status);
      }
      
      if (projectKey) {
        allTasks = allTasks.filter(task => task.projectKey === projectKey);
      }
      
      if (startDate) {
        const start = new Date(startDate);
        allTasks = allTasks.filter(task => new Date(task.createdAt) >= start);
      }
      
      if (endDate) {
        const end = new Date(endDate);
        allTasks = allTasks.filter(task => new Date(task.createdAt) <= end);
      }
      
      const total = allTasks.length;
      const totalPages = Math.ceil(total / pageSizeNum);
      const startIndex = (pageNum - 1) * pageSizeNum;
      const endIndex = startIndex + pageSizeNum;
      const paginatedTasks = allTasks.slice(startIndex, endIndex);
      
      sendSuccess(reply, {
        code: 'controller.tasks.list_fetched',
        message: '任务列表查询成功',
        data: {
          tasks: paginatedTasks,
          pagination: {
            page: pageNum,
            pageSize: pageSizeNum,
            total,
            totalPages,
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
  };
}
