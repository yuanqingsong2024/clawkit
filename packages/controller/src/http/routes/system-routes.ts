import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { ServiceContainer } from '../services/service-container';
import type { WebConsoleService } from '../services/web-console-service';
import { sendSuccess, sendFailure } from '../types/api-response';

interface ApplyBody {
  dryRun?: boolean;
  onlyLocal?: boolean;
  confirmExecution?: boolean;
}

interface HealBody {
  dryRun?: boolean;
  confirmExecution?: boolean;
}

const StartOpenCodeBodySchema = z.object({
  projectKey: z.string().min(1, '项目 key 不能为空'),
});

const StartWorkerBodySchema = z.object({
  workerId: z.string().min(1, 'Worker ID 不能为空'),
});

const WorkerLogsQuerySchema = z.object({
  workerId: z.string().min(1, 'Worker ID 不能为空'),
  lines: z.coerce.number().int().min(10).max(500).default(120),
});

const OpenCodeLogsQuerySchema = z.object({
  projectKey: z.string().min(1, '项目 key 不能为空'),
  lines: z.coerce.number().int().min(10).max(500).default(120),
});

export function buildSystemRoutes(serviceContainer: ServiceContainer): FastifyPluginAsync {
  const webConsoleService = serviceContainer.webConsoleService;
  
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

    app.get('/capabilities', async (_request, reply) => {
      sendSuccess(reply, {
        code: 'controller.system.capabilities_fetched',
        message: '系统能力查询成功',
        data: {
          openCodeActionsEnabled: true,
          configHotReloadEnabled: serviceContainer.configReloader !== null,
        },
      });
    });

    // ========== 配置重载 API ==========
    app.post('/config/reload', async (_request, reply) => {
      if (!serviceContainer.configReloader) {
        return sendFailure(reply, {
          statusCode: 400,
          code: 'controller.config.reload_disabled',
          message: '配置热重载未启用（未配置 manifestPath）',
          details: { manifestPath: serviceContainer.manifestManager?.getManifestPath() ?? null },
        });
      }

      try {
        await serviceContainer.configReloader.reload();
        sendSuccess(reply, {
          code: 'controller.config.reloaded',
          message: '配置重载成功',
          data: {
            manifestPath: serviceContainer.manifestManager?.getManifestPath(),
            projectCount: serviceContainer.projectRegistry.getAllProjects().length,
          },
        });
      } catch (error) {
        const err = error as Error;
        return sendFailure(reply, {
          statusCode: 500,
          code: 'controller.config.reload_failed',
          message: `配置重载失败：${err.message}`,
          details: { error: err.message },
        });
      }
    });

    app.get('/config/status', async (_request, reply) => {
      sendSuccess(reply, {
        code: 'controller.config.status_fetched',
        message: '配置状态查询成功',
        data: {
          hotReloadEnabled: serviceContainer.configReloader !== null,
          isWatching: serviceContainer.configReloader?.isWatching() ?? false,
          manifestPath: serviceContainer.manifestManager?.getManifestPath() ?? null,
          projectCount: serviceContainer.projectRegistry.getAllProjects().length,
        },
      });
    });

    // ========== OpenCode/Worker 控制 API ==========
    app.post('/opencode/start', async (request, reply) => {
      const parseResult = StartOpenCodeBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return sendFailure(reply, {
          statusCode: 400,
          code: 'controller.opencode.invalid_request',
          message: '请求参数错误',
          details: parseResult.error.issues,
        });
      }

      try {
        const result = await webConsoleService.startOpenCode(parseResult.data.projectKey);
        sendSuccess(reply, {
          code: 'controller.opencode.start_completed',
          message: result.started ? 'OpenCode 启动命令已执行' : 'OpenCode 启动失败',
          data: result,
        });
      } catch (error) {
        const httpError = error as { statusCode?: number; errorCode?: string; message?: string; details?: unknown };
        return sendFailure(reply, {
          statusCode: httpError.statusCode ?? 500,
          code: httpError.errorCode ?? 'controller.opencode.start_failed',
          message: httpError.message ?? '启动 OpenCode 失败',
          details: httpError.details ?? null,
        });
      }
    });

    app.post('/worker/start', async (request, reply) => {
      const parseResult = StartWorkerBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return sendFailure(reply, {
          statusCode: 400,
          code: 'controller.worker.invalid_request',
          message: '请求参数错误',
          details: parseResult.error.issues,
        });
      }

      try {
        const result = await webConsoleService.startWorker(parseResult.data.workerId);
        sendSuccess(reply, {
          code: 'controller.worker.start_completed',
          message: result.started ? 'Worker 启动命令已执行' : 'Worker 启动失败',
          data: result,
        });
      } catch (error) {
        const httpError = error as { statusCode?: number; errorCode?: string; message?: string; details?: unknown };
        return sendFailure(reply, {
          statusCode: httpError.statusCode ?? 500,
          code: httpError.errorCode ?? 'controller.worker.start_failed',
          message: httpError.message ?? '启动 Worker 失败',
          details: httpError.details ?? null,
        });
      }
    });

    app.post('/worker/restart', async (request, reply) => {
      const parseResult = StartWorkerBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return sendFailure(reply, {
          statusCode: 400,
          code: 'controller.worker.invalid_request',
          message: '请求参数错误',
          details: parseResult.error.issues,
        });
      }

      try {
        const result = await webConsoleService.restartWorker(parseResult.data.workerId);
        sendSuccess(reply, {
          code: 'controller.worker.restart_completed',
          message: result.started ? 'Worker 重启命令已执行' : 'Worker 重启失败',
          data: result,
        });
      } catch (error) {
        const httpError = error as { statusCode?: number; errorCode?: string; message?: string; details?: unknown };
        return sendFailure(reply, {
          statusCode: httpError.statusCode ?? 500,
          code: httpError.errorCode ?? 'controller.worker.restart_failed',
          message: httpError.message ?? '重启 Worker 失败',
          details: httpError.details ?? null,
        });
      }
    });

    app.get('/worker/logs', async (request, reply) => {
      const parseResult = WorkerLogsQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        return sendFailure(reply, {
          statusCode: 400,
          code: 'controller.worker.logs.invalid_request',
          message: '请求参数错误',
          details: parseResult.error.issues,
        });
      }

      try {
        const result = await webConsoleService.getWorkerLogs(parseResult.data.workerId, parseResult.data.lines);
        sendSuccess(reply, {
          code: 'controller.worker.logs_fetched',
          message: 'Worker 日志读取成功',
          data: result,
        });
      } catch (error) {
        const httpError = error as { statusCode?: number; errorCode?: string; message?: string; details?: unknown };
        return sendFailure(reply, {
          statusCode: httpError.statusCode ?? 500,
          code: httpError.errorCode ?? 'controller.worker.logs_failed',
          message: httpError.message ?? '读取 Worker 日志失败',
          details: httpError.details ?? null,
        });
      }
    });

    app.post('/openclaw/start', async (_request, reply) => {
      try {
        const result = await webConsoleService.startOpenClaw();
        sendSuccess(reply, {
          code: 'controller.openclaw.start_completed',
          message: result.started ? 'OpenClaw 启动命令已执行' : 'OpenClaw 启动失败',
          data: result,
        });
      } catch (error) {
        const httpError = error as { statusCode?: number; errorCode?: string; message?: string; details?: unknown };
        return sendFailure(reply, {
          statusCode: httpError.statusCode ?? 500,
          code: httpError.errorCode ?? 'controller.openclaw.start_failed',
          message: httpError.message ?? '启动 OpenClaw 失败',
          details: httpError.details ?? null,
        });
      }
    });

    app.get('/opencode/logs', async (request, reply) => {
      const parseResult = OpenCodeLogsQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        return sendFailure(reply, {
          statusCode: 400,
          code: 'controller.opencode.logs.invalid_request',
          message: '请求参数错误',
          details: parseResult.error.issues,
        });
      }

      try {
        const result = await webConsoleService.getOpenCodeLogs(parseResult.data.projectKey, parseResult.data.lines);
        sendSuccess(reply, {
          code: 'controller.opencode.logs_fetched',
          message: 'OpenCode 日志读取成功',
          data: result,
        });
      } catch (error) {
        const httpError = error as { statusCode?: number; errorCode?: string; message?: string; details?: unknown };
        return sendFailure(reply, {
          statusCode: httpError.statusCode ?? 500,
          code: httpError.errorCode ?? 'controller.opencode.logs_failed',
          message: httpError.message ?? '读取 OpenCode 日志失败',
          details: httpError.details ?? null,
        });
      }
    });
  };
}
