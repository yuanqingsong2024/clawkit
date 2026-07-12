import { ApprovalAction, ControllerErrorCode, TaskPriority, TaskStatus } from '@clawkit/shared';

import type { ApprovalRecord } from '../models/approval-record';
import { applyApprovalAction, transitionTaskStatus } from '../models/approval-state-machine';
import type { PromptDraft, PromptDraftSummaryView } from '../models/prompt-draft';
import type { TaskDraft } from '../models/task-draft';
import type { ExecutionSummary, PromptDraftHistoryEntry, TaskMemory } from '../models/task-memory';
import { SqliteTaskStore } from '../persistence/sqlite-task-store';
import { recognizeTaskProtocol, TaskProtocolCommandType, type CreateTaskProtocol } from '../protocol';
import type { PromptDraftService } from './prompt-draft-service';
import { PromptDraftServiceImpl } from './prompt-draft-service';
import type { TaskDraftService } from './task-draft-service';
import { TaskDraftServiceImpl } from './task-draft-service';
import type { TaskMemoryService } from './task-memory-service';
import { TaskMemoryServiceImpl } from './task-memory-service';

export interface CreateDraftFromTextResult {
  taskDraft: TaskDraft;
  taskMemory: TaskMemory;
}

export interface GeneratePromptDraftResult {
  taskDraft: TaskDraft;
  promptDraft: PromptDraft;
}

export interface ApproveDraftInput {
  taskId: string;
  operator: string;
  comment?: string;
}

export interface ReviseDraftInput {
  taskId: string;
  operator: string;
  revisionText: string;
}

export interface CancelTaskInput {
  taskId: string;
  operator: string;
  comment?: string;
}

export interface TaskStatusSnapshot {
  taskId: string;
  projectKey: string;
  status: TaskStatus;
  latestPromptDraftSummary: PromptDraftSummaryView | null;
  latestApprovalAction: ApprovalRecord | null;
  userSummary: string;
  readableSummary: {
    title: string;
    summary: string;
    details: string[];
    suggestedReplies: string[];
  };
  nextStageHint: string;
  executionSummary: ExecutionSummary | null;
  dispatchInfo?: {
    dispatchId: string;
    workerId: string;
    dispatchStatus: string;
    createdAt: Date;
  };
  workerInfo?: {
    workerId: string;
    name: string;
    status: string;
  };
}

export interface ApproveDraftResult {
  taskId: string;
  status: TaskStatus;
  latestApprovalAction: ApprovalRecord;
  nextStageHint: string;
}

export interface ReviseDraftResult {
  taskId: string;
  status: TaskStatus;
  draftVersion: PromptDraft['version'];
  draftSummary: PromptDraftSummaryView;
  revisionRecorded: true;
  nextStageHint: string;
}

export interface CancelTaskResult {
  taskId: string;
  status: TaskStatus;
  latestApprovalAction: ApprovalRecord;
  nextStageHint: string;
}

export interface DraftHistoryVersionView {
  version: PromptDraft['version'];
  summary: PromptDraftSummaryView;
  createdAt: Date;
}

export interface DraftHistoryResult {
  taskId: string;
  versions: DraftHistoryVersionView[];
  latestVersion: PromptDraft['version'];
  latestSummary: PromptDraftSummaryView;
}

export interface TaskListItem {
  taskId: string;
  projectKey: string;
  intent: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: Date;
  updatedAt: Date;
  latestPromptDraftSummary: PromptDraftSummaryView | null;
  latestApprovalAction: ApprovalRecord | null;
  nextStageHint: string;
  executionSummary: ExecutionSummary | null;
}

export interface TaskDetail {
  taskDraft: TaskDraft;
  taskMemory: TaskMemory;
  promptDrafts: PromptDraft[];
  approvalRecords: ApprovalRecord[];
  statusSnapshot: TaskStatusSnapshot;
}

