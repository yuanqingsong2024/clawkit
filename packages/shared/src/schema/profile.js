"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileSchema = void 0;
const zod_1 = require("zod");
/**
 * Profile 配置 Schema
 */
exports.ProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, '配置名称不能为空').describe('配置名称'),
    version: zod_1.z.string().default('1.0.0').describe('配置版本'),
    topology: zod_1.z.enum(['all-in-one', 'hybrid', 'split']).describe('部署拓扑类型'),
    description: zod_1.z.string().optional().describe('配置描述'),
});
//# sourceMappingURL=profile.js.map