import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import type { ControllerApiService } from '../services/controller-api-service';
import { sendSuccess } from '../types/api-response';

export function buildDraftsRoutes(apiService: ControllerApiService): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.get<{ Params: { taskId: string } }>('/:taskId/latest', async (request, reply) => {
      const draft = apiService.getLatestDraft(request.params.taskId);
      sendSuccess(reply, {
        code: 'controller.drafts.latest_fetched',
        message: '草稿查询成功',
        data: draft,
      });
    });

    app.post<{ Params: { taskId: string }; Body: { operator: string; revisionText: string } }>(
      '/:taskId/revise',
      async (request, reply) => {
        const result = await apiService.reviseDraft(
          request.params.taskId,
          request.body.operator,
          request.body.revisionText,
        );
        sendSuccess(reply, {
          code: 'controller.drafts.revised',
          message: '草稿修改成功，已生成新版本并重新进入待确认',
          data: result,
        });
      },
    );

    app.get<{ Params: { taskId: string } }>('/:taskId/history', async (request, reply) => {
      const history = apiService.getDraftHistory(request.params.taskId);
      sendSuccess(reply, {
        code: 'controller.drafts.history_fetched',
        message: '草稿历史查询成功',
        data: history,
      });
    });
  };
}