export interface ControllerFlowService {
  createDraftFromText(inputText: string): CreateDraftFromTextResult;
  generatePromptDraft(taskId: string): Promise<GeneratePromptDraftResult>;
  approveDraft(input: ApproveDraftInput): ApproveDraftResult;
  reviseDraft(input: ReviseDraftInput): Promise<ReviseDraftResult>;
  cancelTask(input: CancelTaskInput): CancelTaskResult;
  getDraftHistory(taskId: string): DraftHistoryResult;
  getTaskStatus(taskId: string): TaskStatusSnapshot;
  listTasks(): TaskListItem[];
  getTaskDetail(taskId: string): TaskDetail;
}

export interface ControllerFlowServiceDependencies {
  taskDraftService?: TaskDraftService;
  taskMemoryService?: TaskMemoryService;
  promptDraftService?: PromptDraftService;
  taskStore?: SqliteTaskStore;
}

export class ControllerFlowServiceImpl implements ControllerFlowService {
  private readonly taskDraftService: TaskDraftService;
  private readonly taskMemoryService: TaskMemoryService;
  private readonly promptDraftService: PromptDraftService;
  private readonly taskStore: SqliteTaskStore | null;
  private readonly taskDraftStore = new Map<string, TaskDraft>();
  private readonly taskMemoryStore = new Map<string, TaskMemory>();
  private readonly promptDraftStore = new Map<string, PromptDraft[]>();
  private readonly approvalRecordStore = new Map<string, ApprovalRecord[]>();

  constructor(dependencies: ControllerFlowServiceDependencies = {}) {
    this.taskDraftService = dependencies.taskDraftService ?? new TaskDraftServiceImpl();
    this.taskMemoryService = dependencies.taskMemoryService ?? new TaskMemoryServiceImpl();
    this.promptDraftService = dependencies.promptDraftService ?? new PromptDraftServiceImpl();
    this.taskStore = dependencies.taskStore ?? null;
    
    if (this.taskStore) {
      this.loadPersistedState();
    }
  }

  private loadPersistedState(): void {
    if (!this.taskStore) return;

    const drafts = this.taskStore.loadAllTaskDrafts();
    for (const draft of drafts) {
      this.taskDraftStore.set(draft.taskId, draft);
    }

    const memories = this.taskStore.loadAllTaskMemories();
    for (const memory of memories) {
      this.taskMemoryStore.set(memory.taskId, memory);
    }

    for (const draft of drafts) {
      const prompts = this.taskStore.loadPromptDrafts(draft.taskId);
      this.promptDraftStore.set(draft.taskId, prompts);

      const approvals = this.taskStore.loadApprovalRecords(draft.taskId);
      this.approvalRecordStore.set(draft.taskId, approvals);
    }
  }

  createDraftFromText(inputText: string): CreateDraftFromTextResult {
    const protocol = this.parseCreateTaskProtocol(inputText);
    const taskDraft = this.taskDraftService.createFromProtocol(protocol);
    const taskMemory = this.taskMemoryService.initializeFromDraft(taskDraft);

    this.taskDraftStore.set(taskDraft.taskId, taskDraft);
    this.taskMemoryStore.set(taskDraft.taskId, taskMemory);
    this.promptDraftStore.set(taskDraft.taskId, []);
    this.approvalRecordStore.set(taskDraft.taskId, []);

    if (this.taskStore) {
      this.taskStore.saveTaskDraft(taskDraft);
      this.taskStore.saveTaskMemory(taskMemory);
    }

    return {
      taskDraft,
      taskMemory,
    };
  }

  async generatePromptDraft(taskId: string): Promise<GeneratePromptDraftResult> {
    const taskDraft = this.requireTaskDraft(taskId);
    const taskMemory = this.requireTaskMemory(taskId);

    const promptDraft = await this.promptDraftService.buildPromptDraft({
      taskDraft,
      taskMemory,
    });

    this.storePromptDraft(promptDraft, taskMemory);
    const promptGeneratedDraft = this.updateTaskStatus(taskDraft, transitionTaskStatus(taskDraft.status, TaskStatus.PROMPT_GENERATED));
    const waitingApprovalDraft = this.updateTaskStatus(promptGeneratedDraft, transitionTaskStatus(promptGeneratedDraft.status, TaskStatus.WAITING_APPROVAL));

    return {
      taskDraft: waitingApprovalDraft,
      promptDraft,
    };
  }

