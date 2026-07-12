/**
 * 增强的 Controller API 服务
 * 集成审批策略，支持自动执行
 */

import { getApprovalPolicyService } from '@clawkit/shared';
import type { ApprovalDecision } from '@clawkit/shared';
import { createLogger } from '@clawkit/shared';

import type { ControllerApiService } from './controller-api-service';
import type { IngestTaskTextResult } from './controller-api-service';

const logger = createLogger('EnhancedControllerApiService');

/**
 * 增强的任务接入结果
 */
export interface EnhancedIngestTaskTextResult extends IngestTaskTextResult {
  approvalDecision: ApprovalDecision;
  autoApproved: boolean;
}

/**
 * 增强的 Controller API 服务
 * 在原有服务基础上添加审批策略支持
 */
export class EnhancedControllerApiService {
  constructor(private readonly baseService: ControllerApiService) {}

  /**
   * 接入任务文本（增强版）
   * 根据审批策略决定是否自动执行
   */
  async ingestTaskText(inputText: string): Promise<EnhancedIngestTaskTextResult> {
    // 调用基础服务创建任务草稿
    const result = await this.baseService.ingestTaskText(inputText);

    // 获取审批策略服务
    const approvalService = getApprovalPolicyService();

    // 决定是否需要审批
    const decision = approvalService.decide(result.taskDraft.projectKey, inputText);

    logger.info('审批决策', {
      taskId: result.taskDraft.taskId,
      projectKey: result.taskDraft.projectKey,
      needApproval: decision.needApproval,
      reason: decision.reason,
    });

    let autoApproved = false;

    // 如果不需要审批，自动确认并派发
    if (!decision.needApproval) {
      try {
        logger.info('自动确认任务', { taskId: result.taskDraft.taskId });
        
        // 自动确认并派发
        const approved = this.baseService.approveDraftAndDispatch(
          result.taskDraft.taskId,
          'system-auto-approval',
          `自动确认：${decision.reason}`,
        );

        autoApproved = true;

        logger.info('任务已自动确认并派发', {
          taskId: result.taskDraft.taskId,
          status: approved.status,
        });

        // 更新状态快照
        result.status = approved.statusSnapshot;
      } catch (error) {
        logger.error('自动确认失败，任务将进入等待审批状态', {
          taskId: result.taskDraft.taskId,
          error,
        });
      }
    }

    return {
      ...result,
      approvalDecision: decision,
      autoApproved,
    };
  }

  /**
   * 获取基础服务（用于其他方法）
   */
  getBaseService(): ControllerApiService {
    return this.baseService;
  }
}
