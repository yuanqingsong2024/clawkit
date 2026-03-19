export type SetupStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface SetupStep {
  stepId: number;
  runId: string;
  stepKey: string;
  title: string;
  status: SetupStepStatus;
  logSummary: string[];
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}