  approveDraft(input: ApproveDraftInput): ApproveDraftResult {
    const taskDraft = this.requireTaskDraft(input.taskId);
    const fromStatus = taskDraft.status;
    const approvedTaskDraft = this.updateTaskStatus(taskDraft, applyApprovalAction(taskDraft.status, ApprovalAction.APPROVE));

    const approvalRecord: ApprovalRecord = {
      taskId: approvedTaskDraft.taskId,
      action: ApprovalAction.APPROVE,
      operator: input.operator,
      comment: input.comment ?? '确认草案，等待下一阶段派发接入',
      fromStatus,
      toStatus: approvedTaskDraft.status,
      createdAt: new Date(),
    };
    this.appendApprovalRecord(approvedTaskDraft.taskId, approvalRecord);

    return {
      taskId: approvedTaskDraft.taskId,
      status: approvedTaskDraft.status,
      latestApprovalAction: approvalRecord,
      nextStageHint: this.getNextStageHint(approvedTaskDraft.status),
    };
  }

  async reviseDraft(input: ReviseDraftInput): Promise<ReviseDraftResult> {
    if (input.revisionText.trim().length === 0) {
      throw new Error(`修改草案失败：${ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING}，必须提供修改意见`);
    }

    const taskDraft = this.requireTaskDraft(input.taskId);
    const taskMemory = this.requireTaskMemory(input.taskId);
    const latestPromptDraft = this.getLatestPromptDraft(input.taskId);
    const fromStatus = taskDraft.status;

    if (latestPromptDraft === null) {
      throw new Error(`修改草案失败：${ControllerErrorCode.PROMPT_DRAFT_NOT_FOUND}，任务 ${input.taskId} 还没有可修改的 PromptDraft`);
    }

    const nextStatus = applyApprovalAction(taskDraft.status, ApprovalAction.REVISE);
    const revisedTaskDraft: TaskDraft = {
      ...taskDraft,
      status: nextStatus,
      updatedAt: new Date(),
    };
    const revisedMemory: TaskMemory = {
      ...taskMemory,
      userRevisionHistory: [
        ...taskMemory.userRevisionHistory,
        {
      revisionId: `${input.taskId}-rev-${taskMemory.userRevisionHistory.length + 1}`,
      operator: input.operator,
      comment: input.revisionText,
      targetVersion: latestPromptDraft.version,
      createdAt: new Date(),
        },
      ],
      updatedAt: new Date(),
    };

    const regeneratedPromptDraft = await this.promptDraftService.buildPromptDraft({
      taskDraft: revisedTaskDraft,
      taskMemory: revisedMemory,
    });

    this.taskDraftStore.set(revisedTaskDraft.taskId, revisedTaskDraft);
    this.taskMemoryStore.set(revisedMemory.taskId, revisedMemory);

    this.appendApprovalRecord(revisedTaskDraft.taskId, {
      taskId: revisedTaskDraft.taskId,
      action: ApprovalAction.REVISE,
      operator: input.operator,
      comment: input.revisionText,
      fromStatus,
      toStatus: TaskStatus.WAITING_APPROVAL,
      createdAt: new Date(),
    });

    this.storePromptDraft(regeneratedPromptDraft, revisedMemory);
    const promptGeneratedDraft = this.updateTaskStatus(revisedTaskDraft, transitionTaskStatus(revisedTaskDraft.status, TaskStatus.PROMPT_GENERATED));
    const waitingApprovalDraft = this.updateTaskStatus(
      promptGeneratedDraft,
      transitionTaskStatus(promptGeneratedDraft.status, TaskStatus.WAITING_APPROVAL),
    );

    return {
      taskId: waitingApprovalDraft.taskId,
      status: waitingApprovalDraft.status,
      draftVersion: regeneratedPromptDraft.version,
      draftSummary: regeneratedPromptDraft.summaryView,
      revisionRecorded: true,
      nextStageHint: this.getNextStageHint(waitingApprovalDraft.status),
    };
  }

