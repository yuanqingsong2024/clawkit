import { z } from 'zod';
/**
 * OpenClaw 配置 Schema
 */
export declare const OpenClawSchema: z.ZodObject<{
    node: z.ZodString;
    publicUrl: z.ZodString;
    apiKey: z.ZodOptional<z.ZodString>;
    deployMode: z.ZodDefault<z.ZodEnum<{
        local: "local";
        external: "external";
        skip: "skip";
    }>>;
}, z.core.$strip>;
/**
 * OpenCode Service 配置 Schema
 */
export declare const OpenCodeServiceSchema: z.ZodObject<{
    node: z.ZodString;
    publicUrl: z.ZodOptional<z.ZodString>;
    indices: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    allocation: z.ZodOptional<z.ZodEnum<{
        exclusive: "exclusive";
        shared: "shared";
    }>>;
    binaryPath: z.ZodOptional<z.ZodString>;
    workspace: z.ZodOptional<z.ZodString>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    installMode: z.ZodDefault<z.ZodEnum<{
        local: "local";
        external: "external";
        skip: "skip";
    }>>;
}, z.core.$strip>;
export declare const ServicesSchema: z.ZodObject<{
    controller: z.ZodObject<{
        node: z.ZodString;
        port: z.ZodDefault<z.ZodNumber>;
        apiPrefix: z.ZodDefault<z.ZodString>;
        publicUrl: z.ZodString;
    }, z.core.$strip>;
    openClaw: z.ZodObject<{
        node: z.ZodString;
        publicUrl: z.ZodString;
        apiKey: z.ZodOptional<z.ZodString>;
        deployMode: z.ZodDefault<z.ZodEnum<{
            local: "local";
            external: "external";
            skip: "skip";
        }>>;
    }, z.core.$strip>;
    openCode: z.ZodOptional<z.ZodObject<{
        node: z.ZodString;
        publicUrl: z.ZodOptional<z.ZodString>;
        indices: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        allocation: z.ZodOptional<z.ZodEnum<{
            exclusive: "exclusive";
            shared: "shared";
        }>>;
        binaryPath: z.ZodOptional<z.ZodString>;
        workspace: z.ZodOptional<z.ZodString>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        installMode: z.ZodDefault<z.ZodEnum<{
            local: "local";
            external: "external";
            skip: "skip";
        }>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const RuntimeSchema: z.ZodObject<{
    promptEngine: z.ZodObject<{
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
    memory: z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        provider: z.ZodDefault<z.ZodEnum<{
            local: "local";
            redis: "redis";
            postgres: "postgres";
        }>>;
        path: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
/**
 * Notify 配置 Schema
 */
export declare const NotifySchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    channels: z.ZodDefault<z.ZodArray<z.ZodEnum<{
        email: "email";
        webhook: "webhook";
        slack: "slack";
    }>>>;
    webhook: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodObject<{
        smtp: z.ZodOptional<z.ZodString>;
        from: z.ZodOptional<z.ZodString>;
        to: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * Deploy 配置 Schema
 */
export declare const DeploySchema: z.ZodObject<{
    timeout: z.ZodDefault<z.ZodNumber>;
    retryCount: z.ZodDefault<z.ZodNumber>;
    healthCheck: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        interval: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * Manifest 配置 Schema（主配置）
 */
export declare const ManifestSchema: z.ZodObject<{
    profile: z.ZodObject<{
        name: z.ZodString;
        version: z.ZodDefault<z.ZodString>;
        topology: z.ZodEnum<{
            "all-in-one": "all-in-one";
            hybrid: "hybrid";
            split: "split";
        }>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    nodes: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"local">;
        workDir: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"ssh">;
        host: z.ZodString;
        port: z.ZodDefault<z.ZodNumber>;
        user: z.ZodString;
        keyPath: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodString>;
        workDir: z.ZodString;
    }, z.core.$strip>], "type">>;
    services: z.ZodObject<{
        controller: z.ZodObject<{
            node: z.ZodString;
            port: z.ZodDefault<z.ZodNumber>;
            apiPrefix: z.ZodDefault<z.ZodString>;
            publicUrl: z.ZodString;
        }, z.core.$strip>;
        openClaw: z.ZodObject<{
            node: z.ZodString;
            publicUrl: z.ZodString;
            apiKey: z.ZodOptional<z.ZodString>;
            deployMode: z.ZodDefault<z.ZodEnum<{
                local: "local";
                external: "external";
                skip: "skip";
            }>>;
        }, z.core.$strip>;
        openCode: z.ZodOptional<z.ZodObject<{
            node: z.ZodString;
            publicUrl: z.ZodOptional<z.ZodString>;
            indices: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
            allocation: z.ZodOptional<z.ZodEnum<{
                exclusive: "exclusive";
                shared: "shared";
            }>>;
            binaryPath: z.ZodOptional<z.ZodString>;
            workspace: z.ZodOptional<z.ZodString>;
            env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            installMode: z.ZodDefault<z.ZodEnum<{
                local: "local";
                external: "external";
                skip: "skip";
            }>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    workers: z.ZodArray<z.ZodObject<{
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
    runtime: z.ZodObject<{
        promptEngine: z.ZodObject<{
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
        memory: z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            provider: z.ZodDefault<z.ZodEnum<{
                local: "local";
                redis: "redis";
                postgres: "postgres";
            }>>;
            path: z.ZodOptional<z.ZodString>;
            url: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>;
    notify: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        channels: z.ZodDefault<z.ZodArray<z.ZodEnum<{
            email: "email";
            webhook: "webhook";
            slack: "slack";
        }>>>;
        webhook: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodObject<{
            smtp: z.ZodOptional<z.ZodString>;
            from: z.ZodOptional<z.ZodString>;
            to: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    deploy: z.ZodOptional<z.ZodObject<{
        timeout: z.ZodDefault<z.ZodNumber>;
        retryCount: z.ZodDefault<z.ZodNumber>;
        healthCheck: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            interval: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type OpenClaw = z.infer<typeof OpenClawSchema>;
export type Services = z.infer<typeof ServicesSchema>;
export type Runtime = z.infer<typeof RuntimeSchema>;
export type Notify = z.infer<typeof NotifySchema>;
export type Deploy = z.infer<typeof DeploySchema>;
export type Manifest = z.infer<typeof ManifestSchema>;
//# sourceMappingURL=manifest.d.ts.map