import { randomUUID } from 'node:crypto';

import {
  ControllerErrorCode,
  DispatchRecord,
  DispatchStatus,
  TaskStatus,
  type TaskExecutionBoundary,
  WorkerPullTaskResponse,
  WorkerSubmitResultRequest,
} from '@clawkit/shared';

import type { TaskDraft } from '../models/task-draft';
import type { TaskMemory } from '../models/task-memory';
import type { OutputContract } from './prompt-compiler';
import type { ProjectDispatchConfig } from './project-registry';
import type { WorkerRegistry } from './worker-registry';

interface DispatchProjectLookup {
  getProject(projectKey: string): ProjectDispatchConfig | undefined;
}

interface DispatchPromptCompiler {
  compileExecutionPrompt(taskId: string): {
    executionVersion: string;
    outputContract: OutputContract;
  };
}

export class DispatchService {
  private dispatches: Map<string, DispatchRecord> = new Map();
  private taskToDispatch: Map<string, string> = new Map();
  private workerToTask: Map<string, string> = new Map();

  constructor(
    private workerRegistry: WorkerRegistry,
    private taskMemoryService: { getTaskMemory(taskId: string): TaskMemory | undefined },
    private taskDraftService: { getTaskDraft(taskId: string): TaskDraft | undefined },
    private taskStatusUpdater: { updateTaskStatus(taskId: string, status: TaskStatus): void },
    private projectRegistry?: DispatchProjectLookup,
    private promptCompiler?: DispatchPromptCompiler,
  ) {}

  dispatchTask(taskId: string): DispatchRecord {
    const taskDraft = this.taskDraftService.getTaskDraft(taskId);
    if (!taskDraft) {
      throw new Error(`${ControllerErrorCode.TASK_NOT_FOUND}：任务 ${taskId} 不存在`);
    }

    if (taskDraft.status !== TaskStatus.APPROVED) {
      throw new Error(
        `${ControllerErrorCode.INVALID_TASK_STATUS_TRANSITION}：只有 approved 状态的任务才能派发，当前状态：${taskDraft.status}`,
      );
    }

    const projectConfig = this.requireProjectConfig(taskDraft.projectKey);

    const worker = this.workerRegistry.findWorkerForProject(taskDraft.projectKey);
    if (!worker) {
      throw new Error(
        `${ControllerErrorCode.NO_AVAILABLE_WORKER}：没有可用的 worker 处理项目 ${taskDraft.projectKey}`,
      );
    }

    const dispatchId = randomUUID();
    const now = new Date();

    const dispatch: DispatchRecord = {
      dispatchId,
      taskId,
      workerId: worker.workerId,
      dispatchStatus: DispatchStatus.DISPATCHED,
      createdAt: now,
      updatedAt: now,
      note: `派发到 worker ${worker.name} (${worker.workerId})`,
    };

    this.dispatches.set(dispatchId, dispatch);
    this.taskToDispatch.set(taskId, dispatchId);
    this.workerToTask.set(worker.workerId, taskId);

    this.workerRegistry.markWorkerBusy(worker.workerId, taskId);
    this.taskStatusUpdater.updateTaskStatus(taskId, TaskStatus.DISPATCHED);
    this.markExecutionSummary(taskId, {
      status: 'not_started',
      note: `任务已派发，等待 worker ${worker.workerId} 拉取`,
      changedFiles: [],
      commands: [],
      testResult: '尚未执行',
      rawOutputSummary: `目标仓库：${projectConfig.repoPath}`,
      parseStatus: 'text_only',
      placeholderExecution: false,
      lastUpdatedAt: new Date(),
    });

    return dispatch;
  }

  pullTask(workerId: string): WorkerPullTaskResponse {
    const taskId = this.workerToTask.get(workerId);
    if (!taskId) {
      return { hasTask: false };
    }

    const taskDraft = this.taskDraftService.getTaskDraft(taskId);
    if (!taskDraft) {
      this.workerToTask.delete(workerId);
      return { hasTask: false };
    }

    const dispatchId = this.taskToDispatch.get(taskId);
    if (dispatchId) {
      const dispatch = this.dispatches.get(dispatchId);
      if (dispatch) {
        dispatch.dispatchStatus = DispatchStatus.ACCEPTED;
        dispatch.updatedAt = new Date();
      }
    }

    const projectConfig = this.requireProjectConfig(taskDraft.projectKey);
    const compiled = this.requireCompiledPrompt(taskId);
    const executionBoundary = this.buildExecutionBoundary();

    this.taskStatusUpdater.updateTaskStatus(taskId, TaskStatus.RUNNING);
    this.markExecutionSummary(taskId, {
      status: 'running',
      note: 'worker 已拉取任务，开始真实执行',
      changedFiles: [],
      commands: [],
      testResult: '执行中',
      rawOutputSummary: '',
      parseStatus: 'text_only',
      placeholderExecution: false,
      lastUpdatedAt: new Date(),
    });

    return {
      hasTask: true,
      task: {
        taskId: taskDraft.taskId,
        projectKey: taskDraft.projectKey,
        repoPath: projectConfig.repoPath,
        branchBase: projectConfig.branchBase,
        openCode: projectConfig.openCode,
        intent: taskDraft.intent,
        constraints: taskDraft.constraints,
        acceptanceCriteria: taskDraft.acceptanceCriteria,
        sourceText: taskDraft.sourceText,
        status: TaskStatus.RUNNING,
        executionPrompt: compiled.executionVersion,
        outputContract: compiled.outputContract,
        executionBoundary,
      },
    };
  }