  cancelTask(input: CancelTaskInput): CancelTaskResult {
    const taskDraft = this.requireTaskDraft(input.taskId);
    const fromStatus = taskDraft.status;
    const cancelledTaskDraft = this.updateTaskStatus(taskDraft, applyApprovalAction(taskDraft.status, ApprovalAction.CANCEL));

    const approvalRecord: ApprovalRecord = {
      taskId: cancelledTaskDraft.taskId,
      action: ApprovalAction.CANCEL,
      operator: input.operator,
      comment: input.comment ?? '任务已取消',
      fromStatus,
      toStatus: cancelledTaskDraft.status,
      createdAt: new Date(),
    };
    this.appendApprovalRecord(cancelledTaskDraft.taskId, approvalRecord);

    return {
      taskId: cancelledTaskDraft.taskId,
      status: cancelledTaskDraft.status,
      latestApprovalAction: approvalRecord,
      nextStageHint: this.getNextStageHint(cancelledTaskDraft.status),
    };
  }

  getDraftHistory(taskId: string): DraftHistoryResult {
    const taskDraft = this.requireTaskDraft(taskId);
    const promptDrafts = this.promptDraftStore.get(taskId) ?? [];

    if (promptDrafts.length === 0) {
      throw new Error(`查询草稿历史失败：${ControllerErrorCode.PROMPT_DRAFT_NOT_FOUND}，任务 ${taskId} 还没有草稿历史`);
    }

    const latestPromptDraft = promptDrafts[promptDrafts.length - 1];

    return {
      taskId: taskDraft.taskId,
      versions: promptDrafts.map((draft) => ({
        version: draft.version,
        summary: draft.summaryView,
        createdAt: draft.createdAt,
      })),
      latestVersion: latestPromptDraft.version,
      latestSummary: latestPromptDraft.summaryView,
    };
  }

  getTaskStatus(taskId: string): TaskStatusSnapshot {
    const taskDraft = this.requireTaskDraft(taskId);
    const latestPromptDraft = this.getLatestPromptDraft(taskId);
    const approvalRecords = this.approvalRecordStore.get(taskId) ?? [];
    const readableSummary = this.buildReadableSummary(
      taskDraft.taskId,
      taskDraft.projectKey,
      taskDraft.status,
      latestPromptDraft?.summaryView ?? null,
      approvalRecords.length === 0 ? null : approvalRecords[approvalRecords.length - 1],
      this.requireTaskMemory(taskId).executionSummary,
    );

    return {
      taskId: taskDraft.taskId,
      projectKey: taskDraft.projectKey,
      status: taskDraft.status,
      latestPromptDraftSummary: latestPromptDraft?.summaryView ?? null,
      latestApprovalAction: approvalRecords.length === 0 ? null : approvalRecords[approvalRecords.length - 1],
      userSummary: readableSummary.summary,
      readableSummary,
      nextStageHint: this.getNextStageHint(taskDraft.status),
      executionSummary: this.requireTaskMemory(taskId).executionSummary,
    };
  }

  listTasks(): TaskListItem[] {
    return Array.from(this.taskDraftStore.values())
      .map((taskDraft) => {
        const latestPromptDraft = this.getLatestPromptDraft(taskDraft.taskId);
        const approvalRecords = this.approvalRecordStore.get(taskDraft.taskId) ?? [];

        return {
          taskId: taskDraft.taskId,
          projectKey: taskDraft.projectKey,
          intent: taskDraft.intent,
          status: taskDraft.status,
          priority: taskDraft.priority,
          createdAt: taskDraft.createdAt,
          updatedAt: taskDraft.updatedAt,
          latestPromptDraftSummary: latestPromptDraft?.summaryView ?? null,
          latestApprovalAction: approvalRecords.length === 0 ? null : approvalRecords[approvalRecords.length - 1],
          nextStageHint: this.getNextStageHint(taskDraft.status),
          executionSummary: this.requireTaskMemory(taskDraft.taskId).executionSummary,
        };
      })
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  }

