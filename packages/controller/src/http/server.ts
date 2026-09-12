import fastify, { type FastifyInstance, FastifyServerOptions } from 'fastify';

import { registerWebConsoleStatic } from './register-web-console-static';
import { registerErrorHandler } from './errors/error-handler';
import { registerApiRoutes } from './routes';
import { ServiceContainer } from './services/service-container';
import { registerRuntimeAuth } from './auth/runtime-auth';
import { initializeWebSocketLogService } from './services/websocket-log.service';
import { MetricsCollector } from '../metrics/metrics-collector';
import { AlertRulesEngine } from '../metrics/alert-rules';
import { AlertNotificationService } from '../metrics/alert-notifiers';
import type { MetricsServiceContext } from './routes/metrics-routes';

export interface BuildHttpServerOptions {
  fastifyOptions?: FastifyServerOptions;
  container?: ServiceContainer;
  enableMetrics?: boolean;
  metricsInstanceId?: string;
}

export async function buildHttpServer(options: BuildHttpServerOptions = {}): Promise<FastifyInstance> {
  const app = fastify(options.fastifyOptions ?? { logger: true });
  const container = options.container ?? new ServiceContainer();

  // 初始化 metrics 组件
  let metricsContext: MetricsServiceContext | undefined;
  if (options.enableMetrics !== false) {
    const instanceId = options.metricsInstanceId ?? 'controller';
    const metricsCollector = new MetricsCollector({ instanceId });
    const alertRulesEngine = new AlertRulesEngine();
    const notificationService = new AlertNotificationService(instanceId);
    metricsContext = { metricsCollector, alertRulesEngine, notificationService };
  }

  registerErrorHandler(app);
  registerRuntimeAuth(app);
  await registerApiRoutes(app, container, metricsContext);
  await registerWebConsoleStatic(app);

  // 初始化 WebSocket 实时日志服务
  await initializeWebSocketLogService(app);

  return app;
}
