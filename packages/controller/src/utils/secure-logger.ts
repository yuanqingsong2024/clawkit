import { createLogger, type Logger } from '@clawkit/shared';

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
export interface SecureLoggerConfig {
  /** 是否启用安全日志 */
  enabled?: boolean;
  /** 是否在日志中隐藏敏感信息 */
  maskSensitive?: boolean;
  /** 最小日志级别 */
  minLevel?: LogLevel;
  /** 是否在日志中包含请求 ID */
  includeRequestId?: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<SecureLoggerConfig> = {
  enabled: true,
  maskSensitive: true,
  minLevel: LogLevel.INFO,
  includeRequestId: true,
};

/**
 * 敏感信息模式
 */
const SENSITIVE_PATTERNS = [
  { pattern: /password["\s]*[:=]["\s]*[^\s,"]+/gi, replacement: 'password=***' },
  { pattern: /api[_-]?key["\s]*[:=]["\s]*[^\s,"]+/gi, replacement: 'api_key=***' },
  { pattern: /token["\s]*[:=]["\s]*[^\s,"]+/gi, replacement: 'token=***' },
  { pattern: /secret["\s]*[:=]["\s]*[^\s,"]+/gi, replacement: 'secret=***' },
  { pattern: /bearer[_\s]+[^\s]+/gi, replacement: 'Bearer ***' },
  { pattern: /x[_-]?api[_-]?key["\s]*[:=]["\s]*[^\s,"]+/gi, replacement: 'X-API-Key=***' },
  { pattern: /"password"\s*:\s*"[^"]+"/g, replacement: '"password":"***"' },
  { pattern: /"token"\s*:\s*"[^"]+"/g, replacement: '"token":"***"' },
  { pattern: /"api_key"\s*:\s*"[^"]+"/g, replacement: '"api_key":"***"' },
  { pattern: /"secret"\s*:\s*"[^"]+"/g, replacement: '"secret":"***"' },
];

/**
 * 安全日志记录器
 * 自动过滤敏感信息
 */
export class SecureLogger {
  private readonly config: Required<SecureLoggerConfig>;
  private readonly logger: Logger;

  constructor(category: string, config?: SecureLoggerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = createLogger(`secure.${category}`);
  }

  /**
   * 记录调试日志
   */
  debug(message: string, data?: Record<string, unknown>): void {
    if (this.config.minLevel <= LogLevel.DEBUG) {
      this.log('debug', message, data);
    }
  }

  /**
   * 记录信息日志
   */
  info(message: string, data?: Record<string, unknown>): void {
    if (this.config.minLevel <= LogLevel.INFO) {
      this.log('info', message, data);
    }
  }

  /**
   * 记录警告日志
   */
  warn(message: string, data?: Record<string, unknown>): void {
    if (this.config.minLevel <= LogLevel.WARN) {
      this.log('warn', message, data);
    }
  }

  /**
   * 记录错误日志
   */
  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    if (this.config.minLevel <= LogLevel.ERROR) {
      const errorData = this.extractErrorData(error);
      this.log('error', message, { ...data, ...errorData });
    }
  }

  /**
   * 记录安全事件
   */
  security(
    action: 'login' | 'logout' | 'auth_failure' | 'access_denied' | 'suspicious_activity',
    message: string,
    details?: Record<string, unknown>,
  ): void {
    const sanitizedDetails = this.config.maskSensitive ? this.sanitize(details) : details;
    this.log('warn', `[SECURITY] ${action}: ${message}`, sanitizedDetails);
  }

  /**
   * 记录认证事件
   */
  auth(
    action: 'success' | 'failure' | 'attempt',
    userId?: string,
    details?: Record<string, unknown>,
  ): void {
    const sanitizedDetails = this.config.maskSensitive ? this.sanitize(details) : details;
    const userInfo = userId ? { userId } : {};
    this.log('info', `[AUTH] ${action}`, { ...userInfo, ...sanitizedDetails });
  }

  /**
   * 记录请求日志（自动处理敏感信息）
   */
  request(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    details?: Record<string, unknown>,
  ): void {
    const sanitizedDetails = this.config.maskSensitive ? this.sanitize(details) : details;
    
    const logData = {
      method,
      path,
      status: statusCode,
      duration: `${duration}ms`,
      ...sanitizedDetails,
    };

    if (statusCode >= 500) {
      this.log('error', 'Request failed', logData);
    } else if (statusCode >= 400) {
      this.log('warn', 'Request error', logData);
    } else {
      this.log('info', 'Request completed', logData);
    }
  }

  /**
   * 过滤敏感信息
   */
  sanitize(data?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!data) {
      return undefined;
    }

    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '***';
      } else if (typeof value === 'string') {
        sanitized[key] = this.maskSensitiveString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitize(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * 判断是否为敏感键
   */
  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'apikey',
      'privateKey',
      'private_key',
      'credential',
      'authorization',
      'auth',
      'sessionId',
      'session_id',
    ];

    const lowerKey = key.toLowerCase();
    return sensitiveKeys.some((sk) => lowerKey.includes(sk.toLowerCase()));
  }

  /**
   * 掩盖敏感字符串
   */
  private maskSensitiveString(value: string): string {
    let result = value;

    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      result = result.replace(pattern, replacement);
    }

    // 如果包含 JWT token，掩盖中间部分
    if (result.includes('.') && result.split('.').length === 3) {
      result = result.replace(/\.[^.]+\./, '.***.');
    }

    // 如果包含 base64 编码的敏感信息
    try {
      const decoded = Buffer.from(result, 'base64').toString('utf8');
      if (this.isSensitiveKey(decoded) || decoded.match(/password|token|secret/i)) {
        return '[BASE64_ENCODED_SENSITIVE]';
      }
    } catch {
      // 不是有效的 base64，忽略
    }

    return result;
  }

  /**
   * 提取错误数据
   */
  private extractErrorData(error?: Error | unknown): Record<string, unknown> {
    if (!error) {
      return {};
    }

    if (error instanceof Error) {
      return {
        errorName: error.name,
        errorMessage: this.maskSensitiveString(error.message),
        stack: error.stack,
      };
    }

    return {
      error: this.maskSensitiveString(String(error)),
    };
  }

  /**
   * 输出日志
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
    const sanitizedData = this.config.maskSensitive ? this.sanitize(data) : data;

    switch (level) {
      case 'debug':
        this.logger.debug(message, sanitizedData);
        break;
      case 'info':
        this.logger.info(message, sanitizedData);
        break;
      case 'warn':
        this.logger.warn(message, sanitizedData);
        break;
      case 'error':
        this.logger.error(message, sanitizedData);
        break;
    }
  }
}

/**
 * 创建安全日志记录器
 */
export function createSecureLogger(category: string, config?: SecureLoggerConfig): SecureLogger {
  return new SecureLogger(category, config);
}
