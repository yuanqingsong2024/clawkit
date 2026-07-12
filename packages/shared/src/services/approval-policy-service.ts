/**
 * 审批策略服务
 * 根据项目配置决定是否需要审批
 */

import { createLogger } from '../logger';

const logger = createLogger('ApprovalPolicyService');

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
export class ApprovalPolicyService {
  private projectConfigs: Map<string, ProjectApprovalConfig> = new Map();

  /**
   * 注册项目配置
   */
  registerProject(config: ProjectApprovalConfig): void {
    this.projectConfigs.set(config.key, config);
    logger.info(`注册项目审批配置: ${config.key}`, {
      autoExecute: config.autoExecute,
      dangerousOpsCount: config.dangerousOps.length,
    });
  }

  /**
   * 批量注册项目配置
   */
  registerProjects(configs: ProjectApprovalConfig[]): void {
    configs.forEach((config) => this.registerProject(config));
  }

  /**
   * 决定是否需要审批
   */
  decide(projectKey: string, taskMessage: string): ApprovalDecision {
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
  private detectDangerousOps(message: string, dangerousOps: string[]): string[] {
    const lowerMessage = message.toLowerCase();
    return dangerousOps.filter((op) => {
      const lowerOp = op.toLowerCase();
      return lowerMessage.includes(lowerOp);
    });
  }

  /**
   * 获取项目配置
   */
  getProjectConfig(projectKey: string): ProjectApprovalConfig | undefined {
    return this.projectConfigs.get(projectKey);
  }

  /**
   * 获取所有项目配置
   */
  getAllProjectConfigs(): ProjectApprovalConfig[] {
    return Array.from(this.projectConfigs.values());
  }

  /**
   * 清空所有配置
   */
  clear(): void {
    this.projectConfigs.clear();
  }
}

/**
 * 全局单例
 */
let globalInstance: ApprovalPolicyService | null = null;

/**
 * 获取全局审批策略服务实例
 */
export function getApprovalPolicyService(): ApprovalPolicyService {
  if (!globalInstance) {
    globalInstance = new ApprovalPolicyService();
  }
  return globalInstance;
}

/**
 * 重置全局实例（用于测试）
 */
export function resetApprovalPolicyService(): void {
  globalInstance = null;
}
