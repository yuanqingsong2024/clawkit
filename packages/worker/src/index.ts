import { createLogger } from '@clawkit/shared';

import { Worker } from './worker';

const logger = createLogger('worker');

export { Worker } from './worker';
export { loadWorkerConfig } from './config';
export type { WorkerConfig, WorkerOpenCodeConfig, WorkerOpenCodeServerConfig } from './config';
export { PlaceholderExecutor } from './executors/placeholder-executor';
export { OpenCodeExecutor } from './executors/open-code-executor';
export { OpenCodeClient } from './services/open-code-client';
export { ProjectContextReader } from './services/project-context-reader';
export { WorkerPromptCompiler } from './services/worker-prompt-compiler';
export { ExecutionResultNormalizer } from './services/execution-result-normalizer';
export { SecurityBoundaryBuilder } from './services/security-boundary-builder';

if (require.main === module) {
  const worker = new Worker();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('收到关闭信号', { signal });
    await worker.stop();
    process.exit(0);
  };

  process.once('SIGINT', () => {
    shutdown('SIGINT').catch((error: unknown) => {
      logger.error('停止失败', error);
      process.exit(1);
    });
  });

  process.once('SIGTERM', () => {
    shutdown('SIGTERM').catch((error: unknown) => {
      logger.error('停止失败', error);
      process.exit(1);
    });
  });

  worker.start().catch((error: unknown) => {
    logger.error('启动失败', error);
    process.exit(1);
  });
}
