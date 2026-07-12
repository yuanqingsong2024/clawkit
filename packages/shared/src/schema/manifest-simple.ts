import { z } from 'zod';

/**
 * 简化版 Manifest Schema
 * 只保留核心配置：projects 和 openClaw
 * 其他配置全部使用默认值
 */

/**
 * 项目配置 Schema（简化版）
 */
export const SimpleProjectSchema = z.object({
  key: z.string().min(1, '项目 key 不能为空').describe('项目唯一标识'),
  path: z.string().min(1, '项目路径不能为空').describe('项目路径'),
  baseBranch: z.string().default('main').describe('基础分支名称'),
  autoExecute: z.boolean().default(false).describe('是否自动执行（true=自动执行，false=需要确认）'),
  dangerousOps: z.array(z.string()).default([]).describe('危险操作关键词列表，匹配到时强制审批'),
  openCodePort: z.number().int().min(1).max(65535).default(4096).describe('OpenCode 服务端口'),
});

/**
 * OpenClaw 配置 Schema（简化版）
 */
export const SimpleOpenClawSchema = z.object({
  url: z.string().url({ message: 'OpenClaw 地址必须是有效的 URL' }).optional().describe('OpenClaw 地址（可选，用于健康检查）'),
  webhookToken: z.string().min(1, 'Webhook Token 不能为空').describe('Webhook 鉴权 Token'),
});

const SimpleManifestBaseSchema = z.object({
  version: z.string().default('2.0').describe('配置版本'),
  openClaw: SimpleOpenClawSchema.describe('OpenClaw 配置'),
  
  // 可选的高级配置（使用默认值）
  controllerPort: z.number().int().min(1).max(65535).default(8787).optional().describe('Controller 服务端口'),
  openCodeBaseUrl: z.string().url().default('http://127.0.0.1:4096').optional().describe('OpenCode 服务基础地址'),
  dataDir: z.string().default('./data').optional().describe('数据目录路径'),
});

/**
 * 简化版 Manifest Schema
 */
export const SimpleManifestSchema = SimpleManifestBaseSchema.extend({
  projects: z.array(SimpleProjectSchema).min(1, '至少需要配置一个项目').describe('项目列表'),
}).superRefine((manifest, ctx) => {
  // 检查项目 key 是否重复
  const projectKeys = new Set<string>();
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
export const EditableSimpleManifestSchema = SimpleManifestBaseSchema.extend({
  projects: z.array(SimpleProjectSchema).describe('项目列表'),
}).superRefine((manifest, ctx) => {
  const projectKeys = new Set<string>();
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

export type SimpleProject = z.infer<typeof SimpleProjectSchema>;
export type SimpleOpenClaw = z.infer<typeof SimpleOpenClawSchema>;
export type SimpleManifest = z.infer<typeof SimpleManifestSchema>;
export type EditableSimpleManifest = z.infer<typeof EditableSimpleManifestSchema>;

/**
 * 从简化版 Manifest 转换为完整版 Manifest
 * 用于向后兼容
 */
export function convertSimpleToFullManifest(simple: SimpleManifest | EditableSimpleManifest): any {
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
