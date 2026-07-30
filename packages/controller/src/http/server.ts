import fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { registerWebConsoleStatic } from './register-web-console-static';
import { registerErrorHandler } from './errors/error-handler';
import { registerApiRoutes } from './routes';
import { ServiceContainer } from './services/service-container';
import { registerRuntimeAuth } from './auth/runtime-auth';
import { initializeWebSocketLogService } from './services/websocket-log.service';

export interface BuildHttpServerOptions {
  fastifyOptions?: FastifyServerOptions;
  container?: ServiceContainer;
}

export async function buildHttpServer(options: BuildHttpServerOptions = {}): Promise<FastifyInstance> {
  const app = fastify(options.fastifyOptions ?? { logger: true });
  const container = options.container ?? new ServiceContainer();

  registerErrorHandler(app);
  registerRuntimeAuth(app);
  await registerApiRoutes(app, container);
  await registerWebConsoleStatic(app);

  // 初始化 WebSocket 实时日志服务
  await initializeWebSocketLogService(app);

  return app;
}
