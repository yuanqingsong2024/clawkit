"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControllerSchema = void 0;
const zod_1 = require("zod");
/**
 * Controller 配置 Schema
 */
exports.ControllerSchema = zod_1.z.object({
    node: zod_1.z.string().min(1, 'Controller 节点引用不能为空').describe('Controller 所在节点的引用'),
    port: zod_1.z.number().int().min(1).max(65535).default(8080).describe('Controller 服务端口'),
    apiPrefix: zod_1.z.string().default('/api').describe('API 路径前缀'),
    publicUrl: zod_1.z.string().url({ message: 'Controller 对外地址必须是有效的 URL' }).describe('Controller 对外访问地址'),
});
//# sourceMappingURL=controller.js.map