import { z } from 'zod';
/**
 * OpenCode 配置 Schema
 *
 * 注意：推荐使用全局 openCodeBaseUrl 配置共享一个 OpenCode 服务实例。
 * port 字段仅在需要为特定项目使用独立 OpenCode 实例时才配置。
 */
export declare const OpenCodeConfigSchema: z.ZodObject<{
    port: z.ZodOptional<z.ZodNumber>;
    agent: z.ZodDefault<z.ZodString>;
    mode: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
/**
 * Project 配置 Schema
 */
export declare const ProjectSchema: z.ZodObject<{
    key: z.ZodString;
    repoPath: z.ZodString;
    baseBranch: z.ZodDefault<z.ZodString>;
    openCode: z.ZodObject<{
        port: z.ZodOptional<z.ZodNumber>;
        agent: z.ZodDefault<z.ZodString>;
        mode: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>;
    executionTimeoutMs: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    maxRetries: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, z.core.$strip>;
export type OpenCodeConfig = z.infer<typeof OpenCodeConfigSchema>;
export type Project = z.infer<typeof ProjectSchema>;
//# sourceMappingURL=project.d.ts.map