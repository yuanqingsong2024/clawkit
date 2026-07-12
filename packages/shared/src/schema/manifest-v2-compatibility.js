"use strict";
/**
 * V1 到 V2 Manifest 配置转换工具
 *
 * 提供 V1 配置向 V2 配置的自动转换能力，确保向后兼容。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertV1ToV2 = convertV1ToV2;
exports.detectManifestVersion = detectManifestVersion;
const zod_1 = require("zod");
/**
 * V1 Manifest 简化配置 Schema
 */
const V1SimpleManifestSchema = zod_1.z.object({
    version: zod_1.z.string().optional(),
    profile: zod_1.z.object({
        name: zod_1.z.string(),
        version: zod_1.z.string().optional(),
        topology: zod_1.z.enum(['all-in-one', 'hybrid', 'split']).optional(),
        description: zod_1.z.string().optional(),
    }).optional(),
    projects: zod_1.z.array(zod_1.z.object({
        key: zod_1.z.string(),
        path: zod_1.z.string(),
        baseBranch: zod_1.z.string().optional(),
        autoExecute: zod_1.z.boolean().optional(),
        dangerousOps: zod_1.z.array(zod_1.z.string()).optional(),
        openCodePort: zod_1.z.number().optional(),
    })).optional(),
    openClaw: zod_1.z.object({
        url: zod_1.z.string().optional(),
        webhookToken: zod_1.z.string(),
    }).optional(),
    controllerPort: zod_1.z.number().optional(),
    openCodeBaseUrl: zod_1.z.string().optional(),
    dataDir: zod_1.z.string().optional(),
});
/**
 * V1 Manifest 完整配置 Schema
 */
const V1FullManifestSchema = zod_1.z.object({
    version: zod_1.z.string().optional(),
    profile: zod_1.z.object({
        name: zod_1.z.string(),
        version: zod_1.z.string().optional(),
        topology: zod_1.z.enum(['all-in-one', 'hybrid', 'split']),
        description: zod_1.z.string().optional(),
    }),
    nodes: zod_1.z.record(zod_1.z.string(), zod_1.z.object({
        type: zod_1.z.enum(['local', 'ssh']),
        host: zod_1.z.string().optional(),
        port: zod_1.z.number().optional(),
        username: zod_1.z.string().optional(),
        keyPath: zod_1.z.string().optional(),
        password: zod_1.z.string().optional(),
    })),
    services: zod_1.z.object({
        controller: zod_1.z.object({
            node: zod_1.z.string(),
            port: zod_1.z.number().optional(),
            publicUrl: zod_1.z.string().optional(),
        }),
        openClaw: zod_1.z.object({
            node: zod_1.z.string(),
            publicUrl: zod_1.z.string(),
            apiKey: zod_1.z.string().optional(),
            deployMode: zod_1.z.enum(['local', 'external', 'skip']).optional(),
        }),
        openCode: zod_1.z.object({
            node: zod_1.z.string().optional(),
            publicUrl: zod_1.z.string().optional(),
            installMode: zod_1.z.enum(['local', 'external', 'skip']).optional(),
        }).optional(),
    }),
    workers: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        node: zod_1.z.string(),
        connectMode: zod_1.z.enum(['pull', 'push']).optional(),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        projects: zod_1.z.array(zod_1.z.object({
            key: zod_1.z.string(),
            repoPath: zod_1.z.string(),
            baseBranch: zod_1.z.string().optional(),
            openCode: zod_1.z.object({
                port: zod_1.z.number().optional(),
                agent: zod_1.z.string().optional(),
                mode: zod_1.z.string().optional(),
            }).optional(),
            executionTimeoutMs: zod_1.z.number().optional(),
            maxRetries: zod_1.z.number().optional(),
        })),
    })),
    runtime: zod_1.z.object({
        promptEngine: zod_1.z.object({
            mode: zod_1.z.enum(['template', 'llm', 'hybrid']).optional(),
            provider: zod_1.z.string().optional(),
            apiKeyEnv: zod_1.z.string().optional(),
            model: zod_1.z.string().optional(),
        }).optional(),
        memory: zod_1.z.object({
            enabled: zod_1.z.boolean().optional(),
            provider: zod_1.z.enum(['local', 'redis', 'postgres']).optional(),
            path: zod_1.z.string().optional(),
        }).optional(),
    }).optional(),
    notify: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    deploy: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * V1 简化配置转换为 V2
 */
