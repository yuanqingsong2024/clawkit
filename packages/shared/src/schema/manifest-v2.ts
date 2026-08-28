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
export const ExecutorTypeEnum = z.enum([
  'opencode',      // OpenCode 服务
  'claude-code',   // Claude Code CLI
  'codex',         // OpenAI Codex CLI
  'gemini',        // Google Gemini CLI
  'placeholder',   // 占位执行器（仅用于测试）
  'custom',        // 自定义执行器
]);
export type ExecutorType = z.infer<typeof ExecutorTypeEnum>;

/**
 * 执行器实例配置 Schema
 */
export const ExecutorInstanceSchema = z.object({
  /** 执行器类型 */
  type: ExecutorTypeEnum.describe('执行器类型'),
  /** 节点引用 */
  node: z.string().min(1).describe('执行器所在节点'),
  /** 执行器服务地址 */
  publicUrl: z.string().url().optional().describe('执行器对外访问地址'),
  /** 执行器端口 */
  port: z.number().int().min(1).max(65535).optional().describe('执行器服务端口'),
  /** 认证密码环境变量名 */
  passwordEnv: z.string().optional().describe('密码环境变量名'),
  /** 二进制路径（适用于 CLI 类型执行器） */
  binaryPath: z.string().optional().describe('执行器二进制文件路径'),
  /** 工作空间路径 */
  workspace: z.string().optional().describe('执行器工作空间路径'),
  /** 代理类型 */
  agent: z.string().default('build').optional().describe('代理类型'),
  /** 运行模式 */
  mode: z.string().default('default').optional().describe('运行模式'),
  /** 索引列表（用于多实例场景） */
  indices: z.array(z.number().int().min(0)).optional().describe('实例索引列表'),
  /** 实例分配模式 */
  allocation: z.enum(['exclusive', 'shared']).default('shared').optional().describe('实例分配模式'),
  /** 安装模式 */
  installMode: z.enum(['local', 'external', 'skip']).default('external').optional().describe('安装模式'),
  /** 额外环境变量 */
  env: z.record(z.string(), z.string()).optional().describe('额外环境变量'),
  /** 允许降级到占位执行器 */
  fallbackToPlaceholder: z.boolean().default(false).optional().describe('执行器不可用时是否降级到占位执行器'),
});
export type ExecutorInstance = z.infer<typeof ExecutorInstanceSchema>;

/**
 * 项目级执行器覆盖配置 Schema
 */
export const ExecutorOverrideSchema = z.object({
  /** 执行器类型（覆盖全局默认） */
  type: ExecutorTypeEnum.optional().describe('执行器类型（可选）'),
  /** 执行器引用名称（引用 executors 中定义的实例） */
  executorRef: z.string().optional().describe('执行器实例引用'),
  /** 执行器特定配置 */
  config: z.record(z.string(), z.unknown()).optional().describe('执行器配置'),
});
export type ExecutorOverride = z.infer<typeof ExecutorOverrideSchema>;

/**
 * 执行器定义 Schema
 * 定义系统中可用的执行器实例
 */
export const ExecutorsSchema = z.record(
  z.string().min(1),  // 执行器名称作为 key
  ExecutorInstanceSchema,
).describe('执行器定义表');
export type Executors = z.infer<typeof ExecutorsSchema>;

/**
 * 触发器类型枚举
 */
export const TriggerTypeEnum = z.enum([
  'claude-code',       // Claude Code webhook
  'claude-code',    // Claude Code webhook
  'github',         // GitHub webhook
  'slack',          // Slack 应用
  'feishu',         // 飞书应用
  'http',           // 通用 HTTP webhook
  'custom',         // 自定义触发器
]);
export type TriggerType = z.infer<typeof TriggerTypeEnum>;

/**
 * 触发器实例配置 Schema
 */
export const TriggerInstanceSchema = z.object({
  /** 触发器类型 */
  type: TriggerTypeEnum.describe('触发器类型'),
  /** 触发器名称 */
  name: z.string().min(1).describe('触发器名称'),
  /** Webhook 路径 */
  webhookPath: z.string().default('/api/trigger/:name').describe('Webhook 接收路径'),
  /** 认证 token 环境变量名 */
  authTokenEnv: z.string().optional().describe('认证 token 环境变量名'),
  /** 触发器特定配置 */
  config: z.record(z.string(), z.unknown()).optional().describe('触发器配置'),
  /** 是否启用 */
  enabled: z.boolean().default(true).describe('是否启用此触发器'),
});
export type TriggerInstance = z.infer<typeof TriggerInstanceSchema>;

