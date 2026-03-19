import type { TaskDraft } from '../models/task-draft';
import type { TaskMemory, NormalizedTaskCard } from '../models/task-memory';

/**
 * TaskMemory 服务接口
 * 负责任务记忆的初始化与更新
 */
export interface TaskMemoryService {
  /**
   * 从 TaskDraft 初始化 TaskMemory
   * @param draft 任务草稿
   * @returns 初始化的任务记忆
   */
  initializeFromDraft(draft: TaskDraft): TaskMemory;

  /**
   * 更新任务记忆的标准化卡片
   * @param memory 现有任务记忆
   * @param card 新的标准化卡片
   * @returns 更新后的任务记忆
   */
  updateNormalizedCard(memory: TaskMemory, card: NormalizedTaskCard): TaskMemory;
}

/**
 * TaskMemory 服务的默认实现
 */
export class TaskMemoryServiceImpl implements TaskMemoryService {
  initializeFromDraft(draft: TaskDraft): TaskMemory {
    const now = new Date();

    return {
      taskId: draft.taskId,
      normalizedTaskCard: this.createNormalizedCard(draft),
      promptDraftHistory: [],
      userRevisionHistory: [],
      executionSummary: {
        status: 'not_started',
        note: '任务已创建，等待派发',
        placeholderExecution: false,
        changedFiles: [],
        commands: [],
        testResult: '尚未执行',
        rawOutputSummary: '',
        parseStatus: 'text_only',
        lastUpdatedAt: null,
      },
      similarTaskRefs: [],
      projectRuleRefs: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  updateNormalizedCard(memory: TaskMemory, card: NormalizedTaskCard): TaskMemory {
    return {
      ...memory,
      normalizedTaskCard: card,
      updatedAt: new Date(),
    };
  }

  /**
   * 从 TaskDraft 创建标准化任务卡片
   */
  private createNormalizedCard(draft: TaskDraft): NormalizedTaskCard {
    return {
      title: this.extractTitle(draft.intent),
      objective: draft.intent,
      scope: this.extractScope(draft.intent, draft.constraints),
      outOfScope: [],
      constraints: draft.constraints,
      acceptanceCriteria: draft.acceptanceCriteria,
    };
  }

  /**
   * 从意图提取标题
   * 简单实现：取意图的前 50 个字符
   */
  private extractTitle(intent: string): string {
    const maxLength = 50;
    if (intent.length <= maxLength) {
      return intent;
    }
    return intent.substring(0, maxLength) + '...';
  }

  /**
   * 从意图和约束提取范围
   * 简单实现：将意图作为主要范围
   */
  private extractScope(intent: string, constraints: string[]): string[] {
    const scope: string[] = [intent];

    // 从约束中提取正向范围（不包含"不"字的约束）
    for (const constraint of constraints) {
      if (!constraint.includes('不') && !constraint.includes('禁止') && !constraint.includes('避免')) {
        scope.push(constraint);
      }
    }

    return scope;
  }
}
