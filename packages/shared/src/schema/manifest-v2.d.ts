/**
 * V2 Manifest Schema
 * 支持通用执行器和触发器配置的 manifest 定义
 *
 * V2 版本的核心改进：
 * 1. 将 openCode 特定配置抽象为通用 executor 配置
 * 2. 支持多种触发器源
 * 3. 项目级执行器覆盖
 * 4. 向后兼容 V1 配置
 */
import { z } from 'zod';
/**
 * 执行器类型枚举
 */
export declare const ExecutorTypeEnum: z.ZodEnum<{
    custom: "custom";
    opencode: "opencode";
    "claude-code": "claude-code";
    codex: "codex";
    gemini: "gemini";
    placeholder: "placeholder";
}>;
export type ExecutorType = z.infer<typeof ExecutorTypeEnum>;
/**
 * 执行器实例配置 Schema
 */
export declare const ExecutorInstanceSchema: z.ZodObject<{
    type: z.ZodEnum<{
        custom: "custom";
        opencode: "opencode";
        "claude-code": "claude-code";
        codex: "codex";
        gemini: "gemini";
        placeholder: "placeholder";
    }>;
    node: z.ZodString;
    publicUrl: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
    passwordEnv: z.ZodOptional<z.ZodString>;
    binaryPath: z.ZodOptional<z.ZodString>;
    workspace: z.ZodOptional<z.ZodString>;
    agent: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    mode: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    indices: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    allocation: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        exclusive: "exclusive";
        shared: "shared";
    }>>>;
    installMode: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        local: "local";
        external: "external";
        skip: "skip";
    }>>>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    fallbackToPlaceholder: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, z.core.$strip>;
export type ExecutorInstance = z.infer<typeof ExecutorInstanceSchema>;
/**
 * 项目级执行器覆盖配置 Schema
 */
export declare const ExecutorOverrideSchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodEnum<{
        custom: "custom";
        opencode: "opencode";
        "claude-code": "claude-code";
        codex: "codex";
        gemini: "gemini";
        placeholder: "placeholder";
    }>>;
    executorRef: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type ExecutorOverride = z.infer<typeof ExecutorOverrideSchema>;
/**
 * 执行器定义 Schema
 * 定义系统中可用的执行器实例
 */
export declare const ExecutorsSchema: z.ZodRecord<z.ZodString, z.ZodObject<{
    type: z.ZodEnum<{
        custom: "custom";
        opencode: "opencode";
        "claude-code": "claude-code";
        codex: "codex";
        gemini: "gemini";
        placeholder: "placeholder";
    }>;
    node: z.ZodString;
    publicUrl: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
    passwordEnv: z.ZodOptional<z.ZodString>;
    binaryPath: z.ZodOptional<z.ZodString>;
    workspace: z.ZodOptional<z.ZodString>;
    agent: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    mode: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    indices: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    allocation: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        exclusive: "exclusive";
        shared: "shared";
    }>>>;
    installMode: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        local: "local";
        external: "external";
        skip: "skip";
    }>>>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    fallbackToPlaceholder: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, z.core.$strip>>;
export type Executors = z.infer<typeof ExecutorsSchema>;
/**
 * 触发器类型枚举
 */
export declare const TriggerTypeEnum: z.ZodEnum<{
    custom: "custom";
    slack: "slack";
    http: "http";
    "claude-code": "claude-code";
    github: "github";
    feishu: "feishu";
}>;
export type TriggerType = z.infer<typeof TriggerTypeEnum>;
/**
 * 触发器实例配置 Schema
 */
