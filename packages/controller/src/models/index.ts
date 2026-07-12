export type { TaskDraft } from './task-draft';
export type {
  TaskMemory,
  NormalizedTaskCard,
  PromptDraftHistoryEntry,
  UserRevisionRecord,
  ExecutionSummary,
  MemoryReference,
} from './task-memory';
export type { PromptDraft, PromptDraftSummaryView } from './prompt-draft';
export type { ApprovalRecord } from './approval-record';
export {
  ApprovalStateTransitions,
  TaskDraftLifecycleSequence,
  TaskStatusTransitionMap,
  getAllowedTaskTransitions,
  canApplyApprovalAction,
  canTransitionTaskStatus,
  assertTaskStatusTransition,
  transitionTaskStatus,
  getNextTaskStatusForAction,
  applyApprovalAction,
} from './approval-state-machine';
