"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvString = getEnvString;
exports.getEnvNumber = getEnvNumber;
exports.getEnvBoolean = getEnvBoolean;
exports.getEnvArray = getEnvArray;
exports.validateConfig = validateConfig;
function getEnvString(key, defaultValue) {
    return process.env[key] ?? defaultValue;
}
function getEnvNumber(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined)
        return defaultValue;
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) {
        throw new Error(`环境变量 ${key} 的值 "${value}" 不是有效的数字`);
    }
    return parsed;
}
function getEnvBoolean(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined)
        return defaultValue;
    return value === 'true' || value === '1';
}
function getEnvArray(key, separator = ',', defaultValue) {
    const value = process.env[key];
    if (value === undefined)
        return defaultValue;
    return value.split(separator).map(s => s.trim()).filter(Boolean);
}
function validateConfig(schema, data, configName) {
    const result = schema.safeParse(data);
    if (!result.success) {
        const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`${configName} 配置验证失败：${errors}`);
    }
    return result.data;
}
//# sourceMappingURL=index.js.map