import type { PromptDraft, PromptDraftSummaryView } from '../models/prompt-draft';
import type { TaskDraft } from '../models/task-draft';
import type { TaskMemory } from '../models/task-memory';
import type { BuildPromptDraftInput, PromptEngine } from './prompt-engine';
import type { PromptCompiler, PromptCompilerInput } from './prompt-compiler';
import { PromptCompilerImpl } from './prompt-compiler';

/**
 * Template 模式的 PromptEngine 实现
 * 使用内置模板生成 PromptDraft，不调用外部 LLM
 */
export class TemplatePromptEngine implements PromptEngine {
  private compiler: PromptCompiler;

  constructor(compiler?: PromptCompiler) {
    this.compiler = compiler ?? new PromptCompilerImpl();
  }

  async buildPromptDraft(input: BuildPromptDraftInput): Promise<PromptDraft> {
    const { taskDraft, taskMemory } = input;

    // 使用 PromptCompiler 编译 prompt
    const compilerInput: PromptCompilerInput = {
      taskDraft,
      taskMemory,
    };
    const compiled = this.compiler.compile(compilerInput);

    // 构建 summaryView
    const summaryView = this.buildSummaryView(taskDraft, taskMemory);

    // 识别风险标记
    const riskFlags = this.identifyRiskFlags(taskDraft, taskMemory);

    // 确定版本号
    const version = this.determineVersion(taskMemory);

    return {
      version,
      taskId: taskDraft.taskId,
      projectKey: taskDraft.projectKey,
      draftText: compiled.executionVersion,
      summaryView,
      riskFlags,
      createdAt: new Date(),
    };
  }

  /**
   * 构建摘要视图
   */
  private buildSummaryView(taskDraft: TaskDraft, taskMemory: TaskMemory | null): PromptDraftSummaryView {
    const card = taskMemory?.normalizedTaskCard;
    const latestRevision = this.getLatestRevisionComment(taskMemory);
    const scope = [...(card?.scope ?? [taskDraft.intent])];
    const confirmationChecklist = [
      '确认任务目标清晰',
      '确认约束条件可行',
      '确认验收标准明确',
      '确认无遗漏关键需求',
    ];

    if (latestRevision !== null) {
      scope.push(`按最新修改意见调整：${latestRevision}`);
      confirmationChecklist.push('确认最新修改意见已纳入草案');
    }

    return {
      goal: taskDraft.intent,
      scope,
      constraints: taskDraft.constraints,
      acceptanceCriteria: taskDraft.acceptanceCriteria,
      confirmationChecklist,
    };
  }

  /**
   * 识别风险标记
   */
  private identifyRiskFlags(taskDraft: TaskDraft, taskMemory: TaskMemory | null): string[] {
    const flags: string[] = [];

    // 检查范围是否过大
    const card = taskMemory?.normalizedTaskCard;
    if (card && card.scope.length > 5) {
      flags.push('scope_too_broad');
    }

    // 检查约束是否冲突
    const constraints = taskDraft.constraints;
    if (constraints.length > 0) {
      const hasNoConstraint = constraints.some((c: string) => 
        c.includes('不') || c.includes('禁止') || c.includes('避免')
      );
      const hasYesConstraint = constraints.some((c: string) => 
        c.includes('必须') || c.includes('需要') || c.includes('要求')
      );
      if (hasNoConstraint && hasYesConstraint) {
        // 简单启发式：如果同时有"不"和"必须"，可能存在冲突
        flags.push('constraints_may_conflict');
      }
    }

    // 检查验收标准是否清晰
    if (taskDraft.acceptanceCriteria.length === 0) {
      flags.push('acceptance_unclear');
    }

    // 检查是否缺少上下文
    if (!taskMemory) {
      flags.push('missing_context');
    }

    return flags;
  }

  /**
   * 确定版本号
   */
  private determineVersion(taskMemory: TaskMemory | null): { generation: number; revision: number } {
    if (!taskMemory || taskMemory.promptDraftHistory.length === 0) {
      // 首次生成
      return { generation: 1, revision: 0 };
    }

    // 获取最新版本
    const history = taskMemory.promptDraftHistory;
    const latest = history[history.length - 1];
    
    // 简单策略：每次生成都递增 revision
    return {
      generation: latest.version.generation,
      revision: latest.version.revision + 1,
    };
  }

  private getLatestRevisionComment(taskMemory: TaskMemory | null): string | null {
    if (!taskMemory || taskMemory.userRevisionHistory.length === 0) {
      return null;
    }

    return taskMemory.userRevisionHistory[taskMemory.userRevisionHistory.length - 1].comment;
  }
}
