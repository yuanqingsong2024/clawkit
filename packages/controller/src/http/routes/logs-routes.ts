import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { createLogger } from '@clawkit/shared';

// 创建日志记录器
const logger = createLogger('controller.routes.logs');

interface LogsQueryParams {
  lines?: string;
  follow?: string;
}

interface LogsParams {
  service: string;
}

function getLogPath(service: string): string {
  const logFile = service === 'controller' ? 'controller.log' : 'worker.log';
  
  // 优先使用环境变量指定的日志目录（支持绝对路径）
  if (process.env.CLAWKIT_LOG_DIR) {
    return join(process.env.CLAWKIT_LOG_DIR, logFile);
  }
  
  // 否则尝试多个可能的位置
  const possiblePaths = [
    // 1. 当前工作目录下的 .clawkit/logs
    join(process.cwd(), '.clawkit/logs', logFile),
    // 2. 项目根目录（向上两级，适用于从 packages/controller 启动的情况）
    join(process.cwd(), '../../.clawkit/logs', logFile),
    // 3. 向上一级目录
    join(process.cwd(), '../.clawkit/logs', logFile),
  ];
  
  // 返回第一个存在的路径
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }
  
  // 如果都不存在，返回默认路径（会在后续检查中返回 404）
  return possiblePaths[0];
}

async function readLastLines(filePath: string, lines: number): Promise<string[]> {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const allLines = content.split('\n').filter(line => line.trim().length > 0);
    return allLines.slice(-lines);
  } catch (error) {
    logger.error(`读取日志文件失败: ${filePath}`, { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

/**
 * 构建日志路由
 */
export function buildLogsRoutes(): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    app.get<{ Params: LogsParams; Querystring: LogsQueryParams }>(
      '/:service',
      async (request: FastifyRequest<{ Params: LogsParams; Querystring: LogsQueryParams }>, reply: FastifyReply) => {
        const { service } = request.params;
        const { lines = '100', follow = 'false' } = request.query;

        if (service !== 'controller' && service !== 'worker') {
          return reply.code(400).send({ error: '无效的服务名称，只支持 controller 或 worker' });
        }

        const logPath = getLogPath(service);

        if (!existsSync(logPath)) {
          return reply.code(404).send({ error: `日志文件不存在: ${logPath}` });
        }

        if (follow === 'true') {
          reply.raw.setHeader('Content-Type', 'text/event-stream');
          reply.raw.setHeader('Cache-Control', 'no-cache');
          reply.raw.setHeader('Connection', 'keep-alive');

          const tail = spawn('tail', ['-f', '-n', lines, logPath]);

          tail.stdout.on('data', (data: Buffer) => {
            reply.raw.write(`data: ${data.toString()}\n\n`);
          });

          tail.stderr.on('data', (data: Buffer) => {
            logger.warn(`tail stderr: ${data.toString()}`);
          });

          tail.on('error', (error: Error) => {
            logger.error('tail 进程错误', { error: error.message });
            reply.raw.end();
          });

          request.raw.on('close', () => {
            tail.kill();
          });

          return reply;
        } else {
          const logLines = await readLastLines(logPath, parseInt(lines, 10));
          return reply.send({ logs: logLines });
        }
      }
    );
  };
}
