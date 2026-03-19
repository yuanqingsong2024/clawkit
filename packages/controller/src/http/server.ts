import fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { registerWebConsoleStatic } from './register-web-console-static';
import { registerErrorHandler } from './errors/error-handler';
import { registerApiRoutes } from './routes';
import { ServiceContainer } from './services/service-container';

export interface BuildHttpServerOptions {
  fastifyOptions?: FastifyServerOptions;
  container?: ServiceContainer;
}

export async function buildHttpServer(options: BuildHttpServerOptions = {}): Promise<FastifyInstance> {
  const app = fastify(options.fastifyOptions ?? { logger: true });
  const container = options.container ?? new ServiceContainer();

  registerErrorHandler(app);
  await registerApiRoutes(app, container);
  await registerWebConsoleStatic(app);

  return app;
}
