import type { TaskStatus } from '../interfaces/task';
import type {
  TaskExecutionBoundary,
  TaskExecutionParseStatus,
  TaskExecutionStructuredError,
} from '../interfaces/task-executor';
import type { OpenCodeConfig } from './manifest';

/**
 * Worker 拉取任务响应
 */
export interface WorkerPullTaskResponse {
  /** 是否有可用任务 */
  hasTask: boolean;
  /** 任务信息（如果有） */
  task?: {
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
  };
}

/**
 * Worker 提交任务结果请求
 */
export interface WorkerSubmitResultRequest {
  taskId: string;
  status: 'done' | 'failed';
  workerId: string;
  projectKey: string;
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

/**
 * Worker 提交任务结果响应
 */
export interface WorkerSubmitResultResponse {
  /** 是否成功 */
  success: boolean;
  /** 任务最终状态 */
  finalStatus: TaskStatus;
}
