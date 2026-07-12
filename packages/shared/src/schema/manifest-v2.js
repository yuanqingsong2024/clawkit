"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkersV2Schema = exports.WorkerV2Schema = exports.ProjectV2Schema = exports.TriggersSchema = exports.TriggerInstanceSchema = exports.TriggerTypeEnum = exports.ExecutorsSchema = exports.ExecutorOverrideSchema = exports.ExecutorInstanceSchema = exports.ExecutorTypeEnum = void 0;
const zod_1 = require("zod");
/**
 * 执行器类型枚举
 */
exports.ExecutorTypeEnum = zod_1.z.enum([
    'opencode', // OpenCode 服务
    'claude-code', // Claude Code CLI
    'codex', // OpenAI Codex CLI
    'gemini', // Google Gemini CLI
    'placeholder', // 占位执行器（仅用于测试）
    'custom', // 自定义执行器
]);
/**
 * 执行器实例配置 Schema
 */
exports.ExecutorInstanceSchema = zod_1.z.object({
    /** 执行器类型 */
    type: exports.ExecutorTypeEnum.describe('执行器类型'),
    /** 节点引用 */
    node: zod_1.z.string().min(1).describe('执行器所在节点'),
    /** 执行器服务地址 */
    publicUrl: zod_1.z.string().url().optional().describe('执行器对外访问地址'),
    /** 执行器端口 */
    port: zod_1.z.number().int().min(1).max(65535).optional().describe('执行器服务端口'),
    /** 认证密码环境变量名 */
    passwordEnv: zod_1.z.string().optional().describe('密码环境变量名'),
    /** 二进制路径（适用于 CLI 类型执行器） */
    binaryPath: zod_1.z.string().optional().describe('执行器二进制文件路径'),
    /** 工作空间路径 */
    workspace: zod_1.z.string().optional().describe('执行器工作空间路径'),
    /** 代理类型 */
    agent: zod_1.z.string().default('build').optional().describe('代理类型'),
    /** 运行模式 */
    mode: zod_1.z.string().default('default').optional().describe('运行模式'),
    /** 索引列表（用于多实例场景） */
    indices: zod_1.z.array(zod_1.z.number().int().min(0)).optional().describe('实例索引列表'),
    /** 实例分配模式 */
    allocation: zod_1.z.enum(['exclusive', 'shared']).default('shared').optional().describe('实例分配模式'),
    /** 安装模式 */
    installMode: zod_1.z.enum(['local', 'external', 'skip']).default('external').optional().describe('安装模式'),
    /** 额外环境变量 */
    env: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional().describe('额外环境变量'),
    /** 允许降级到占位执行器 */
    fallbackToPlaceholder: zod_1.z.boolean().default(false).optional().describe('执行器不可用时是否降级到占位执行器'),
});
/**
 * 项目级执行器覆盖配置 Schema
 */
exports.ExecutorOverrideSchema = zod_1.z.object({
    /** 执行器类型（覆盖全局默认） */
    type: exports.ExecutorTypeEnum.optional().describe('执行器类型（可选）'),
    /** 执行器引用名称（引用 executors 中定义的实例） */
    executorRef: zod_1.z.string().optional().describe('执行器实例引用'),
    /** 执行器特定配置 */
    config: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().describe('执行器配置'),
});
/**
 * 执行器定义 Schema
 * 定义系统中可用的执行器实例
 */
exports.ExecutorsSchema = zod_1.z.record(zod_1.z.string().min(1), // 执行器名称作为 key
exports.ExecutorInstanceSchema).describe('执行器定义表');
/**
 * 触发器类型枚举
 */
exports.TriggerTypeEnum = zod_1.z.enum([
    'claude-code', // Claude Code webhook
    'claude-code', // Claude Code webhook
    'github', // GitHub webhook
    'slack', // Slack 应用
    'feishu', // 飞书应用
    'http', // 通用 HTTP webhook
    'custom', // 自定义触发器
]);
/**
 * 触发器实例配置 Schema
 */
