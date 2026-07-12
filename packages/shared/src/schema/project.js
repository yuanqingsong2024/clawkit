"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectSchema = exports.OpenCodeConfigSchema = void 0;
const zod_1 = require("zod");
/**
 * OpenCode 配置 Schema
 *
 * 注意：推荐使用全局 openCodeBaseUrl 配置共享一个 OpenCode 服务实例。
 * port 字段仅在需要为特定项目使用独立 OpenCode 实例时才配置。
 */
exports.OpenCodeConfigSchema = zod_1.z.object({
    port: zod_1.z.number().int().min(1).max(65535).optional().describe('OpenCode 服务端口（可选，优先使用全局 openCodeBaseUrl 配置）'),
    agent: zod_1.z.string().default('build').describe('OpenCode 代理类型'),
    mode: zod_1.z.string().default('default').describe('OpenCode 运行模式'),
});
/**
 * Project 配置 Schema
 */
exports.ProjectSchema = zod_1.z.object({
    key: zod_1.z.string().min(1, '项目 key 不能为空').describe('项目唯一标识'),
    repoPath: zod_1.z.string().min(1, '仓库路径不能为空').describe('项目仓库路径'),
    baseBranch: zod_1.z.string().default('main').describe('基础分支名称'),
    openCode: exports.OpenCodeConfigSchema.describe('OpenCode 配置'),
    executionTimeoutMs: zod_1.z.number().int().min(1000).default(1800000).optional().describe('任务执行超时时间（毫秒），默认 30 分钟'),
    maxRetries: zod_1.z.number().int().min(0).max(10).default(3).optional().describe('任务失败最大重试次数，默认 3 次'),
});
//# sourceMappingURL=project.js.map