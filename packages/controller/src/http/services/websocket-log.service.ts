/**
 * WebSocket 实时日志服务
 * 提供 WebSocket 端点，支持客户端订阅实时日志流
 */

import { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { createLogger } from '@clawkit/shared';

const logger = createLogger('websocket-logs');

interface LogStreamClient {
  socket: import('@fastify/websocket').WebSocket;
  service: string;
  lines: number;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
}

/**
 * WebSocket 实时日志服务
 */
export class WebSocketLogService {
  private app: FastifyInstance;
  private clients: Map<string, LogStreamClient> = new Map();
  private tailProcesses: Map<string, ChildProcess> = new Map();
  private clientIdCounter = 0;

  constructor(app: FastifyInstance) {
    this.app = app;
  }

  /**
   * 初始化 WebSocket 插件和路由
   */
  async initialize(): Promise<void> {
    // 注册 WebSocket 插件
    await this.app.register(websocket);

    // 注册 WebSocket 路由
    this.app.get('/ws/logs/:service', { websocket: true }, (socket, request) => {
      const { service } = request.params as { service: string };
      const clientId = `client_${++this.clientIdCounter}`;

      // 验证服务名称
      if (service !== 'controller' && service !== 'worker') {
        socket.send(JSON.stringify({
          type: 'error',
          message: '无效的服务名称，只支持 controller 或 worker',
        }));
        socket.close();
        return;
      }

      // 获取查询参数
      const url = new URL(request.url, 'http://localhost');
      const lines = parseInt(url.searchParams.get('lines') ?? '100', 10);

      // 注册客户端
      const client: LogStreamClient = {
        socket,
        service,
        lines,
      };
      this.clients.set(clientId, client);

      logger.info(`WebSocket 客户端连接: ${clientId}, 服务: ${service}`);
      socket.send(JSON.stringify({
        type: 'connected',
        clientId,
        service,
        message: '已连接到实时日志流',
      }));

      // 启动 tail 进程
      this.startTailProcess(clientId, service, lines);

      // 处理客户端消息
      socket.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(clientId, data);
        } catch {
          // 忽略无效消息
        }
      });

      // 处理连接关闭
      socket.on('close', () => {
        logger.info(`WebSocket 客户端断开: ${clientId}`);
        this.clients.delete(clientId);
        this.stopTailProcess(clientId);
      });

      // 处理错误
      socket.on('error', (error: Error) => {
        logger.error(`WebSocket 客户端错误: ${clientId}`, { error: error.message });
        this.clients.delete(clientId);
        this.stopTailProcess(clientId);
      });
    });

    logger.info('WebSocket 实时日志服务已初始化');
  }

  /**
   * 处理客户端消息
   */
  private handleClientMessage(clientId: string, data: { action?: string; level?: string }): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (data.action) {
      case 'ping':
        client.socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        break;
      case 'filter':
        // 支持动态过滤日志级别
        client.socket.send(JSON.stringify({
          type: 'filter-acknowledged',
          level: data.level,
        }));
        break;
      default:
        break;
    }
  }

  /**
   * 启动 tail 进程
   */
  private startTailProcess(clientId: string, service: string, lines: number): void {
    const logPath = this.getLogPath(service);

    if (!existsSync(logPath)) {
      const client = this.clients.get(clientId);
      if (client) {
        client.socket.send(JSON.stringify({
          type: 'error',
          message: `日志文件不存在: ${logPath}`,
        }));
      }
      return;
    }

    try {
      const tail = spawn('tail', ['-f', '-n', lines.toString(), logPath]);

      this.tailProcesses.set(clientId, tail);

      tail.stdout.on('data', (data: Buffer) => {
        const client = this.clients.get(clientId);
        if (!client || client.socket.readyState !== 1 /* OPEN */) {
          return;
        }

        // 逐行发送
        const lines = data.toString().split('\n').filter(line => line.trim());
        for (const line of lines) {
          const logEntry = this.parseLogLine(line, service);
          client.socket.send(JSON.stringify({
            type: 'log',
            ...logEntry,
          }));
        }
      });

      tail.stderr.on('data', (data: Buffer) => {
        logger.warn(`tail stderr: ${data.toString()}`);
      });

      tail.on('error', (error: Error) => {
        logger.error(`tail 进程错误: ${clientId}`, { error: error.message });
        const client = this.clients.get(clientId);
        if (client) {
          client.socket.send(JSON.stringify({
            type: 'error',
            message: `日志流错误: ${error.message}`,
          }));
        }
      });

      tail.on('close', (code) => {
        if (code !== 0 && code !== null) {
          logger.warn(`tail 进程退出，退出码: ${code}`);
        }
      });
    } catch (error) {
      logger.error(`启动 tail 进程失败: ${clientId}`, { error });
    }
  }

  /**
   * 停止 tail 进程
   */
  private stopTailProcess(clientId: string): void {
    const tail = this.tailProcesses.get(clientId);
    if (tail) {
      tail.kill();
      this.tailProcesses.delete(clientId);
    }
  }

  /**
   * 获取日志文件路径
   */
  private getLogPath(service: string): string {
    const logFile = service === 'controller' ? 'controller.log' : 'worker.log';

    // 优先使用环境变量指定的日志目录
    if (process.env.CLAWKIT_LOG_DIR) {
      return join(process.env.CLAWKIT_LOG_DIR, logFile);
    }

    // 尝试多个可能的位置
    const possiblePaths = [
      join(process.cwd(), '.clawkit/logs', logFile),
      join(process.cwd(), '../../.clawkit/logs', logFile),
      join(process.cwd(), '../.clawkit/logs', logFile),
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    return possiblePaths[0];
  }

  /**
   * 解析日志行
   */
  private parseLogLine(line: string, service: string): LogEntry {
    // 尝试解析标准日志格式：[timestamp] level message
    const timestampMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\]/);
    const levelMatch = line.match(/\s+(ERROR|WARN|INFO|DEBUG|TRACE)\s+/i);

    const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();
    const level = levelMatch ? levelMatch[1].toUpperCase() : 'INFO';
    const message = line.replace(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\]\s*(ERROR|WARN|INFO|DEBUG|TRACE)\s+/i, '').trim();

    return {
      timestamp,
      level,
      message: message || line,
      service,
    };
  }

  /**
   * 获取连接统计
   */
  getStats(): { clientCount: number; clientsByService: Record<string, number> } {
    const clientsByService: Record<string, number> = { controller: 0, worker: 0 };

    for (const client of this.clients.values()) {
      clientsByService[client.service] = (clientsByService[client.service] || 0) + 1;
    }

    return {
      clientCount: this.clients.size,
      clientsByService,
    };
  }

  /**
   * 广播消息到所有客户端
   */
  broadcast(message: object): void {
    const data = JSON.stringify(message);
    for (const client of this.clients.values()) {
      if (client.socket.readyState === 1 /* OPEN */) {
        client.socket.send(data);
      }
    }
  }

  /**
   * 关闭所有连接
   */
  async close(): Promise<void> {
    // 停止所有 tail 进程
    for (const [clientId, tail] of this.tailProcesses) {
      tail.kill();
      this.tailProcesses.delete(clientId);
    }

    // 关闭所有 WebSocket 连接
    for (const [clientId, client] of this.clients) {
      client.socket.close();
      this.clients.delete(clientId);
    }

    logger.info('WebSocket 实时日志服务已关闭');
  }
}

// 导出单例
let wsLogService: WebSocketLogService | null = null;

export async function initializeWebSocketLogService(app: FastifyInstance): Promise<WebSocketLogService> {
  if (!wsLogService) {
    wsLogService = new WebSocketLogService(app);
    await wsLogService.initialize();
  }
  return wsLogService;
}

export function getWebSocketLogService(): WebSocketLogService | null {
  return wsLogService;
}
