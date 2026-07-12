"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptEngineSchema = exports.FallbackConfigSchema = exports.PromptEngineProviderSchema = exports.PromptEngineModeSchema = void 0;
const zod_1 = require("zod");
/**
 * PromptEngine 模式枚举
 */
exports.PromptEngineModeSchema = zod_1.z.enum(['template', 'llm', 'hybrid']);
/**
 * PromptEngine Provider 枚举
 */
exports.PromptEngineProviderSchema = zod_1.z.enum(['openai', 'anthropic', 'custom']);
/**
 * Fallback 配置 Schema
 */
exports.FallbackConfigSchema = zod_1.z.object({
    provider: exports.PromptEngineProviderSchema.describe('备用 Provider'),
    model: zod_1.z.string().describe('备用模型'),
    apiKeyEnv: zod_1.z.string().optional().describe('备用 API Key 环境变量名'),
});
/**
 * PromptEngine 配置 Schema
 */
exports.PromptEngineSchema = zod_1.z.object({
    mode: exports.PromptEngineModeSchema.default('template').describe('运行模式：template（模板）、llm（大模型）、hybrid（混合）'),
    provider: exports.PromptEngineProviderSchema.optional().describe('Provider 类型（llm/hybrid 模式必需）'),
    baseUrl: zod_1.z.string().url('baseUrl 必须是有效的 URL').optional().describe('API 基础 URL'),
    apiKeyEnv: zod_1.z.string().optional().describe('API Key 环境变量名（llm/hybrid 模式必需）'),
    model: zod_1.z.string().optional().describe('使用的模型（llm/hybrid 模式必需）'),
    temperature: zod_1.z.number().min(0).max(2).default(0.7).describe('温度参数，控制输出随机性'),
    maxTokens: zod_1.z.number().int().min(1).default(4096).describe('最大 token 数'),
    timeoutMs: zod_1.z.number().int().min(1000).default(30000).describe('请求超时时间（毫秒）'),
    fallback: exports.FallbackConfigSchema.optional().describe('备用配置'),
}).superRefine((config, ctx) => {
    // llm 和 hybrid 模式必须提供 provider、apiKeyEnv、model
    if (config.mode === 'llm' || config.mode === 'hybrid') {
        if (!config.provider) {
            ctx.addIssue({
                code: 'custom',
                path: ['provider'],
                message: `${config.mode} 模式必须提供 provider`,
            });
        }
        if (!config.apiKeyEnv) {
            ctx.addIssue({
                code: 'custom',
                path: ['apiKeyEnv'],
                message: `${config.mode} 模式必须提供 apiKeyEnv`,
            });
        }
        if (!config.model) {
            ctx.addIssue({
                code: 'custom',
                path: ['model'],
                message: `${config.mode} 模式必须提供 model`,
            });
        }
    }
});
//# sourceMappingURL=prompt-engine.js.map