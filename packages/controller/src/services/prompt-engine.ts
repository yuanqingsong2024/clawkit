import type { PromptDraft } from '../models/prompt-draft';
import type { TaskDraft } from '../models/task-draft';
import type { TaskMemory } from '../models/task-memory';

export interface BuildPromptDraftInput {
  taskDraft: TaskDraft;
  taskMemory: TaskMemory | null;
}

export interface PromptEngine {
  buildPromptDraft(input: BuildPromptDraftInput): Promise<PromptDraft>;
}
