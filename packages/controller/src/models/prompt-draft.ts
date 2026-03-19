import type { PromptDraftVersion } from '@clawkit/shared';

export interface PromptDraftSummaryView {
  goal: string;
  scope: string[];
  constraints: string[];
  acceptanceCriteria: string[];
  confirmationChecklist: string[];
}

export interface PromptDraft {
  version: PromptDraftVersion;
  taskId: string;
  projectKey: string;
  draftText: string;
  summaryView: PromptDraftSummaryView;
  riskFlags: string[];
  createdAt: Date;
}