  getTaskDetail(taskId: string): TaskDetail {
    return {
      ...this.inspectTask(taskId),
      statusSnapshot: this.getTaskStatus(taskId),
    };
  }

  inspectTask(taskId: string): {
    taskDraft: TaskDraft;
    taskMemory: TaskMemory;
    promptDrafts: PromptDraft[];
    approvalRecords: ApprovalRecord[];
  } {
    return {
      taskDraft: this.requireTaskDraft(taskId),
      taskMemory: this.requireTaskMemory(taskId),
      promptDrafts: [...(this.promptDraftStore.get(taskId) ?? [])],
      approvalRecords: [...(this.approvalRecordStore.get(taskId) ?? [])],
    };
  }

  private parseCreateTaskProtocol(inputText: string): CreateTaskProtocol {
    const result = recognizeTaskProtocol(inputText);
    if (!result.ok) {
      throw new Error(`创建任务草案失败：${result.error.code}，${result.error.message}`);
    }

    if (result.data.command !== TaskProtocolCommandType.CREATE_TASK) {
      throw new Error(`创建任务草案失败：${ControllerErrorCode.INVALID_TASK_PROTOCOL}，当前输入不是研发任务创建协议`);
    }

    return result.data;
  }

  private requireTaskDraft(taskId: string): TaskDraft {
    const taskDraft = this.taskDraftStore.get(taskId);
    if (taskDraft === undefined) {
      throw new Error(`任务不存在：${ControllerErrorCode.TASK_DRAFT_NOT_FOUND}，未找到任务 ${taskId}`);
    }
    return taskDraft;
  }

  private requireTaskMemory(taskId: string): TaskMemory {
    const taskMemory = this.taskMemoryStore.get(taskId);
    if (taskMemory === undefined) {
      throw new Error(`任务记忆不存在：${ControllerErrorCode.TASK_MEMORY_NOT_FOUND}，未找到任务 ${taskId} 的记忆数据`);
    }
    return taskMemory;
  }

  private getLatestPromptDraft(taskId: string): PromptDraft | null {
    const drafts = this.promptDraftStore.get(taskId) ?? [];
    if (drafts.length === 0) {
      return null;
    }
    return drafts[drafts.length - 1];
  }

  private updateTaskStatus(taskDraft: TaskDraft, nextStatus: TaskStatus): TaskDraft {
    const updatedTaskDraft: TaskDraft = {
      ...taskDraft,
      status: nextStatus,
      updatedAt: new Date(),
    };

    this.taskDraftStore.set(taskDraft.taskId, updatedTaskDraft);
    
    if (this.taskStore) {
      this.taskStore.saveTaskDraft(updatedTaskDraft);
    }
    
    return updatedTaskDraft;
  }

  private storePromptDraft(promptDraft: PromptDraft, taskMemory: TaskMemory): void {
    const promptDrafts = this.promptDraftStore.get(promptDraft.taskId) ?? [];
    this.promptDraftStore.set(promptDraft.taskId, [...promptDrafts, promptDraft]);

    const updatedMemory = this.appendPromptDraftHistory(taskMemory, {
      version: promptDraft.version,
      summary: this.stringifySummary(promptDraft.summaryView),
      createdAt: promptDraft.createdAt,
    });

    this.taskMemoryStore.set(promptDraft.taskId, updatedMemory);
    
    if (this.taskStore) {
      this.taskStore.savePromptDraft(promptDraft);
      this.taskStore.saveTaskMemory(updatedMemory);
    }
  }

  private appendPromptDraftHistory(taskMemory: TaskMemory, entry: PromptDraftHistoryEntry): TaskMemory {
    const updatedMemory: TaskMemory = {
      ...taskMemory,
      promptDraftHistory: [...taskMemory.promptDraftHistory, entry],
      updatedAt: new Date(),
    };

    this.taskMemoryStore.set(taskMemory.taskId, updatedMemory);
    return updatedMemory;
  }

