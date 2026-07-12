/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * 日志配置
 */
export interface LoggerConfig {
  level: LogLevel;
  service: string;
  enableTimestamp?: boolean;
  enableColors?: boolean;
}

/**
 * 轻量日志工具
 * 
 * 提供基本的日志级别控制和格式化，避免引入重量级日志库
 */
export class Logger {
  private config: LoggerConfig;

  constructor(config: LoggerConfig) {
    this.config = {
      enableTimestamp: true,
      enableColors: false,
      ...config,
    };
  }

  /**
   * 格式化日志消息
   */
  private format(level: string, message: string, meta?: Record<string, unknown>): string {
    const parts: string[] = [];

    if (this.config.enableTimestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    parts.push(`[${this.config.service}]`);
    parts.push(`[${level}]`);
    parts.push(message);

    if (meta && Object.keys(meta).length > 0) {
      parts.push(JSON.stringify(this.redactMeta(meta)));
    }

    return parts.join(' ');
  }

  /**
   * 对日志元数据做最小脱敏，避免把 token、Cookie、Authorization 等敏感头直接打出来。
   */
  private redactMeta(meta: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = new Set([
      'authorization',
      'Authorization',
      'bearer',
      'Bearer',
      'token',
      'Token',
      'cookie',
      'Cookie',
      'set-cookie',
      'Set-Cookie',
      'x-api-key',
      'X-API-Key',
      'x-auth-token',
      'X-Auth-Token',
    ]);

    const redactValue = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        return value.map((item) => redactValue(item));
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
   * 检查日志级别是否启用
   */
  private isLevelEnabled(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  /**
   * DEBUG 级别日志
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.isLevelEnabled(LogLevel.DEBUG)) {
      console.debug(this.format('DEBUG', message, meta));
    }
  }

  /**
   * INFO 级别日志
   */
  info(message: string, meta?: Record<string, unknown>): void {
    if (this.isLevelEnabled(LogLevel.INFO)) {
      console.info(this.format('INFO', message, meta));
    }
  }

  /**
   * WARN 级别日志
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.isLevelEnabled(LogLevel.WARN)) {
      console.warn(this.format('WARN', message, meta));
    }
  }

  /**
   * ERROR 级别日志
   */
  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    if (this.isLevelEnabled(LogLevel.ERROR)) {
      const errorMeta = error instanceof Error
        ? { error: error.message, stack: error.stack, ...meta }
        : { error: String(error), ...meta };
      console.error(this.format('ERROR', message, errorMeta));
    }
  }

  /**
   * 创建子 Logger（继承配置，但可指定不同的 service 名称）
   */
  child(service: string): Logger {
    return new Logger({
      ...this.config,
      service: `${this.config.service}:${service}`,
    });
  }
}

/**
 * 从环境变量创建 Logger
 */
export function createLogger(service: string): Logger {
  const levelStr = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
  const level = LogLevel[levelStr as keyof typeof LogLevel] ?? LogLevel.INFO;

  return new Logger({
    service,
    level,
    enableTimestamp: true,
    enableColors: false,
  });
}
