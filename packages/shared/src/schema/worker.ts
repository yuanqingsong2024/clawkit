import { z } from 'zod';
import { ProjectSchema } from './project';

/**
 * Worker 连接模式枚举
 */
export const ConnectModeSchema = z.enum(['pull', 'push']);

/**
 * Worker 配置 Schema
 */
export const WorkerSchema = z.object({
  id: z.string().min(1, 'Worker ID 不能为空').describe('Worker 唯一标识'),
  node: z.string().min(1, 'Node 引用不能为空').describe('Worker 所在节点的引用'),
  connectMode: ConnectModeSchema.default('pull').describe('连接模式：pull 或 push'),
  tags: z.array(z.string()).default([]).describe('Worker 标签，用于任务分配'),
  projects: z.array(ProjectSchema).min(1, '至少需要配置一个项目').describe('Worker 管理的项目列表'),
});

/**
 * Workers 配置 Schema
 */
export const WorkersSchema = z.array(WorkerSchema).min(1, '至少需要配置一个 Worker').describe('Worker 列表');

export type ConnectMode = z.infer<typeof ConnectModeSchema>;
export type Worker = z.infer<typeof WorkerSchema>;
export type Workers = z.infer<typeof WorkersSchema>;
