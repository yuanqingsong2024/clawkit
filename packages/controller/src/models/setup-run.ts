import type { Manifest } from '@clawkit/shared';

import type { SetupTopLevelStatus } from './setup-session';

export type SetupRunStatus = SetupTopLevelStatus;

export interface SetupRun {
  runId: string;
  sessionId: string;
  parentRunId: string | null;
  status: SetupRunStatus;
  manifest: Manifest;
  manifestYaml: string;
  meta: Record<string, unknown>;
  currentStep: string | null;
  summary: string | null;
  errorSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}
