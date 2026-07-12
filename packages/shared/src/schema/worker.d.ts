import { z } from 'zod';
/**
 * Worker 连接模式枚举
 */
export declare const ConnectModeSchema: z.ZodEnum<{
    pull: "pull";
    push: "push";
}>;
/**
 * Worker 配置 Schema
 */
export declare const WorkerSchema: z.ZodObject<{
    id: z.ZodString;
    node: z.ZodString;
    connectMode: z.ZodDefault<z.ZodEnum<{
        pull: "pull";
        push: "push";
    }>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    projects: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * Workers 配置 Schema
 */
export declare const WorkersSchema: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    node: z.ZodString;
    connectMode: z.ZodDefault<z.ZodEnum<{
        pull: "pull";
        push: "push";
    }>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    projects: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>;
}, z.core.$strip>>;
export type ConnectMode = z.infer<typeof ConnectModeSchema>;
export type Worker = z.infer<typeof WorkerSchema>;
export type Workers = z.infer<typeof WorkersSchema>;
//# sourceMappingURL=worker.d.ts.map