  submitResult(workerId: string, result: WorkerSubmitResultRequest): void {
    const taskId = result.taskId;
    const taskDraft = this.taskDraftService.getTaskDraft(taskId);
    if (!taskDraft) {
      throw new Error(`${ControllerErrorCode.TASK_NOT_FOUND}：任务 ${taskId} 不存在`);
    }

    const finalStatus = result.status === 'done' ? TaskStatus.DONE : TaskStatus.FAILED;
    this.taskStatusUpdater.updateTaskStatus(taskId, finalStatus);

    this.workerToTask.delete(workerId);
    this.workerRegistry.markWorkerIdle(workerId);

    const taskMemory = this.taskMemoryService.getTaskMemory(taskId);
    if (taskMemory) {
      const executionSummary = taskMemory.executionSummary ?? {
        status: 'not_started' as const,
        note: '任务已创建，等待派发',
        changedFiles: [],
        commands: [],
        testResult: '尚未执行',
        rawOutputSummary: '',
        parseStatus: 'text_only' as const,
        lastUpdatedAt: null,
      };

      executionSummary.status = result.status;
      executionSummary.note = result.status === 'done' ? '真实执行完成' : '真实执行失败';
      executionSummary.summary = result.summary;
      executionSummary.placeholderExecution = result.placeholderExecution;
      executionSummary.logs = result.logs;
      executionSummary.changedFiles = result.changedFiles;
      executionSummary.commands = result.commands;
      executionSummary.testResult = result.testResult;
      executionSummary.rawOutputSummary = result.rawOutputSummary;
      executionSummary.parseStatus = result.parseStatus;
      executionSummary.structuredError = result.structuredError;
      executionSummary.sessionId = result.sessionId;
      executionSummary.risks = result.risks;
      executionSummary.nextStageHint = result.nextStageHint;
      executionSummary.lastUpdatedAt = new Date(result.updatedAt);
      taskMemory.executionSummary = executionSummary;
      taskMemory.updatedAt = new Date();
    }
  }

  getDispatchByTaskId(taskId: string): DispatchRecord | undefined {
    const dispatchId = this.taskToDispatch.get(taskId);
    return dispatchId ? this.dispatches.get(dispatchId) : undefined;
  }

  getAllDispatches(): DispatchRecord[] {
    return Array.from(this.dispatches.values());
  }

  private requireProjectConfig(projectKey: string): ProjectDispatchConfig {
    const projectConfig = this.projectRegistry?.getProject(projectKey);

    if (!projectConfig) {
      throw new Error(`${ControllerErrorCode.PROJECT_CONFIG_NOT_FOUND}：未找到项目 ${projectKey} 的仓库配置`);
    }

    return projectConfig;
  }

  private requireCompiledPrompt(taskId: string): { executionVersion: string; outputContract: OutputContract } {
    if (!this.promptCompiler) {
      throw new Error('派发失败：未配置执行 prompt 编译器');
    }

    return this.promptCompiler.compileExecutionPrompt(taskId);
  }

  private buildExecutionBoundary(): TaskExecutionBoundary {
    return {
      allowedActions: ['查看代码', '修改代码', '运行测试', '读取文档'],
      forbiddenActions: ['git push', '自动部署生产', '删除关键目录'],
      highRiskHandling: '如遇高风险操作，必须明确报告而不是擅自执行',
    };
  }

  private markExecutionSummary(
    taskId: string,
    summary: NonNullable<TaskMemory['executionSummary']>,
  ): void {
    const taskMemory = this.taskMemoryService.getTaskMemory(taskId);

    if (!taskMemory) {
      return;
    }

    taskMemory.executionSummary = summary;
    taskMemory.updatedAt = new Date();
  }
}
