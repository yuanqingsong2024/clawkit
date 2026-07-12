/**
 * 审批策略服务
 * 根据项目配置决定是否需要审批
 */
/**
 * 项目审批配置
 */
export interface ProjectApprovalConfig {
    key: string;
    autoExecute: boolean;
    dangerousOps: string[];
}
/**
 * 审批决策结果
 */
export interface ApprovalDecision {
    needApproval: boolean;
    reason: string;
    matchedDangerousOps?: string[];
}
/**
 * 审批策略服务
 */
export declare class ApprovalPolicyService {
    private projectConfigs;
    /**
     * 注册项目配置
     */
    registerProject(config: ProjectApprovalConfig): void;
    /**
     * 批量注册项目配置
     */
    registerProjects(configs: ProjectApprovalConfig[]): void;
    /**
     * 决定是否需要审批
     */
    decide(projectKey: string, taskMessage: string): ApprovalDecision;
    /**
     * 检测危险操作
     */
    private detectDangerousOps;
    /**
     * 获取项目配置
     */
    getProjectConfig(projectKey: string): ProjectApprovalConfig | undefined;
    /**
     * 获取所有项目配置
     */
    getAllProjectConfigs(): ProjectApprovalConfig[];
    /**
     * 清空所有配置
     */
    clear(): void;
}
/**
 * 获取全局审批策略服务实例
 */
export declare function getApprovalPolicyService(): ApprovalPolicyService;
/**
 * 重置全局实例（用于测试）
 */
export declare function resetApprovalPolicyService(): void;
//# sourceMappingURL=approval-policy-service.d.ts.map