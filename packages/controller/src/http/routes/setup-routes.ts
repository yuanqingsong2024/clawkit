import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import type { SetupOrchestrator } from '../services/setup-orchestrator';
import type { QuickSetupProfile } from '../types/quick-setup';
import { sendSuccess } from '../types/api-response';
import { EnvironmentCheckService } from '../services/environment-check-service';
import { ModelCatalogService, type ListModelsInput } from '../services/model-catalog-service';
import { OpenClawDeployService } from '../services/openclaw-deploy.service';
import { OpenCodeInstallService } from '../services/opencode-install.service';

interface SetupPreviewBody {
  formData: Record<string, unknown>;
}

interface StartSetupRunBody {
  topology?: string;
  formData: Record<string, unknown>;
}

interface CompileQuickProfileBody {
  profile: QuickSetupProfile;
}

interface ListModelsBody extends ListModelsInput {}

export function buildSetupRoutes(setupOrchestrator: SetupOrchestrator): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    const modelCatalogService = new ModelCatalogService();
    const environmentCheckService = new EnvironmentCheckService();

    app.get('/schema', async (_request, reply) => {
      sendSuccess(reply, {
        code: 'controller.setup.schema_fetched',
        message: 'Setup 向导字段说明查询成功',
        data: setupOrchestrator.getSchema(),
      });
    });

    app.get('/defaults', async (_request, reply) => {
      sendSuccess(reply, {
        code: 'controller.setup.defaults_fetched',
        message: 'Setup 默认配置建议查询成功',
        data: setupOrchestrator.getDefaults(),
      });
    });

    app.get('/check-environment', async (_request, reply) => {
      sendSuccess(reply, {
        code: 'controller.setup.environment_checked',
        message: '环境快速检查完成',
        data: await environmentCheckService.checkEnvironment(),
      });
    });

    app.post<{ Body: SetupPreviewBody }>('/manifest/preview', async (request, reply) => {
      sendSuccess(reply, {
        code: 'controller.setup.preview_generated',
        message: 'Manifest 预览生成成功',
        data: setupOrchestrator.previewManifest(request.body.formData),
      });
    });

    app.post<{ Body: CompileQuickProfileBody }>('/quick-profile/compile', async (request, reply) => {
      sendSuccess(reply, {
        code: 'controller.setup.quick_profile_compiled',
        message: 'Quick Setup 配置编译成功',
        data: setupOrchestrator.compileQuickProfile(request.body.profile),
      });
    });

    app.post<{ Body: ListModelsBody }>('/models/list', async (request, reply) => {
      sendSuccess(reply, {
        code: 'controller.setup.models_fetched',
        message: '模型列表获取成功',
        data: await modelCatalogService.listModels(request.body),
      });
    });

    app.post<{ Body: StartSetupRunBody }>('/runs', async (request, reply) => {
      sendSuccess(reply, {
        statusCode: 201,
        code: 'controller.setup.run_created',
        message: 'Setup run 已启动',
        data: setupOrchestrator.startRun(request.body),
      });
    });

    app.get('/runs', async (_request, reply) => {
      sendSuccess(reply, {
        code: 'controller.setup.runs_fetched',
        message: 'Setup run 历史查询成功',
        data: setupOrchestrator.listRuns(),
      });
    });

    app.get<{ Params: { id: string } }>('/runs/:id', async (request, reply) => {
      sendSuccess(reply, {
        code: 'controller.setup.run_fetched',
        message: 'Setup run 查询成功',
        data: setupOrchestrator.getRun(request.params.id),
      });
    });

    app.post<{ Params: { id: string } }>('/runs/:id/retry', async (request, reply) => {
      sendSuccess(reply, {
        statusCode: 201,
        code: 'controller.setup.run_retried',
        message: 'Setup run 已重新启动',
        data: setupOrchestrator.retryRun(request.params.id),
      });
    });

    app.get<{ Params: { id: string } }>('/runs/:id/stream', async (request, reply) => {
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.flushHeaders?.();

      const unsubscribe = setupOrchestrator.subscribe(request.params.id, (event) => {
        reply.raw.write(`event: ${event.event}\n`);
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      const heartbeat = setInterval(() => {
        reply.raw.write(': keep-alive\n\n');
      }, 15000);

      request.raw.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
        reply.raw.end();
      });
    });

    app.post('/openclaw/deploy/stream', async (request, reply) => {
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.flushHeaders?.();

      const deployService = new OpenClawDeployService();

      deployService.setEventCallback((event) => {
        reply.raw.write(`event: ${event.event}\n`);
        reply.raw.write(`data: ${JSON.stringify(event.data)}\n\n`);
      });

      const heartbeat = setInterval(() => {
        reply.raw.write(': keep-alive\n\n');
      }, 15000);

      request.raw.on('close', () => {
        clearInterval(heartbeat);
        deployService.terminateAllProcesses();
        reply.raw.end();
      });

      deployService.deploy().then(() => {
        clearInterval(heartbeat);
        reply.raw.end();
      }).catch((error) => {
        clearInterval(heartbeat);
        const errorMessage = error instanceof Error ? error.message : String(error);
        reply.raw.write(`event: openclaw.error\n`);
        reply.raw.write(`data: ${JSON.stringify({ error: '部署失败', details: errorMessage })}\n\n`);
        reply.raw.end();
      });
    });

    app.post('/opencode/install/stream', async (request, reply) => {
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.flushHeaders?.();

      const installService = new OpenCodeInstallService();

      installService.setEventCallback((event) => {
        reply.raw.write(`event: ${event.event}\n`);
        reply.raw.write(`data: ${JSON.stringify(event.data)}\n\n`);
      });

      const heartbeat = setInterval(() => {
        reply.raw.write(': keep-alive\n\n');
      }, 15000);

      request.raw.on('close', () => {
        clearInterval(heartbeat);
        installService.terminateAllProcesses();
        reply.raw.end();
      });

      installService.install().then(() => {
        clearInterval(heartbeat);
        reply.raw.end();
      }).catch((error) => {
        clearInterval(heartbeat);
        const errorMessage = error instanceof Error ? error.message : String(error);
        reply.raw.write(`event: opencode.error\n`);
        reply.raw.write(`data: ${JSON.stringify({ error: '安装失败', details: errorMessage })}\n\n`);
        reply.raw.end();
      });
    });
  };
}
