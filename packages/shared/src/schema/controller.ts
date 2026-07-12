import { z } from 'zod';

/**
 * Controller 配置 Schema
 */
export const ControllerSchema = z.object({
  node: z.string().min(1, 'Controller 节点引用不能为空').describe('Controller 所在节点的引用'),
  port: z.number().int().min(1).max(65535).default(8080).describe('Controller 服务端口'),
  apiPrefix: z.string().default('/api').describe('API 路径前缀'),
  publicUrl: z.string().url({ message: 'Controller 对外地址必须是有效的 URL' }).describe('Controller 对外访问地址'),
});

export type Controller = z.infer<typeof ControllerSchema>;
