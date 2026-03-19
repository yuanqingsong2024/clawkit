import { z } from 'zod';

/**
 * Node 类型枚举
 */
export const NodeTypeSchema = z.enum(['local', 'ssh']);

/**
 * Local Node Schema
 */
export const LocalNodeSchema = z.object({
  type: z.literal('local'),
  workDir: z.string().optional().describe('工作目录，默认为当前目录'),
});

/**
 * SSH Node Schema
 */
export const SshNodeSchema = z.object({
  type: z.literal('ssh'),
  host: z.string().min(1, '主机地址不能为空'),
  port: z.number().int().min(1).max(65535).default(22).describe('SSH 端口'),
  user: z.string().min(1, '用户名不能为空'),
  keyPath: z.string().optional().describe('SSH 私钥路径'),
  password: z.string().optional().describe('SSH 密码（不推荐，建议使用私钥）'),
  workDir: z.string().describe('远程工作目录'),
});

/**
 * Node Schema（联合类型）
 */
export const NodeSchema = z.discriminatedUnion('type', [
  LocalNodeSchema,
  SshNodeSchema,
]);

/**
 * Nodes 配置 Schema
 */
export const NodesSchema = z.record(z.string(), NodeSchema).describe('节点配置映射');

export type NodeType = z.infer<typeof NodeTypeSchema>;
export type LocalNode = z.infer<typeof LocalNodeSchema>;
export type SshNode = z.infer<typeof SshNodeSchema>;
export type Node = z.infer<typeof NodeSchema>;
export type Nodes = z.infer<typeof NodesSchema>;
