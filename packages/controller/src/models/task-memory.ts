import type { TaskExecutionParseStatus, TaskExecutionStructuredError } from '@clawkit/shared';

import type { PromptDraftVersion } from '@clawkit/shared';

export interface NormalizedTaskCard {
  title: string;
  objective: string;
  scope: string[];
  outOfScope: string[];
  constraints: string[];
  acceptanceCriteria: string[];
}

export interface PromptDraftHistoryEntry {
  version: PromptDraftVersion;
  summary: string;
  createdAt: Date;
}

export interface UserRevisionRecord {
  revisionId: string;
  operator: string;
  comment: string;
  targetVersion: PromptDraftVersion;
  createdAt: Date;
}

export interface ExecutionSummary {
  status: 'not_started' | 'running' | 'done' | 'failed';
  note: string;
  summary?: string;
  placeholderExecution?: boolean;
  logs?: string[];
  changedFiles?: string[];
  commands?: string[];
  testResult?: string;
  rawOutputSummary?: string;
  parseStatus?: TaskExecutionParseStatus;
  structuredError?: TaskExecutionStructuredError;
  sessionId?: string;
  risks?: string[];
  nextStageHint?: string;
  lastUpdatedAt: Date | null;
}

export interface MemoryReference {
  refId: string;
  title: string;
  summary: string;
}

export interface TaskMemory {
  taskId: string;
  normalizedTaskCard: NormalizedTaskCard;
  promptDraftHistory: PromptDraftHistoryEntry[];
  userRevisionHistory: UserRevisionRecord[];
  executionSummary: ExecutionSummary | null;
  similarTaskRefs: MemoryReference[];
  projectRuleRefs: MemoryReference[];
  createdAt: Date;
  updatedAt: Date;
}