function convertSimpleToV2(simple, options) {
    const warnings = [];
    const errors = [];
    try {
        // 1. 构建 V2 profile
        const profile = {
            name: simple.profile?.name ?? 'converted-from-v1',
            version: simple.profile?.version ?? '1.0.0',
            topology: simple.profile?.topology ?? 'all-in-one',
            description: simple.profile?.description ?? '由 V1 简化配置自动转换',
        };
        // 2. 构建 V2 nodes
        const nodes = {
            'local': { type: 'local' },
        };
        // 3. 构建 V2 executors
        const executors = {
            'default-opencode': {
                type: 'opencode',
                node: 'local',
                port: 4096,
                installMode: 'skip',
                fallbackToPlaceholder: options.defaultExecutorType === 'placeholder',
            },
        };
        // 4. 构建 V2 triggers
        const triggers = {
            'claude-code': {
                type: 'claude-code',
                name: 'claude-code',
                webhookPath: '/api/trigger/claude-code',
                authTokenEnv: 'CLAUDE_CODE_WEBHOOK_TOKEN',
                enabled: true,
            },
        };
        // 5. 构建 V2 services
        const services = {
            controller: {
                node: 'local',
                port: simple.controllerPort ?? 8787,
                publicUrl: `http://127.0.0.1:${simple.controllerPort ?? 8787}`,
            },
            openClaw: {
                node: 'local',
                publicUrl: simple.openClaw?.url ?? 'http://127.0.0.1:18000',
                deployMode: 'skip',
            },
        };
        // 6. 构建 V2 workers
        const workers = (simple.projects ?? []).map((project, index) => {
            if (!project.path) {
                warnings.push({
                    path: `projects[${index}].path`,
                    message: '项目路径为空',
                    suggestion: '请提供有效的项目仓库路径',
                });
            }
            return {
                id: `worker-${project.key}`,
                node: 'local',
                defaultExecutorType: options.defaultExecutorType ?? 'opencode',
                executorRef: 'default-opencode',
                connectMode: 'pull',
                tags: [],
                projects: [{
                        key: project.key,
                        repoPath: project.path,
                        baseBranch: project.baseBranch ?? 'main',
                        executor: {
                            type: 'opencode',
                            config: {
                                port: project.openCodePort ?? 4096,
                                agent: 'build',
                                mode: 'default',
                            },
                        },
                    }],
            };
        });
        // 7. 构建 V2 runtime
        const runtime = {
            promptEngine: {
                mode: 'template',
            },
            memory: {
                enabled: true,
                provider: 'local',
                path: './data/memory',
            },
        };
        return {
            success: true,
            v2Manifest: {
                version: '2.0',
                profile,
                nodes,
                executors,
                triggers,
                services,
                workers,
                runtime,
            },
            warnings,
            errors,
        };
    }
    catch (error) {
        errors.push(`转换失败：${error instanceof Error ? error.message : String(error)}`);
        return {
            success: false,
            v2Manifest: {},
            warnings,
            errors,
        };
    }
}
/**
 * V1 完整配置转换为 V2
 */
