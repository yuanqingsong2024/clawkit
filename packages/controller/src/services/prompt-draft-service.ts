import type { PromptDraft } from '../models/prompt-draft';
import type { TaskDraft } from '../models/task-draft';
import type { TaskMemory } from '../models/task-memory';
import type { PromptEngine } from './prompt-engine';
import { TemplatePromptEngine } from './template-prompt-engine';

/**
 * PromptDraftService 输入
 */
export interface BuildPromptDraftServiceInput {
  taskDraft: TaskDraft;
  taskMemory: TaskMemory | null;
}

/**
 * PromptDraftService 接口
 * 负责协调 PromptCompiler 和 PromptEngine，生成 PromptDraft
 */
export interface PromptDraftService {
  /**
   * 构建 PromptDraft
   * @param input 构建输入
   * @returns 生成的 PromptDraft
   */
  buildPromptDraft(input: BuildPromptDraftServiceInput): Promise<PromptDraft>;
}

/**
 * PromptDraftService 的默认实现
 */
export class PromptDraftServiceImpl implements PromptDraftService {
  private engine: PromptEngine;

  constructor(engine?: PromptEngine) {
    // 默认使用 TemplatePromptEngine
    this.engine = engine ?? new TemplatePromptEngine();
  }

  async buildPromptDraft(input: BuildPromptDraftServiceInput): Promise<PromptDraft> {
    const { taskDraft, taskMemory } = input;

    // 委托给 PromptEngine
    return this.engine.buildPromptDraft({
      taskDraft,
      taskMemory,
    });
  }
}
