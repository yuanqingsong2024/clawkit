import type { FastifyInstance } from 'fastify';

import { createLogger } from '@clawkit/shared';

import { buildHttpServer } from './http/server';
import { loadControllerConfig } from './config';

const logger = createLogger('controller');

export class Controller {
  private app: FastifyInstance | null = null;

  async start(): Promise<void> {
    const config = loadControllerConfig();

    this.app = await buildHttpServer();
    await this.app.listen({ host: config.host, port: config.port });
    logger.info('HTTP 服务已启动', { url: `http://${config.host}:${config.port}` });
  }

  async stop(): Promise<void> {
    if (this.app !== null) {
      await this.app.close();
      this.app = null;
    }
    logger.info('HTTP 服务已停止');
  }
}

if (require.main === module) {
  const controller = new Controller();
  
  // 优雅关闭处理
  const shutdown = async (signal: string) => {
    logger.info('收到关闭信号', { signal });
    try {
      await controller.stop();
      process.exit(0);
    } catch (error) {
      logger.error('关闭服务时出错', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  controller.start().catch((error: unknown) => {
    logger.error('启动失败', error);
    process.exit(1);
  });
}

export type { BuildPromptDraftInput, PromptEngine } from './services/prompt-engine';
export type { TaskDraftService } from './services/task-draft-service';
export { TaskDraftServiceImpl } from './services/task-draft-service';
export type { TaskMemoryService } from './services/task-memory-service';
export { TaskMemoryServiceImpl } from './services/task-memory-service';
export type { PromptCompiler, PromptCompilerInput, CompiledPrompt, OutputContract } from './services/prompt-compiler';
export { PromptCompilerImpl } from './services/prompt-compiler';
export { TemplatePromptEngine } from './services/template-prompt-engine';
export type { PromptDraftService, BuildPromptDraftServiceInput } from './services/prompt-draft-service';
export { PromptDraftServiceImpl } from './services/prompt-draft-service';
export type {
  ControllerFlowService,
  ControllerFlowServiceDependencies,
  CreateDraftFromTextResult,
  GeneratePromptDraftResult,
  ApproveDraftResult,
  ApproveDraftInput,
  ReviseDraftResult,
  ReviseDraftInput,
  CancelTaskResult,
  CancelTaskInput,
  DraftHistoryResult,
  DraftHistoryVersionView,
  TaskStatusSnapshot,
} from './services/controller-flow-service';
export { ControllerFlowServiceImpl } from './services/controller-flow-service';
export * from './models';
export * from './protocol';
export { CONTROLLER_TABLES, CONTROLLER_INDEXES, CONTROLLER_SCHEMA_SQL_FILE } from './persistence/tables';
export { buildHttpServer } from './http/server';
export { ControllerApiService } from './http/services/controller-api-service';
export default Controller;
