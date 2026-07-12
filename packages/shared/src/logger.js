"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
exports.createLogger = createLogger;
/**
 * 日志级别
 */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * 轻量日志工具
 *
 * 提供基本的日志级别控制和格式化，避免引入重量级日志库
 */
class Logger {
    config;
    constructor(config) {
        this.config = {
            enableTimestamp: true,
            enableColors: false,
            ...config,
        };
    }
    /**
     * 格式化日志消息
     */
    format(level, message, meta) {
        const parts = [];
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
    redactMeta(meta) {
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
        const redactValue = (value) => {
            if (Array.isArray(value)) {
                return value.map((item) => redactValue(item));
            }
            if (value !== null && typeof value === 'object') {
                const record = value;
                const output = {};
                for (const [key, nestedValue] of Object.entries(record)) {
                    output[key] = sensitiveKeys.has(key) ? '***' : redactValue(nestedValue);
                }
                return output;
            }
            return value;
        };
        return redactValue(meta);
    }
    /**
     * 检查日志级别是否启用
     */
    isLevelEnabled(level) {
        return level >= this.config.level;
    }
    /**
     * DEBUG 级别日志
     */
    debug(message, meta) {
        if (this.isLevelEnabled(LogLevel.DEBUG)) {
            console.debug(this.format('DEBUG', message, meta));
        }
    }
    /**
     * INFO 级别日志
     */
    info(message, meta) {
        if (this.isLevelEnabled(LogLevel.INFO)) {
            console.info(this.format('INFO', message, meta));
        }
    }
    /**
     * WARN 级别日志
     */
    warn(message, meta) {
        if (this.isLevelEnabled(LogLevel.WARN)) {
            console.warn(this.format('WARN', message, meta));
        }
    }
    /**
     * ERROR 级别日志
     */
    error(message, error, meta) {
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
    child(service) {
        return new Logger({
            ...this.config,
            service: `${this.config.service}:${service}`,
        });
    }
}
exports.Logger = Logger;
/**
 * 从环境变量创建 Logger
 */
function createLogger(service) {
    const levelStr = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    const level = LogLevel[levelStr] ?? LogLevel.INFO;
    return new Logger({
        service,
        level,
        enableTimestamp: true,
        enableColors: false,
    });
}
//# sourceMappingURL=logger.js.map