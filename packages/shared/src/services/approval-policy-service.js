"use strict";
/**
 * 审批策略服务
 * 根据项目配置决定是否需要审批
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalPolicyService = void 0;
exports.getApprovalPolicyService = getApprovalPolicyService;
exports.resetApprovalPolicyService = resetApprovalPolicyService;
const logger_1 = require("../logger");
const logger = (0, logger_1.createLogger)('ApprovalPolicyService');
/**
 * 审批策略服务
 */
class ApprovalPolicyService {
    projectConfigs = new Map();
    /**
     * 注册项目配置
     */
    registerProject(config) {
        this.projectConfigs.set(config.key, config);
        logger.info(`注册项目审批配置: ${config.key}`, {
            autoExecute: config.autoExecute,
            dangerousOpsCount: config.dangerousOps.length,
        });
    }
    /**
     * 批量注册项目配置
     */
    registerProjects(configs) {
        configs.forEach((config) => this.registerProject(config));
    }
    /**
     * 决定是否需要审批
     */
    decide(projectKey, taskMessage) {
        const config = this.projectConfigs.get(projectKey);
        // 如果项目未配置，默认需要审批
        if (!config) {
            return {
                needApproval: true,
                reason: '项目未配置审批策略，默认需要审批',
            };
        }
        // 检查是否包含危险操作
        const matchedDangerousOps = this.detectDangerousOps(taskMessage, config.dangerousOps);
        if (matchedDangerousOps.length > 0) {
            return {
                needApproval: true,
                reason: `检测到危险操作关键词：${matchedDangerousOps.join(', ')}`,
                matchedDangerousOps,
            };
        }
        // 根据 autoExecute 配置决定
        if (config.autoExecute) {
            return {
                needApproval: false,
                reason: '项目配置为自动执行',
            };
        }
        return {
            needApproval: true,
            reason: '项目配置为需要审批',
        };
    }
    /**
     * 检测危险操作
     */
    detectDangerousOps(message, dangerousOps) {
        const lowerMessage = message.toLowerCase();
        return dangerousOps.filter((op) => {
            const lowerOp = op.toLowerCase();
            return lowerMessage.includes(lowerOp);
        });
    }
    /**
     * 获取项目配置
     */
    getProjectConfig(projectKey) {
        return this.projectConfigs.get(projectKey);
    }
    /**
     * 获取所有项目配置
     */
    getAllProjectConfigs() {
        return Array.from(this.projectConfigs.values());
    }
    /**
     * 清空所有配置
     */
    clear() {
        this.projectConfigs.clear();
    }
}
exports.ApprovalPolicyService = ApprovalPolicyService;
/**
 * 全局单例
 */
let globalInstance = null;
/**
 * 获取全局审批策略服务实例
 */
function getApprovalPolicyService() {
    if (!globalInstance) {
        globalInstance = new ApprovalPolicyService();
    }
    return globalInstance;
}
/**
 * 重置全局实例（用于测试）
 */
function resetApprovalPolicyService() {
    globalInstance = null;
}
//# sourceMappingURL=approval-policy-service.js.map