exports.TriggerInstanceSchema = zod_1.z.object({
    /** 触发器类型 */
    type: exports.TriggerTypeEnum.describe('触发器类型'),
    /** 触发器名称 */
    name: zod_1.z.string().min(1).describe('触发器名称'),
    /** Webhook 路径 */
    webhookPath: zod_1.z.string().default('/api/trigger/:name').describe('Webhook 接收路径'),
    /** 认证 token 环境变量名 */
    authTokenEnv: zod_1.z.string().optional().describe('认证 token 环境变量名'),
    /** 触发器特定配置 */
    config: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().describe('触发器配置'),
    /** 是否启用 */
    enabled: zod_1.z.boolean().default(true).describe('是否启用此触发器'),
});
/**
 * 触发器定义 Schema
 * 定义系统中可用的触发器实例
 */
exports.TriggersSchema = zod_1.z.record(zod_1.z.string().min(1), // 触发器名称作为 key
exports.TriggerInstanceSchema).describe('触发器定义表');
/**
 * 执行器感知项目配置 Schema（V2）
 * 支持执行器覆盖的项目配置
 */
exports.ProjectV2Schema = zod_1.z.object({
    key: zod_1.z.string().min(1, '项目 key 不能为空').describe('项目唯一标识'),
    repoPath: zod_1.z.string().min(1, '仓库路径不能为空').describe('项目仓库路径'),
    baseBranch: zod_1.z.string().default('main').describe('基础分支名称'),
    /** 执行器覆盖配置 */
    executor: exports.ExecutorOverrideSchema.optional().describe('执行器覆盖配置'),
    /** 旧版 OpenCode 配置（V1 兼容）【已废弃，请使用 executor】 */
    openCode: zod_1.z.object({
        port: zod_1.z.number().int().min(1).max(65535).optional(),
        agent: zod_1.z.string().default('build'),
        mode: zod_1.z.string().default('default'),
    }).optional().describe('【V1 兼容·已废弃】请使用 executor 配置'),
    executionTimeoutMs: zod_1.z.number().int().min(1000).default(1800000).optional().describe('任务执行超时时间（毫秒），默认 30 分钟'),
    maxRetries: zod_1.z.number().int().min(0).max(10).default(3).optional().describe('任务失败最大重试次数，默认 3 次'),
}).transform((project) => {
    // 如果配置了旧版 openCode，自动转换为新的 executor 配置
    if (project.openCode && !project.executor) {
        return {
            ...project,
            executor: {
                type: 'opencode',
                config: {
                    port: project.openCode.port ?? 4096,
                    agent: project.openCode.agent,
                    mode: project.openCode.mode,
                },
            },
            openCode: undefined, // 移除旧版配置
        };
    }
    return project;
});
/**
 * 执行器感知 Worker 配置 Schema（V2）
 */
exports.WorkerV2Schema = zod_1.z.object({
    id: zod_1.z.string().min(1, 'Worker ID 不能为空').describe('Worker 唯一标识'),
    node: zod_1.z.string().min(1, 'Node 引用不能为空').describe('Worker 所在节点的引用'),
    /** 默认执行器类型 */
    defaultExecutorType: exports.ExecutorTypeEnum.default('opencode').describe('默认执行器类型'),
    /** 执行器引用（引用 executors 中定义的实例） */
    executorRef: zod_1.z.string().optional().describe('执行器实例引用'),
    connectMode: zod_1.z.enum(['pull', 'push']).default('pull').describe('连接模式'),
    tags: zod_1.z.array(zod_1.z.string()).default([]).describe('Worker 标签'),
    projects: zod_1.z.array(exports.ProjectV2Schema).min(1, '至少需要配置一个项目').describe('Worker 管理的项目列表'),
});
/**
 * Workers V2 配置 Schema
 */
exports.WorkersV2Schema = zod_1.z.array(exports.WorkerV2Schema).min(1, '至少需要配置一个 Worker');
//# sourceMappingURL=manifest-v2.js.map