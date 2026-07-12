import { z } from 'zod';
/**
 * Memory Provider 枚举
 */
export declare const MemoryProviderSchema: z.ZodEnum<{
    local: "local";
    redis: "redis";
    postgres: "postgres";
}>;
/**
 * Memory 配置 Schema
 */
export declare const MemorySchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    provider: z.ZodDefault<z.ZodEnum<{
        local: "local";
        redis: "redis";
        postgres: "postgres";
    }>>;
    path: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type MemoryProvider = z.infer<typeof MemoryProviderSchema>;
export type Memory = z.infer<typeof MemorySchema>;
//# sourceMappingURL=memory.d.ts.map