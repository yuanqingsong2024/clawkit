import { z } from 'zod';

/**
 * PromptEngine 模式枚举
 */
export const PromptEngineModeSchema = z.enum(['template', 'llm', 'hybrid']);

/**
 * PromptEngine Provider 枚举
 */
export const PromptEngineProviderSchema = z.enum(['openai', 'anthropic', 'custom']);

/**
 * Fallback 配置 Schema
 */
export const FallbackConfigSchema = z.object({
  provider: PromptEngineProviderSchema.describe('备用 Provider'),
  model: z.string().describe('备用模型'),
  apiKeyEnv: z.string().optional().describe('备用 API Key 环境变量名'),
});

/**
 * PromptEngine 配置 Schema
 */
export const PromptEngineSchema = z.object({
  mode: PromptEngineModeSchema.default('template').describe('运行模式：template（模板）、llm（大模型）、hybrid（混合）'),
  provider: PromptEngineProviderSchema.optional().describe('Provider 类型（llm/hybrid 模式必需）'),
  baseUrl: z.string().url('baseUrl 必须是有效的 URL').optional().describe('API 基础 URL'),
  apiKeyEnv: z.string().optional().describe('API Key 环境变量名（llm/hybrid 模式必需）'),
  model: z.string().optional().describe('使用的模型（llm/hybrid 模式必需）'),
  temperature: z.number().min(0).max(2).default(0.7).describe('温度参数，控制输出随机性'),
  maxTokens: z.number().int().min(1).default(4096).describe('最大 token 数'),
  timeoutMs: z.number().int().min(1000).default(30000).describe('请求超时时间（毫秒）'),
  fallback: FallbackConfigSchema.optional().describe('备用配置'),
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

export type PromptEngineMode = z.infer<typeof PromptEngineModeSchema>;
export type PromptEngineProvider = z.infer<typeof PromptEngineProviderSchema>;
export type FallbackConfig = z.infer<typeof FallbackConfigSchema>;
export type PromptEngine = z.infer<typeof PromptEngineSchema>;