/**
 * 触发器定义 Schema
 * 定义系统中可用的触发器实例
 */
export const TriggersSchema = z.record(
  z.string().min(1),  // 触发器名称作为 key
  TriggerInstanceSchema,
).describe('触发器定义表');
export type Triggers = z.infer<typeof TriggersSchema>;

/**
 * 执行器感知项目配置 Schema（V2）
 * 支持执行器覆盖的项目配置
 */
export const ProjectV2Schema = z.object({
  key: z.string().min(1, '项目 key 不能为空').describe('项目唯一标识'),
  repoPath: z.string().min(1, '仓库路径不能为空').describe('项目仓库路径'),
  baseBranch: z.string().default('main').describe('基础分支名称'),
  /** 执行器覆盖配置 */
  executor: ExecutorOverrideSchema.optional().describe('执行器覆盖配置'),
  /** 旧版 OpenCode 配置（V1 兼容）【已废弃，请使用 executor】 */
  openCode: z.object({
    port: z.number().int().min(1).max(65535).optional(),
    agent: z.string().default('build'),
    mode: z.string().default('default'),
  }).optional().describe('【V1 兼容·已废弃】请使用 executor 配置'),
  executionTimeoutMs: z.number().int().min(1000).default(1800000).optional().describe('任务执行超时时间（毫秒），默认 30 分钟'),
  maxRetries: z.number().int().min(0).max(10).default(3).optional().describe('任务失败最大重试次数，默认 3 次'),
}).transform((project) => {
  // 如果配置了旧版 openCode，自动转换为新的 executor 配置
  if (project.openCode && !project.executor) {
    return {
      ...project,
      executor: {
        type: 'opencode' as const,
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
export type ProjectV2 = z.infer<typeof ProjectV2Schema>;

/**
 * 执行器感知 Worker 配置 Schema（V2）
 */
export const WorkerV2Schema = z.object({
  id: z.string().min(1, 'Worker ID 不能为空').describe('Worker 唯一标识'),
  node: z.string().min(1, 'Node 引用不能为空').describe('Worker 所在节点的引用'),
  /** 默认执行器类型 */
  defaultExecutorType: ExecutorTypeEnum.default('opencode').describe('默认执行器类型'),
  /** 执行器引用（引用 executors 中定义的实例） */
  executorRef: z.string().optional().describe('执行器实例引用'),
  connectMode: z.enum(['pull', 'push']).default('pull').describe('连接模式'),
  tags: z.array(z.string()).default([]).describe('Worker 标签'),
  projects: z.array(ProjectV2Schema).min(1, '至少需要配置一个项目').describe('Worker 管理的项目列表'),
});
export type WorkerV2 = z.infer<typeof WorkerV2Schema>;

/**
 * Workers V2 配置 Schema
 */
export const WorkersV2Schema = z.array(WorkerV2Schema).min(1, '至少需要配置一个 Worker');
export type WorkersV2 = z.infer<typeof WorkersV2Schema>;

/** V2 Manifest 顶层配置。基础字段保持与 V1 一致，同时增加执行器和触发器定义。 */
export const ManifestV2Schema = z.object({
  version: z.string().optional(),
  profile: z.object({
    name: z.string().min(1),
    version: z.string().optional(),
    topology: z.enum(['all-in-one', 'hybrid', 'split']),
    description: z.string().optional(),
  }),
  nodes: z.record(z.string(), z.object({
    type: z.enum(['local', 'ssh']),
    workDir: z.string().optional(),
    host: z.string().optional(),
    port: z.number().int().min(1).max(65535).optional(),
    username: z.string().optional(),
    keyPath: z.string().optional(),
    password: z.string().optional(),
  })),
  services: z.record(z.string(), z.unknown()),
  runtime: z.record(z.string(), z.unknown()),
  workers: WorkersV2Schema,
  executors: ExecutorsSchema.default({}),
  triggers: TriggersSchema.default({}),
  notify: z.record(z.string(), z.unknown()).optional(),
  deploy: z.record(z.string(), z.unknown()).optional(),
});
export type ManifestV2 = z.infer<typeof ManifestV2Schema>;
