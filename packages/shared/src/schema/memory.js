"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemorySchema = exports.MemoryProviderSchema = void 0;
const zod_1 = require("zod");
/**
 * Memory Provider 枚举
 */
exports.MemoryProviderSchema = zod_1.z.enum(['local', 'redis', 'postgres']);
/**
 * Memory 配置 Schema
 */
exports.MemorySchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(true).describe('是否启用记忆功能'),
    provider: exports.MemoryProviderSchema.default('local').describe('存储提供者'),
    path: zod_1.z.string().optional().describe('本地存储路径（provider 为 local 时必填）'),
    url: zod_1.z.string().optional().describe('远程存储 URL（provider 为 redis/postgres 时必填）'),
}).refine((data) => {
    // 如果 provider 是 local，必须提供 path
    if (data.provider === 'local' && !data.path) {
        return false;
    }
    // 如果 provider 是 redis 或 postgres，必须提供 url
    if ((data.provider === 'redis' || data.provider === 'postgres') && !data.url) {
        return false;
    }
    return true;
}, {
    message: 'provider 为 local 时必须提供 path，为 redis/postgres 时必须提供 url',
});
//# sourceMappingURL=memory.js.map