import { TaskStatus } from '@clawkit/shared';

export interface TaskDraft {
  taskId: string;
  sourceText: string;
  projectKey: string;
  intent: string;
  constraints: string[];
  acceptanceCriteria: string[];
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
}
