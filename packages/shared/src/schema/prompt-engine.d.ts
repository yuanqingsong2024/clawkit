import { z } from 'zod';
/**
 * PromptEngine 模式枚举
 */
export declare const PromptEngineModeSchema: z.ZodEnum<{
    hybrid: "hybrid";
    template: "template";
    llm: "llm";
}>;
/**
 * PromptEngine Provider 枚举
 */
export declare const PromptEngineProviderSchema: z.ZodEnum<{
    custom: "custom";
    openai: "openai";
    anthropic: "anthropic";
}>;
/**
 * Fallback 配置 Schema
 */
export declare const FallbackConfigSchema: z.ZodObject<{
    provider: z.ZodEnum<{
        custom: "custom";
        openai: "openai";
        anthropic: "anthropic";
    }>;
    model: z.ZodString;
    apiKeyEnv: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * PromptEngine 配置 Schema
 */
export declare const PromptEngineSchema: z.ZodObject<{
    mode: z.ZodDefault<z.ZodEnum<{
        hybrid: "hybrid";
        template: "template";
        llm: "llm";
    }>>;
    provider: z.ZodOptional<z.ZodEnum<{
        custom: "custom";
        openai: "openai";
        anthropic: "anthropic";
    }>>;
    baseUrl: z.ZodOptional<z.ZodString>;
    apiKeyEnv: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    temperature: z.ZodDefault<z.ZodNumber>;
    maxTokens: z.ZodDefault<z.ZodNumber>;
    timeoutMs: z.ZodDefault<z.ZodNumber>;
    fallback: z.ZodOptional<z.ZodObject<{
        provider: z.ZodEnum<{
            custom: "custom";
            openai: "openai";
            anthropic: "anthropic";
        }>;
        model: z.ZodString;
        apiKeyEnv: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PromptEngineMode = z.infer<typeof PromptEngineModeSchema>;
export type PromptEngineProvider = z.infer<typeof PromptEngineProviderSchema>;
export type FallbackConfig = z.infer<typeof FallbackConfigSchema>;
export type PromptEngine = z.infer<typeof PromptEngineSchema>;
//# sourceMappingURL=prompt-engine.d.ts.map