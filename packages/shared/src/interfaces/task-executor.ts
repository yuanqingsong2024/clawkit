import type { TaskStatus } from './task';
import type { OpenCodeConfig } from '../types/manifest';

export interface TaskExecutionBoundary {
  allowedActions: string[];
  forbiddenActions: string[];
  highRiskHandling: string;
}

export interface TaskProjectConfigSnapshot {
  repoPath: string;
  branchBase: string;
  openCode: OpenCodeConfig;
}

export type TaskExecutionStage =
  | 'project_check'
  | 'server_check'
  | 'context_build'
  | 'prompt_compile'
  | 'execute'
  | 'result_parse'
  | 'submit_result';

export type TaskExecutionParseStatus = 'structured' | 'text_only' | 'parse_failed';

export interface TaskExecutionStructuredError {
  errorCode: string;
  message: string;
  stage: TaskExecutionStage;
  rawErrorSummary: string;
}

export interface TaskExecutionContext {
  taskId: string;
  projectKey: string;
  repoPath: string;
  branchBase: string;
  openCode: OpenCodeConfig;
  intent: string;
  constraints: string[];
  acceptanceCriteria: string[];
  sourceText: string;
  status: TaskStatus;
  executionPrompt: string;
  outputContract: {
    completionChecklist: string[];
    modifiedFiles: string[];
    executionCommands: string[];
    testResults: string[];
    risksAndConfirmations: string[];
  };
  executionBoundary: TaskExecutionBoundary;
}

export interface TaskExecutionResult {
  taskId: string;
  workerId: string;
  projectKey: string;
  status: 'done' | 'failed';
  summary: string;
  placeholderExecution: boolean;
  logs: string[];
  changedFiles: string[];
  commands: string[];
  testResult: string;
  rawOutputSummary: string;
  parseStatus: TaskExecutionParseStatus;
  structuredError?: TaskExecutionStructuredError;
  sessionId?: string;
  risks?: string[];
  nextStageHint?: string;
  updatedAt: string;
}

export interface TaskExecutor {
  execute(context: TaskExecutionContext): Promise<TaskExecutionResult>;
}
