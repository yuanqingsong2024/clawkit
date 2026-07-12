import type { PromptDraftSummaryView } from '../../models/prompt-draft';
import type { ExecutionSummary } from '../../models/task-memory';
import type { TaskStatusSnapshot } from '../../services/controller-flow-service';

export interface OpenClawWebhookRequest {
  requestId?: string;
  source: string;
  message: string;
  operator: {
    id: string;
    name?: string;
  };
  metadata?: Record<string, string | number | boolean | null>;
  sessionKey?: string;
}

export interface OpenClawWebhookResponseData {
  taskId: string;
  projectKey: string;
  status: TaskStatusSnapshot['status'];
  userMessage: string;
  suggestedReplies: string[];
  latestSummary: string;
  latestDraftSummary: PromptDraftSummaryView | null;
  executionSummary: ExecutionSummary | null;
  dispatchInfo?: TaskStatusSnapshot['dispatchInfo'];
  workerInfo?: TaskStatusSnapshot['workerInfo'];
  metadata: {
    source: 'openclaw';
    requestId: string;
    sessionKey?: string;
    phase: 'draft' | 'approved' | 'dispatched' | 'running' | 'done' | 'failed' | 'cancelled';
  };
}
