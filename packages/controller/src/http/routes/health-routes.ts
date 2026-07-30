/**
 * 健康检查路由
 * 提供系统健康状态查询接口
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { sendSuccess } from '../types/api-response';
import {
  performComprehensiveHealthCheck,
  type ComprehensiveHealthResult,
} from '../../cluster/detailed-health-check';

/**
 * 注册健康检查路由
 */
export function buildHealthRoutes(): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    // 基础健康检查
    app.get('/', async (_request, reply) => {
      sendSuccess(reply, {
        code: 'controller.health.ok',
        message: 'Controller 服务运行正常',
        data: {
          service: '@clawkit/controller',
          stage: 'v1.0.0',
          timestamp: new Date().toISOString(),
        },
      });
    });

    // 详细健康检查
    app.get('/detailed', async (_request, reply) => {
      try {
        const result = await performComprehensiveHealthCheck({
          openCodeUrl: process.env.OPENCODE_SERVER_BASE_URL || 'http://127.0.0.1:4096',
          claudeCodePath: 'claude-code',
          diskPath: process.cwd(),
        });

        const statusCode = result.overall === 'healthy' ? 200 : result.overall === 'degraded' ? 200 : 503;

        return reply.status(statusCode).send({
          success: true,
          code: 'controller.health.detailed_ok',
          message: `详细健康检查完成，总体状态: ${result.overall}`,
          data: result,
        });
      } catch (error) {
        return reply.status(503).send({
          success: false,
          code: 'controller.health.detailed_error',
          message: '健康检查执行失败',
          data: {
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          },
        });
      }
    });

    // OpenCode 健康检查
    app.get('/opencode', async (request, reply) => {
      const baseUrl = (request.query as { url?: string }).url || process.env.OPENCODE_SERVER_BASE_URL || 'http://127.0.0.1:4096';

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${baseUrl}/health`, {
          signal: controller.signal,
          method: 'GET',
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          return sendSuccess(reply, {
            code: 'controller.health.opencode_healthy',
            message: 'OpenCode 服务健康',
            data: {
              status: 'healthy',
              url: baseUrl,
              responseStatus: response.status,
              details: data,
            },
          });
        } else {
          return reply.status(503).send({
            success: false,
            code: 'controller.health.opencode_unhealthy',
            message: `OpenCode 服务异常: HTTP ${response.status}`,
            data: {
              status: 'unhealthy',
              url: baseUrl,
              responseStatus: response.status,
            },
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isTimeout = error instanceof Error && error.name === 'AbortError';

        return reply.status(503).send({
          success: false,
          code: 'controller.health.opencode_unreachable',
          message: isTimeout ? 'OpenCode 服务连接超时' : 'OpenCode 服务不可达',
          data: {
            status: 'unreachable',
            url: baseUrl,
            error: errorMsg,
          },
        });
      }
    });

    // Claude Code 健康检查
    app.get('/claude-code', async (request, reply) => {
      const cliPath = (request.query as { path?: string }).path || 'claude-code';

      try {
        const { execSync } = require('child_process');
        const version = execSync(`${cliPath} --version`, { encoding: 'utf-8', timeout: 5000 }).trim();

        return sendSuccess(reply, {
          code: 'controller.health.claude_code_healthy',
          message: 'Claude Code 可用',
          data: {
            status: 'healthy',
            path: cliPath,
            version,
          },
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isNotFound = errorMsg.includes('not found') || errorMsg.includes('ENOENT');

        return reply.status(503).send({
          success: false,
          code: isNotFound ? 'controller.health.claude_code_not_found' : 'controller.health.claude_code_error',
          message: isNotFound ? 'Claude Code 未安装或不在 PATH 中' : 'Claude Code 检查失败',
          data: {
            status: isNotFound ? 'unreachable' : 'unhealthy',
            path: cliPath,
            error: errorMsg,
          },
        });
      }
    });

    // 磁盘空间检查
    app.get('/disk', async (request, reply) => {
      const path = (request.query as { path?: string }).path || process.cwd();

      try {
        const { execSync } = require('child_process');
        const output = execSync(`df -k "${path}" | tail -1`, { encoding: 'utf-8', timeout: 3000 }).trim();
        const parts = output.split(/\s+/);

        if (parts.length < 4) {
          throw new Error('无法解析磁盘使用情况');
        }

        const totalKb = parseInt(parts[1], 10);
        const usedKb = parseInt(parts[2], 10);
        const availKb = parseInt(parts[3], 10);
        const usePercent = parseInt(parts[4]?.replace('%', '') || '0', 10);

        const status = usePercent >= 90 ? 'unhealthy' : usePercent >= 80 ? 'degraded' : 'healthy';
        const statusCode = status === 'healthy' ? 200 : 503;

        return reply.status(statusCode).send({
          success: true,
          code: 'controller.health.disk_ok',
          message: `磁盘使用率: ${usePercent}%`,
          data: {
            status,
            path,
            totalMB: Math.round(totalKb / 1024),
            usedMB: Math.round(usedKb / 1024),
            availableMB: Math.round(availKb / 1024),
            usePercent,
          },
        });
      } catch (error) {
        return reply.status(503).send({
          success: false,
          code: 'controller.health.disk_error',
          message: '磁盘检查失败',
          data: {
            status: 'unhealthy',
            path,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    });

    // 就绪探针（Kubernetes）
    app.get('/ready', async (_request, reply) => {
      const result = await performComprehensiveHealthCheck({
        diskPath: process.cwd(),
      });

      const isReady = result.overall !== 'unhealthy';

      if (isReady) {
        return reply.status(200).send({
          ready: true,
          timestamp: result.timestamp.toISOString(),
        });
      } else {
        return reply.status(503).send({
          ready: false,
          reason: '关键组件不健康',
          details: result.summary,
          timestamp: result.timestamp.toISOString(),
        });
      }
    });

    // 存活探针（Kubernetes）
    app.get('/live', async (_request, reply) => {
      return reply.status(200).send({
        alive: true,
        timestamp: new Date().toISOString(),
      });
    });
  };
}
