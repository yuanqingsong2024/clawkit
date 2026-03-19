import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import type { ControllerApiService, OpenClawTaskRequest } from '../services/controller-api-service';
import { sendSuccess } from '../types/api-response';

interface IngestTaskBody {
  text: string;
}

export function buildTasksRoutes(apiService: ControllerApiService): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.get('/', async (_request, reply) => {
      const result = apiService.listTasks();
      sendSuccess(reply, {
        code: 'controller.tasks.list_fetched',
        message: '任务列表查询成功',
        data: result,
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
