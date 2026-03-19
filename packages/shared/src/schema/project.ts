import { z } from 'zod';

/**
 * OpenCode 配置 Schema
 */
export const OpenCodeConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).describe('OpenCode 服务端口'),
  agent: z.string().default('build').describe('OpenCode 代理类型'),
  mode: z.string().default('default').describe('OpenCode 运行模式'),
});

/**
 * Project 配置 Schema
 */
export const ProjectSchema = z.object({
  key: z.string().min(1, '项目 key 不能为空').describe('项目唯一标识'),
  repoPath: z.string().min(1, '仓库路径不能为空').describe('项目仓库路径'),
  baseBranch: z.string().default('main').describe('基础分支名称'),
  openCode: OpenCodeConfigSchema.describe('OpenCode 配置'),
});

export type OpenCodeConfig = z.infer<typeof OpenCodeConfigSchema>;
export type Project = z.infer<typeof ProjectSchema>;