export declare const TriggerInstanceSchema: z.ZodObject<{
    type: z.ZodEnum<{
        custom: "custom";
        slack: "slack";
        http: "http";
        "claude-code": "claude-code";
        github: "github";
        feishu: "feishu";
    }>;
    name: z.ZodString;
    webhookPath: z.ZodDefault<z.ZodString>;
    authTokenEnv: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    enabled: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type TriggerInstance = z.infer<typeof TriggerInstanceSchema>;
/**
 * 触发器定义 Schema
 * 定义系统中可用的触发器实例
 */
export declare const TriggersSchema: z.ZodRecord<z.ZodString, z.ZodObject<{
    type: z.ZodEnum<{
        custom: "custom";
        slack: "slack";
        http: "http";
        "claude-code": "claude-code";
        github: "github";
        feishu: "feishu";
    }>;
    name: z.ZodString;
    webhookPath: z.ZodDefault<z.ZodString>;
    authTokenEnv: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    enabled: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>>;
export type Triggers = z.infer<typeof TriggersSchema>;
/**
 * 执行器感知项目配置 Schema（V2）
 * 支持执行器覆盖的项目配置
 */
export declare const ProjectV2Schema: z.ZodPipe<z.ZodObject<{
    key: z.ZodString;
    repoPath: z.ZodString;
    baseBranch: z.ZodDefault<z.ZodString>;
    executor: z.ZodOptional<z.ZodObject<{
        type: z.ZodOptional<z.ZodEnum<{
            custom: "custom";
            opencode: "opencode";
            "claude-code": "claude-code";
            codex: "codex";
            gemini: "gemini";
            placeholder: "placeholder";
        }>>;
        executorRef: z.ZodOptional<z.ZodString>;
        config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
    openCode: z.ZodOptional<z.ZodObject<{
        port: z.ZodOptional<z.ZodNumber>;
        agent: z.ZodDefault<z.ZodString>;
        mode: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
    executionTimeoutMs: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    maxRetries: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, z.core.$strip>, z.ZodTransform<{
    key: string;
    repoPath: string;
    baseBranch: string;
    executor?: {
        type?: "custom" | "opencode" | "claude-code" | "codex" | "gemini" | "placeholder" | undefined;
        executorRef?: string | undefined;
        config?: Record<string, unknown> | undefined;
    } | undefined;
    openCode?: {
        agent: string;
        mode: string;
        port?: number | undefined;
    } | undefined;
    executionTimeoutMs?: number | undefined;
    maxRetries?: number | undefined;
}, {
    key: string;
    repoPath: string;
    baseBranch: string;
    executor?: {
        type?: "custom" | "opencode" | "claude-code" | "codex" | "gemini" | "placeholder" | undefined;
        executorRef?: string | undefined;
        config?: Record<string, unknown> | undefined;
    } | undefined;
    openCode?: {
        agent: string;
        mode: string;
        port?: number | undefined;
    } | undefined;
    executionTimeoutMs?: number | undefined;
    maxRetries?: number | undefined;
}>>;
export type ProjectV2 = z.infer<typeof ProjectV2Schema>;
/**
 * 执行器感知 Worker 配置 Schema（V2）
 */
export declare const WorkerV2Schema: z.ZodObject<{
    id: z.ZodString;
    node: z.ZodString;
    defaultExecutorType: z.ZodDefault<z.ZodEnum<{
        custom: "custom";
        opencode: "opencode";
        "claude-code": "claude-code";
        codex: "codex";
        gemini: "gemini";
        placeholder: "placeholder";
    }>>;
    executorRef: z.ZodOptional<z.ZodString>;
    connectMode: z.ZodDefault<z.ZodEnum<{
        pull: "pull";
        push: "push";
    }>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    projects: z.ZodArray<z.ZodPipe<z.ZodObject<{
        key: z.ZodString;
        repoPath: z.ZodString;
        baseBranch: z.ZodDefault<z.ZodString>;
        executor: z.ZodOptional<z.ZodObject<{
            type: z.ZodOptional<z.ZodEnum<{
                custom: "custom";
                opencode: "opencode";
                "claude-code": "claude-code";
                codex: "codex";
                gemini: "gemini";
                placeholder: "placeholder";
            }>>;
            executorRef: z.ZodOptional<z.ZodString>;
            config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
        openCode: z.ZodOptional<z.ZodObject<{
            port: z.ZodOptional<z.ZodNumber>;
            agent: z.ZodDefault<z.ZodString>;
            mode: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>;
        executionTimeoutMs: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        maxRetries: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    }, z.core.$strip>, z.ZodTransform<{
        key: string;
        repoPath: string;
        baseBranch: string;
        executor?: {
            type?: "custom" | "opencode" | "claude-code" | "codex" | "gemini" | "placeholder" | undefined;
            executorRef?: string | undefined;
            config?: Record<string, unknown> | undefined;
        } | undefined;
        openCode?: {
            agent: string;
            mode: string;
            port?: number | undefined;
        } | undefined;
        executionTimeoutMs?: number | undefined;
        maxRetries?: number | undefined;
    }, {
        key: string;
        repoPath: string;
        baseBranch: string;
        executor?: {
            type?: "custom" | "opencode" | "claude-code" | "codex" | "gemini" | "placeholder" | undefined;
            executorRef?: string | undefined;
            config?: Record<string, unknown> | undefined;
        } | undefined;
        openCode?: {
            agent: string;
            mode: string;
            port?: number | undefined;
        } | undefined;
        executionTimeoutMs?: number | undefined;
        maxRetries?: number | undefined;
    }>>>;
}, z.core.$strip>;
export type WorkerV2 = z.infer<typeof WorkerV2Schema>;
/**
 * Workers V2 配置 Schema
 */
export declare const WorkersV2Schema: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    node: z.ZodString;
    defaultExecutorType: z.ZodDefault<z.ZodEnum<{
        custom: "custom";
        opencode: "opencode";
        "claude-code": "claude-code";
        codex: "codex";
        gemini: "gemini";
        placeholder: "placeholder";
    }>>;
    executorRef: z.ZodOptional<z.ZodString>;
    connectMode: z.ZodDefault<z.ZodEnum<{
        pull: "pull";
        push: "push";
    }>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    projects: z.ZodArray<z.ZodPipe<z.ZodObject<{
        key: z.ZodString;
        repoPath: z.ZodString;
        baseBranch: z.ZodDefault<z.ZodString>;
        executor: z.ZodOptional<z.ZodObject<{
            type: z.ZodOptional<z.ZodEnum<{
                custom: "custom";
                opencode: "opencode";
                "claude-code": "claude-code";
                codex: "codex";
                gemini: "gemini";
                placeholder: "placeholder";
            }>>;
            executorRef: z.ZodOptional<z.ZodString>;
            config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
        openCode: z.ZodOptional<z.ZodObject<{
            port: z.ZodOptional<z.ZodNumber>;
            agent: z.ZodDefault<z.ZodString>;
            mode: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>;
        executionTimeoutMs: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        maxRetries: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    }, z.core.$strip>, z.ZodTransform<{
        key: string;
        repoPath: string;
        baseBranch: string;
        executor?: {
            type?: "custom" | "opencode" | "claude-code" | "codex" | "gemini" | "placeholder" | undefined;
            executorRef?: string | undefined;
            config?: Record<string, unknown> | undefined;
        } | undefined;
        openCode?: {
            agent: string;
            mode: string;
            port?: number | undefined;
        } | undefined;
        executionTimeoutMs?: number | undefined;
        maxRetries?: number | undefined;
    }, {
        key: string;
        repoPath: string;
        baseBranch: string;
        executor?: {
            type?: "custom" | "opencode" | "claude-code" | "codex" | "gemini" | "placeholder" | undefined;
            executorRef?: string | undefined;
            config?: Record<string, unknown> | undefined;
        } | undefined;
        openCode?: {
            agent: string;
            mode: string;
            port?: number | undefined;
        } | undefined;
        executionTimeoutMs?: number | undefined;
        maxRetries?: number | undefined;
    }>>>;
}, z.core.$strip>>;
export type WorkersV2 = z.infer<typeof WorkersV2Schema>;
//# sourceMappingURL=manifest-v2.d.ts.map