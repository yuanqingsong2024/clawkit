/**
 * 日志级别
 */
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
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
export declare class Logger {
    private config;
    constructor(config: LoggerConfig);
    /**
     * 格式化日志消息
     */
    private format;
    /**
     * 对日志元数据做最小脱敏，避免把 token、Cookie、Authorization 等敏感头直接打出来。
     */
    private redactMeta;
    /**
     * 检查日志级别是否启用
     */
    private isLevelEnabled;
    /**
     * DEBUG 级别日志
     */
    debug(message: string, meta?: Record<string, unknown>): void;
    /**
     * INFO 级别日志
     */
    info(message: string, meta?: Record<string, unknown>): void;
    /**
     * WARN 级别日志
     */
    warn(message: string, meta?: Record<string, unknown>): void;
    /**
     * ERROR 级别日志
     */
    error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void;
    /**
     * 创建子 Logger（继承配置，但可指定不同的 service 名称）
     */
    child(service: string): Logger;
}
/**
 * 从环境变量创建 Logger
 */
export declare function createLogger(service: string): Logger;
//# sourceMappingURL=logger.d.ts.map