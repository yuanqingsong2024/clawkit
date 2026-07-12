"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodesSchema = exports.NodeSchema = exports.SshNodeSchema = exports.LocalNodeSchema = exports.NodeTypeSchema = void 0;
const zod_1 = require("zod");
/**
 * Node 类型枚举
 */
exports.NodeTypeSchema = zod_1.z.enum(['local', 'ssh']);
/**
 * Local Node Schema
 */
exports.LocalNodeSchema = zod_1.z.object({
    type: zod_1.z.literal('local'),
    workDir: zod_1.z.string().optional().describe('工作目录，默认为当前目录'),
});
/**
 * SSH Node Schema
 */
exports.SshNodeSchema = zod_1.z.object({
    type: zod_1.z.literal('ssh'),
    host: zod_1.z.string().min(1, '主机地址不能为空'),
    port: zod_1.z.number().int().min(1).max(65535).default(22).describe('SSH 端口'),
    user: zod_1.z.string().min(1, '用户名不能为空'),
    keyPath: zod_1.z.string().optional().describe('SSH 私钥路径'),
    password: zod_1.z.string().optional().describe('SSH 密码（不推荐，建议使用私钥）'),
    workDir: zod_1.z.string().describe('远程工作目录'),
});
/**
 * Node Schema（联合类型）
 */
exports.NodeSchema = zod_1.z.discriminatedUnion('type', [
    exports.LocalNodeSchema,
    exports.SshNodeSchema,
]);
/**
 * Nodes 配置 Schema
 */
exports.NodesSchema = zod_1.z.record(zod_1.z.string(), exports.NodeSchema).describe('节点配置映射');
//# sourceMappingURL=node.js.map