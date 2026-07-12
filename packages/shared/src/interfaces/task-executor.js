"use strict";
/**
 * 任务执行接口定义
 * 支持多种执行器的通用执行上下文和结果
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractOpenCodeConfig = extractOpenCodeConfig;
/**
 * 辅助函数：从 TaskExecutionContext 提取 OpenCode 兼容配置
 * 用于在迁移期间保持与旧版 OpenCodeExecutor 的兼容
 */
function extractOpenCodeConfig(context) {
    if (context.executorType !== 'opencode') {
        return undefined;
    }
    return {
        port: context.executorConfig.port ?? 4096,
        agent: context.executorConfig.agent ?? 'build',
        mode: context.executorConfig.mode ?? 'default',
    };
}
//# sourceMappingURL=task-executor.js.map