  private appendApprovalRecord(taskId: string, record: ApprovalRecord): void {
    const approvalRecords = this.approvalRecordStore.get(taskId) ?? [];
    this.approvalRecordStore.set(taskId, [...approvalRecords, record]);
    
    if (this.taskStore) {
      this.taskStore.saveApprovalRecord(record);
    }
  }

  private getNextStageHint(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.WAITING_APPROVAL:
        return '请继续确认、修改或取消当前草稿';
      case TaskStatus.APPROVED:
        return '草稿已确认，等待派发到可用 worker';
      case TaskStatus.DISPATCHED:
        return '任务已派发，等待 worker 拉取执行';
      case TaskStatus.RUNNING:
        return '任务执行中，可稍后查询状态';
      case TaskStatus.DONE:
        return '任务已执行完成，可查看执行摘要';
      case TaskStatus.FAILED:
        return '任务执行失败，请查看失败摘要并决定是否重新创建任务';
      case TaskStatus.CANCELLED:
        return '任务已取消，如需继续请重新创建任务';
      case TaskStatus.DRAFT:
        return '草稿已回退，可重新生成待确认草稿';
      case TaskStatus.PROMPT_GENERATED:
        return 'Prompt 草稿已生成，下一步应进入待确认';
      default:
        return '请继续推进当前任务状态';
    }
  }

  private stringifySummary(summaryView: PromptDraftSummaryView): string {
    return JSON.stringify(summaryView, null, 2);
  }

  private buildReadableSummary(
    taskId: string,
    projectKey: string,
    status: TaskStatus,
    latestPromptDraftSummary: PromptDraftSummaryView | null,
    latestApprovalAction: ApprovalRecord | null,
    executionSummary: ExecutionSummary | null,
  ): TaskStatusSnapshot['readableSummary'] {
    if ((status === TaskStatus.DISPATCHED || status === TaskStatus.RUNNING || status === TaskStatus.DONE || status === TaskStatus.FAILED) && executionSummary !== null) {
      const detailLines = [
        `执行摘要：${executionSummary.summary ?? executionSummary.note}`,
        `测试结果：${executionSummary.testResult ?? '未提供'}`,
        `改动文件：${executionSummary.changedFiles?.join('；') || '未提供'}`,
      ];

      if (executionSummary.risks && executionSummary.risks.length > 0) {
        detailLines.push(`风险：${executionSummary.risks.join('；')}`);
      }

      if (executionSummary.structuredError) {
        detailLines.push(`失败阶段：${executionSummary.structuredError.stage}`);
      }

      return {
        title: `任务 ${taskId} 执行摘要`,
        summary: executionSummary.summary ?? `项目 ${projectKey} 当前状态为 ${status}`,
        details: detailLines,
        suggestedReplies: [`#任务状态 ${taskId}`],
      };
    }

    const summaryLines = latestPromptDraftSummary === null
      ? ['当前还没有可展示的草稿摘要。']
      : [
          `目标：${latestPromptDraftSummary.goal}`,
          `范围：${latestPromptDraftSummary.scope.join('；') || '未提供'}`,
          `约束：${latestPromptDraftSummary.constraints.join('；') || '未提供'}`,
          `验收：${latestPromptDraftSummary.acceptanceCriteria.join('；') || '未提供'}`,
        ];

    if (latestApprovalAction !== null) {
      summaryLines.push(`最近动作：${latestApprovalAction.action}（执行人：${latestApprovalAction.operator}）`);
    }

    summaryLines.push(`下一步：${this.getNextStageHint(status)}`);

    return {
      title: `任务 ${taskId} 状态摘要`,
      summary: `项目 ${projectKey} 当前状态为 ${status}。${this.getNextStageHint(status)}`,
      details: summaryLines,
      suggestedReplies: [
        `#确认派发 ${taskId}`,
        `#修改草案 ${taskId}`,
        `#取消任务 ${taskId}`,
        `#任务状态 ${taskId}`,
      ],
    };
  }
}
