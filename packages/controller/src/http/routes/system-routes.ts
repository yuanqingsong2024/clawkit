import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import type { WebConsoleService } from '../services/web-console-service';
import { sendSuccess } from '../types/api-response';

interface ApplyBody {
  dryRun?: boolean;
  onlyLocal?: boolean;
  confirmExecution?: boolean;
}

interface HealBody {
  dryRun?: boolean;
  confirmExecution?: boolean;
}

export function buildSystemRoutes(webConsoleService: WebConsoleService): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.post('/doctor', async (_request, reply) => {
      const result = await webConsoleService.runDoctor();
      sendSuccess(reply, {
        code: 'controller.system.doctor_completed',
        message: 'Doctor 执行完成',
        data: result,
      });
    });

    app.post('/plan', async (_request, reply) => {
      const result = webConsoleService.runPlan();
      sendSuccess(reply, {
        code: 'controller.system.plan_completed',
        message: 'Plan 执行完成',
        data: result,
      });
    });

    app.post<{ Body: ApplyBody }>('/apply', async (request, reply) => {
      const result = await webConsoleService.runApply(request.body ?? {});
      sendSuccess(reply, {
        code: 'controller.system.apply_completed',
        message: 'Apply 执行完成',
        data: result,
      });
    });

    app.post<{ Body: HealBody }>('/heal', async (request, reply) => {
      const result = await webConsoleService.runHeal(request.body ?? {});
      sendSuccess(reply, {
        code: 'controller.system.heal_completed',
        message: 'Heal 执行完成',
        data: result,
      });
    });
  };
}
