import pino, { Logger as PinoLogger, LoggerOptions as PinoLoggerOptions } from 'pino';

/**
 * 日志级别枚举（与 pino 兼容）
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * 日志配置
 */
export interface LoggerConfig {
  level: LogLevel;
  service: string;
  enableTimestamp?: boolean;
  enableColors?: boolean;
  jsonFormat?: boolean;
}

const LOG_LEVEL_MAP: Record<string, pino.Level> = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};

/**
 * 敏感信息脱敏
 */
function redactMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = new Set([
    'authorization', 'Authorization', 'bearer', 'Bearer',
    'token', 'Token', 'cookie', 'Cookie',
    'set-cookie', 'Set-Cookie', 'x-api-key', 'X-API-Key',
    'x-auth-token', 'X-Auth-Token', 'password', 'Password',
    'secret', 'Secret', 'apiKey', 'api_key', 'API_KEY',
  ]);

  const redactValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(item => redactValue(item));
    }

    if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const output: Record<string, unknown> = {};

      for (const [key, nestedValue] of Object.entries(record)) {
        output[key] = sensitiveKeys.has(key) ? '***' : redactValue(nestedValue);
      }

      return output;
    }

    return value;
  };

  return redactValue(meta) as Record<string, unknown>;
}

/**
 * 结构化日志工具
 * 
 * 基于 pino 的生产级日志实现，支持：
 * - JSON 格式输出（便于日志收集）
 * - 日志级别控制
 * - 请求追踪（requestId）
 * - 敏感信息脱敏
 */
export class Logger {
  private pinoLogger: PinoLogger;
  private service: string;
  private jsonFormat: boolean;

  constructor(config: LoggerConfig) {
    this.service = config.service;
    this.jsonFormat = config.jsonFormat ?? process.env.LOG_JSON === 'true';

    const level = LOG_LEVEL_MAP[config.level] ?? pino.levels.values.info;
    
    const options: PinoLoggerOptions = {
      level,
      base: {
        service: config.service,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    };

    if (!this.jsonFormat && process.env.NODE_ENV !== 'production') {
      this.pinoLogger = pino({
        ...options,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: config.enableColors ?? false,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      });
    } else {
      this.pinoLogger = pino(options);
    }
  }

  /**
   * DEBUG 级别日志
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    this.pinoLogger.debug(redactMeta(meta ?? {}), message);
  }

  /**
   * INFO 级别日志
   */
  info(message: string, meta?: Record<string, unknown>): void {
    this.pinoLogger.info(redactMeta(meta ?? {}), message);
  }

  /**
   * WARN 级别日志
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    this.pinoLogger.warn(redactMeta(meta ?? {}), message);
  }

  /**
   * ERROR 级别日志
   */
  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const errorMeta = error instanceof Error
      ? { error: { message: error.message, stack: error.stack }, ...meta }
      : error ? { error: String(error), ...meta } : meta;
    
    this.pinoLogger.error(redactMeta(errorMeta ?? {}), message);
  }

  /**
   * 创建子 Logger（继承配置，但可指定不同的 service 名称）
   */
  child(service: string): Logger {
    const childPino = this.pinoLogger.child({ service: `${this.service}:${service}` });
    
    const childLogger = Object.create(this, {
      pinoLogger: { value: childPino },
      service: { value: `${this.service}:${service}` },
      jsonFormat: { value: this.jsonFormat },
    });
    
    return childLogger as unknown as Logger;
  }

  /**
   * 创建带 requestId 的 Logger
   * 用于请求追踪
   */
  withRequestId(requestId: string): Logger {
    const childPino = this.pinoLogger.child({ requestId });
    
    const childLogger = Object.create(this, {
      pinoLogger: { value: childPino },
      service: { value: this.service },
      jsonFormat: { value: this.jsonFormat },
    });
    
    return childLogger as unknown as Logger;
  }
}

/**
 * 从环境变量创建 Logger
 */
export function createLogger(service: string): Logger {
  const levelStr = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
  const level = LOG_LEVEL_MAP[levelStr] as LogLevel ?? LogLevel.INFO;
  const jsonFormat = process.env.LOG_JSON === 'true';

  return new Logger({
    service,
    level,
    jsonFormat,
    enableTimestamp: true,
    enableColors: false,
  });
}

/**
 * 生成请求 ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
