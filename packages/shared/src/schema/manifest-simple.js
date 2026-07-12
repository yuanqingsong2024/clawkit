"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditableSimpleManifestSchema = exports.SimpleManifestSchema = exports.SimpleOpenClawSchema = exports.SimpleProjectSchema = void 0;
exports.convertSimpleToFullManifest = convertSimpleToFullManifest;
const zod_1 = require("zod");
/**
 * 简化版 Manifest Schema
 * 只保留核心配置：projects 和 openClaw
 * 其他配置全部使用默认值
 */
/**
 * 项目配置 Schema（简化版）
 */
exports.SimpleProjectSchema = zod_1.z.object({
    key: zod_1.z.string().min(1, '项目 key 不能为空').describe('项目唯一标识'),
    path: zod_1.z.string().min(1, '项目路径不能为空').describe('项目路径'),
    baseBranch: zod_1.z.string().default('main').describe('基础分支名称'),
    autoExecute: zod_1.z.boolean().default(false).describe('是否自动执行（true=自动执行，false=需要确认）'),
    dangerousOps: zod_1.z.array(zod_1.z.string()).default([]).describe('危险操作关键词列表，匹配到时强制审批'),
    openCodePort: zod_1.z.number().int().min(1).max(65535).default(4096).describe('OpenCode 服务端口'),
});
/**
 * OpenClaw 配置 Schema（简化版）
 */
exports.SimpleOpenClawSchema = zod_1.z.object({
    url: zod_1.z.string().url({ message: 'OpenClaw 地址必须是有效的 URL' }).optional().describe('OpenClaw 地址（可选，用于健康检查）'),
    webhookToken: zod_1.z.string().min(1, 'Webhook Token 不能为空').describe('Webhook 鉴权 Token'),
});
const SimpleManifestBaseSchema = zod_1.z.object({
    version: zod_1.z.string().default('2.0').describe('配置版本'),
    openClaw: exports.SimpleOpenClawSchema.describe('OpenClaw 配置'),
    // 可选的高级配置（使用默认值）
    controllerPort: zod_1.z.number().int().min(1).max(65535).default(8787).optional().describe('Controller 服务端口'),
    openCodeBaseUrl: zod_1.z.string().url().default('http://127.0.0.1:4096').optional().describe('OpenCode 服务基础地址'),
    dataDir: zod_1.z.string().default('./data').optional().describe('数据目录路径'),
});
/**
 * 简化版 Manifest Schema
 */
exports.SimpleManifestSchema = SimpleManifestBaseSchema.extend({
    projects: zod_1.z.array(exports.SimpleProjectSchema).min(1, '至少需要配置一个项目').describe('项目列表'),
}).superRefine((manifest, ctx) => {
    // 检查项目 key 是否重复
    const projectKeys = new Set();
    manifest.projects.forEach((project, index) => {
        if (projectKeys.has(project.key)) {
            ctx.addIssue({
                code: 'custom',
                path: ['projects', index, 'key'],
                message: `项目 key 重复：${project.key}`,
            });
        }
        projectKeys.add(project.key);
    });
});
/**
 * 可编辑的简化版 Manifest Schema
 * 允许项目列表为空，用于 Web 管理场景下的中间态保存。
 */
exports.EditableSimpleManifestSchema = SimpleManifestBaseSchema.extend({
    projects: zod_1.z.array(exports.SimpleProjectSchema).describe('项目列表'),
}).superRefine((manifest, ctx) => {
    const projectKeys = new Set();
    manifest.projects.forEach((project, index) => {
        if (projectKeys.has(project.key)) {
            ctx.addIssue({
                code: 'custom',
                path: ['projects', index, 'key'],
                message: `项目 key 重复：${project.key}`,
            });
        }
        projectKeys.add(project.key);
    });
});
/**
 * 从简化版 Manifest 转换为完整版 Manifest
 * 用于向后兼容
 */
function convertSimpleToFullManifest(simple) {
    const workerProjects = simple.projects.map((project) => ({
        key: project.key,
        repoPath: project.path,
        baseBranch: project.baseBranch,
        openCode: {
            port: project.openCodePort,
            agent: 'build',
            mode: 'default',
        },
        executionTimeoutMs: 1800000,
        maxRetries: 3,
    }));
    return {
        profile: {
            name: 'clawkit-simple',
            version: simple.version,
            topology: 'all-in-one',
        },
        nodes: {
            'local-dev': {
                type: 'local',
                workDir: './.clawkit/local-dev',
            },
        },
        services: {
            controller: {
                node: 'local-dev',
                port: simple.controllerPort || 8787,
                apiPrefix: '/api',
                publicUrl: `http://127.0.0.1:${simple.controllerPort || 8787}`,
            },
            openClaw: {
                node: 'local-dev',
                deployMode: 'external',
                publicUrl: simple.openClaw.url || 'http://127.0.0.1:18000',
                apiKey: simple.openClaw.webhookToken,
            },
            openCode: {
                node: 'local-dev',
                installMode: 'external',
                publicUrl: simple.openCodeBaseUrl || 'http://127.0.0.1:4096',
            },
        },
        // 简化配置默认使用单 worker 管理多个本地项目，降低生成结果的噪音。
        workers: [
            {
                id: 'local-worker',
                node: 'local-dev',
                connectMode: 'pull',
                tags: ['local'],
                projects: workerProjects,
            },
        ],
        runtime: {
            promptEngine: {
                mode: 'template',
                temperature: 0.7,
                maxTokens: 4096,
                timeoutMs: 30000,
            },
            memory: {
                enabled: true,
                provider: 'local',
                path: `${simple.dataDir || './data'}/memory`,
            },
        },
        notify: {
            enabled: false,
            channels: [],
        },
        deploy: {
            timeout: 300,
            retryCount: 2,
            healthCheck: {
                enabled: true,
                interval: 30,
            },
        },
    };
}
//# sourceMappingURL=manifest-simple.js.map