function convertFullToV2(full, options) {
    const warnings = [];
    const errors = [];
    try {
        // 1. 直接使用现有结构，添加 executors 和 triggers
        const executors = {};
        // 转换 openCode 配置为执行器
        if (full.services.openCode) {
            executors['default-opencode'] = {
                type: 'opencode',
                node: full.services.openCode.node ?? 'local',
                publicUrl: full.services.openCode.publicUrl,
                installMode: full.services.openCode.installMode ?? 'skip',
            };
        }
        // 2. 添加触发器
        const triggers = {
            'claude-code': {
                type: 'claude-code',
                name: 'claude-code',
                webhookPath: '/api/trigger/claude-code',
                authTokenEnv: 'CLAUDE_CODE_WEBHOOK_TOKEN',
                enabled: true,
            },
        };
        // 3. 转换 workers 为 V2 格式
        const workers = full.workers.map((worker) => ({
            id: worker.id,
            node: worker.node,
            defaultExecutorType: options.defaultExecutorType ?? 'opencode',
            executorRef: 'default-opencode',
            connectMode: worker.connectMode ?? 'pull',
            tags: worker.tags ?? [],
            projects: worker.projects.map((project) => ({
                key: project.key,
                repoPath: project.repoPath,
                baseBranch: project.baseBranch ?? 'main',
                executor: {
                    type: 'opencode',
                    config: {
                        port: project.openCode?.port ?? 4096,
                        agent: project.openCode?.agent ?? 'build',
                        mode: project.openCode?.mode ?? 'default',
                    },
                },
                executionTimeoutMs: project.executionTimeoutMs ?? 1800000,
                maxRetries: project.maxRetries ?? 3,
            })),
        }));
        // 4. 如果原配置有 OpenCode 配置，转换到 workers 的 executor 配置中
        if (!executors['default-opencode'] && full.services.openCode) {
            executors['default-opencode'] = {
                type: 'opencode',
                node: full.services.openCode.node ?? Object.keys(full.nodes)[0],
                publicUrl: full.services.openCode.publicUrl,
                installMode: full.services.openCode.installMode ?? 'skip',
            };
        }
        return {
            success: true,
            v2Manifest: {
                ...full,
                version: '2.0',
                executors,
                triggers,
                workers,
            },
            warnings,
            errors,
        };
    }
    catch (error) {
        errors.push(`转换失败：${error instanceof Error ? error.message : String(error)}`);
        return {
            success: false,
            v2Manifest: {},
            warnings,
            errors,
        };
    }
}
/**
 * 将 V1 Manifest 配置转换为 V2
 *
 * @param v1Manifest V1 版本的配置对象
 * @param options 转换选项
 * @returns 转换结果，包含 V2 配置和警告/错误信息
 *
 * @example
 * ```typescript
 * const v1Config = { profile: { name: 'my-app' }, projects: [...] };
 * const result = convertV1ToV2(v1Config);
 * if (result.success) {
 *   console.log('V2 Config:', result.v2Manifest);
 *   result.warnings.forEach(w => console.warn(w.message));
 * }
 * ```
 */
function convertV1ToV2(v1Manifest, options = {}) {
    // 尝试解析为简化配置
    const simpleResult = V1SimpleManifestSchema.safeParse(v1Manifest);
    if (simpleResult.success) {
        return convertSimpleToV2(simpleResult.data, options);
    }
    // 尝试解析为完整配置
    const fullResult = V1FullManifestSchema.safeParse(v1Manifest);
    if (fullResult.success) {
        return convertFullToV2(fullResult.data, options);
    }
    // 两个都失败，返回错误
    const errors = [];
    if (!simpleResult.success) {
        errors.push(`V1 简化配置解析失败：${simpleResult.error.message}`);
    }
    if (!fullResult.success) {
        errors.push(`V1 完整配置解析失败：${fullResult.error.message}`);
    }
    return {
        success: false,
        v2Manifest: {},
        warnings: [],
        errors,
    };
}
/**
 * 检测配置版本
 *
 * @param manifest 配置对象
 * @returns 'v1-simple' | 'v1-full' | 'v2' | 'unknown'
 */
function detectManifestVersion(manifest) {
    if (!manifest || typeof manifest !== 'object') {
        return 'unknown';
    }
    const obj = manifest;
    // V2 特征：包含 executors 或 triggers 字段
    if (obj.executors !== undefined || obj.triggers !== undefined) {
        return 'v2';
    }
    // V1 简化配置特征：有 profile 和 projects，无 nodes
    if (obj.profile !== undefined && obj.projects !== undefined && obj.nodes === undefined) {
        return 'v1-simple';
    }
    // V1 完整配置特征：有 profile、nodes、services
    if (obj.profile !== undefined && obj.nodes !== undefined && obj.services !== undefined) {
        return 'v1-full';
    }
    return 'unknown';
}
//# sourceMappingURL=manifest-v2-compatibility.js.map