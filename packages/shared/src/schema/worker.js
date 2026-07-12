"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkersSchema = exports.WorkerSchema = exports.ConnectModeSchema = void 0;
const zod_1 = require("zod");
const project_1 = require("./project");
/**
 * Worker 连接模式枚举
 */
exports.ConnectModeSchema = zod_1.z.enum(['pull', 'push']);
/**
 * Worker 配置 Schema
 */
exports.WorkerSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, 'Worker ID 不能为空').describe('Worker 唯一标识'),
    node: zod_1.z.string().min(1, 'Node 引用不能为空').describe('Worker 所在节点的引用'),
    connectMode: exports.ConnectModeSchema.default('pull').describe('连接模式：pull 或 push'),
    tags: zod_1.z.array(zod_1.z.string()).default([]).describe('Worker 标签，用于任务分配'),
    projects: zod_1.z.array(project_1.ProjectSchema).min(1, '至少需要配置一个项目').describe('Worker 管理的项目列表'),
});
/**
 * Workers 配置 Schema
 */
exports.WorkersSchema = zod_1.z.array(exports.WorkerSchema).min(1, '至少需要配置一个 Worker').describe('Worker 列表');
//# sourceMappingURL=worker.js.map