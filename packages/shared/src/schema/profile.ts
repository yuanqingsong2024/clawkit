import { z } from 'zod';

/**
 * Profile 配置 Schema
 */
export const ProfileSchema = z.object({
  name: z.string().min(1, '配置名称不能为空').describe('配置名称'),
  version: z.string().default('1.0.0').describe('配置版本'),
  topology: z.enum(['all-in-one', 'hybrid', 'split']).describe('部署拓扑类型'),
  description: z.string().optional().describe('配置描述'),
});

export type Profile = z.infer<typeof ProfileSchema>;
