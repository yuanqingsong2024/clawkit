import { ControllerErrorCode } from '@clawkit/shared';

import type { PromptDraft } from '../../models/prompt-draft';
import type { TaskDraft } from '../../models/task-draft';
import type {
  ApproveDraftResult,
  CancelTaskResult,
  DraftHistoryResult,
  ReviseDraftResult,
  TaskDetail,
  TaskListItem,
  TaskStatusSnapshot,
} from '../../services/controller-flow-service';
import { ControllerFlowServiceImpl } from '../../services/controller-flow-service';
import { HttpError } from '../errors/http-error';

export interface IngestTaskTextResult {
  taskDraft: TaskDraft;
  promptDraft: PromptDraft;
  status: TaskStatusSnapshot;
}

export interface OpenClawTaskRequest {
  requestId: string;
  source: 'openclaw';
  conversation: {
    sessionId: string;
    messageId?: string;
  };
  operator: {
    id: string;
    name?: string;
  };
  action: 'create_task' | 'approve_draft' | 'revise_draft' | 'cancel_task' | 'query_status';
  data: {
    text?: string;
    taskId?: string;
    revisionText?: string;
    comment?: string;
  };
}

export interface OpenClawDraftMessage {
  taskId: string;
  title: string;
  summary: string;
  projectKey: string;
  status: TaskStatusSnapshot['status'];
  suggestedReplies: string[];
  rawDraftSummary: PromptDraft['summaryView'];
  body: string;
  draftVersion: PromptDraft['version'];
}

export interface OpenClawDraftResponseData {
  taskId: string;
  projectKey: string;
  status: TaskStatusSnapshot['status'];
  taskDraft: TaskDraft;
  promptDraft: PromptDraft;
  statusSnapshot: TaskStatusSnapshot;
  draftMessage: OpenClawDraftMessage;
}

export interface OpenClawActionResultData {
  taskId: string;
  projectKey: string;
  status: TaskStatusSnapshot['status'];
  resultMessage: string;
  nextStageHint: string;
  dispatch?: {
    dispatchId: string;
    workerId: string;
    dispatchStatus: string;
    createdAt: Date;
  };
  dispatchErrorMessage?: string;
  statusSnapshot: TaskStatusSnapshot;
}

export interface ApproveAndDispatchResult extends ApproveDraftResult {
  projectKey: string;
  dispatch?: {
    dispatchId: string;
    workerId: string;
    dispatchStatus: string;
    createdAt: Date;
  };
  dispatchErrorMessage?: string;
  statusSnapshot: TaskStatusSnapshot;
}

export interface OpenClawStatusData {
  taskId: string;
  projectKey: string;
  status: TaskStatusSnapshot['status'];
  summary: string;
  readableSummary: TaskStatusSnapshot['readableSummary'];
  statusSnapshot: TaskStatusSnapshot;
}

export interface OpenClawResponseEnvelope<T> {
  statusCode?: number;
  code: string;
  message: string;
  data: T;
}

export interface TaskListResult {
  tasks: TaskListItem[];
  total: number;
}

interface DispatchLookupService {
  dispatchTask(taskId: string): {
    dispatchId: string;
    workerId: string;
    dispatchStatus: string;
    createdAt: Date;
  };

  getDispatchByTaskId(taskId: string): {
    dispatchId: string;
    workerId: string;
    dispatchStatus: string;
    createdAt: Date;
  } | undefined;
}

interface WorkerLookupService {
  getWorker(workerId: string): {
    workerId: string;
    name: string;
    status: string;
  } | undefined;
}

export class ControllerApiService {
  private readonly flowService: ControllerFlowServiceImpl;

  private dispatchService?: DispatchLookupService;
  private workerRegistry?: WorkerLookupService;

  constructor(
    flowService?: ControllerFlowServiceImpl,
    dispatchService?: DispatchLookupService,
    workerRegistry?: WorkerLookupService,
  ) {
    this.flowService = flowService ?? new ControllerFlowServiceImpl();
    this.dispatchService = dispatchService;
    this.workerRegistry = workerRegistry;
  }

  async ingestTaskText(inputText: string): Promise<IngestTaskTextResult> {
    this.ensureTextInput(inputText);

    try {
      const draftResult = this.flowService.createDraftFromText(inputText);
      const promptResult = await this.flowService.generatePromptDraft(draftResult.taskDraft.taskId);
      const status = this.flowService.getTaskStatus(promptResult.taskDraft.taskId);

      return {
        taskDraft: promptResult.taskDraft,
        promptDraft: promptResult.promptDraft,
        status,
      };
    } catch (error) {
      throw this.mapError(error, '任务文本接入失败');
    }
  }

  async handleOpenClawRequest(
    payload: OpenClawTaskRequest,
  ): Promise<OpenClawResponseEnvelope<OpenClawDraftResponseData | OpenClawActionResultData | OpenClawStatusData>> {
    this.ensureOpenClawPayload(payload);

    switch (payload.action) {
      case 'create_task': {
        const result = await this.ingestTaskText(payload.data.text ?? '');
        return {
          statusCode: 201,
          code: 'controller.openclaw.task_draft_ready',
          message: 'OpenClaw 任务草稿已生成，可直接转发给用户确认',
          data: this.buildOpenClawDraftResponse(result),
        };
      }
      case 'approve_draft': {
        const approved = this.approveDraftAndDispatch(payload.data.taskId ?? '', this.buildOperatorName(payload), payload.data.comment);
        return {
          code: 'controller.openclaw.task_approved',
          message: 'OpenClaw 任务草稿已确认',
          data: {
            taskId: approved.taskId,
            projectKey: approved.projectKey,
            status: approved.status,
            resultMessage: approved.dispatch
              ? `草稿已确认，任务已派发给 worker ${approved.dispatch.workerId}，开始执行。`
              : approved.dispatchErrorMessage
                ? `草稿已确认，但暂时无法开始执行：${approved.dispatchErrorMessage}`
                : '草稿已确认，等待派发。',
            nextStageHint: approved.nextStageHint,
            dispatch: approved.dispatch,
            dispatchErrorMessage: approved.dispatchErrorMessage,
            statusSnapshot: approved.statusSnapshot,
          },
        };
      }
      case 'revise_draft': {
        const revised = await this.reviseDraft(
          payload.data.taskId ?? '',
          this.buildOperatorName(payload),
          payload.data.revisionText ?? '',
        );
        const promptDraft = this.getLatestDraft(revised.taskId);
        const statusSnapshot = this.getTaskStatus(revised.taskId);
        const taskDraft = this.getTaskDraft(revised.taskId);
        return {
          code: 'controller.openclaw.task_draft_revised',
          message: 'OpenClaw 任务草稿已更新，可将新草稿重新发给用户',
          data: {
            taskId: taskDraft.taskId,
            projectKey: taskDraft.projectKey,
            status: statusSnapshot.status,
            taskDraft,
            promptDraft,
            statusSnapshot,
            draftMessage: this.buildDraftMessage(taskDraft, promptDraft, statusSnapshot),
          },
        };
      }
      case 'cancel_task': {
        const cancelled = this.cancelTask(payload.data.taskId ?? '', this.buildOperatorName(payload), payload.data.comment);
        const statusSnapshot = this.getTaskStatus(cancelled.taskId);
        return {
          code: 'controller.openclaw.task_cancelled',
          message: 'OpenClaw 任务已取消',
          data: {
            taskId: cancelled.taskId,
            projectKey: statusSnapshot.projectKey,
            status: cancelled.status,
            resultMessage: '任务已取消，本阶段不会继续派发。如需继续，请重新创建任务。',
            nextStageHint: cancelled.nextStageHint,
            statusSnapshot,
          },
        };
      }
      case 'query_status': {
        const statusSnapshot = this.getTaskStatus(payload.data.taskId ?? '');
        return {
          code: 'controller.openclaw.task_status_fetched',
          message: 'OpenClaw 任务状态查询成功',
          data: {
            taskId: statusSnapshot.taskId,
            projectKey: statusSnapshot.projectKey,
            status: statusSnapshot.status,
            summary: statusSnapshot.userSummary,
            readableSummary: statusSnapshot.readableSummary,
            statusSnapshot,
          },
        };
      }
    }
  }

  getLatestDraft(taskId: string): PromptDraft {
    this.ensureTaskId(taskId);

    try {
      const inspected = this.flowService.inspectTask(taskId);
      const drafts = inspected.promptDrafts;
      if (drafts.length === 0) {
        throw new HttpError({
          statusCode: 404,
          errorCode: ControllerErrorCode.PROMPT_DRAFT_NOT_FOUND,
          message: `未找到任务 ${taskId} 的草稿`,
          details: { taskId },
        });
      }

      return drafts[drafts.length - 1];
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw this.mapError(error, '查询草稿失败');
    }
  }

  approveDraft(taskId: string, operator: string, comment?: string): ApproveDraftResult {
    this.ensureTaskId(taskId);
    this.ensureOperator(operator);

    try {
      return this.flowService.approveDraft({ taskId, operator, comment });
    } catch (error) {
      throw this.mapError(error, '确认草稿失败');
    }
  }

  approveDraftAndDispatch(taskId: string, operator: string, comment?: string): ApproveAndDispatchResult {
    const approved = this.approveDraft(taskId, operator, comment);
    let dispatch: ApproveAndDispatchResult['dispatch'];
    let dispatchErrorMessage: string | undefined;

    if (this.dispatchService) {
      try {
        const dispatchRecord = this.dispatchService.dispatchTask(taskId);
        dispatch = {
          dispatchId: dispatchRecord.dispatchId,
          workerId: dispatchRecord.workerId,
          dispatchStatus: dispatchRecord.dispatchStatus,
          createdAt: dispatchRecord.createdAt,
        };
      } catch (error) {
        dispatchErrorMessage = this.mapError(error, '任务派发失败').message;
      }
    }

    const statusSnapshot = this.getTaskStatus(taskId);

    return {
      ...approved,
      projectKey: statusSnapshot.projectKey,
      status: statusSnapshot.status,
      nextStageHint: dispatch
        ? '已确认，开始执行'
        : dispatchErrorMessage
          ? '已确认，但当前无法派发，请先处理 worker 或项目配置问题'
          : statusSnapshot.nextStageHint,
      dispatch,
      dispatchErrorMessage,
      statusSnapshot,
    };
  }

  async reviseDraft(taskId: string, operator: string, revisionText: string): Promise<ReviseDraftResult> {
    this.ensureTaskId(taskId);
    this.ensureOperator(operator);
    this.ensureRevisionText(revisionText);

    try {
      return await this.flowService.reviseDraft({ taskId, operator, revisionText });
    } catch (error) {
      throw this.mapError(error, '修改草稿失败');
    }
  }

  cancelTask(taskId: string, operator: string, comment?: string): CancelTaskResult {
    this.ensureTaskId(taskId);
    this.ensureOperator(operator);

    try {
      return this.flowService.cancelTask({ taskId, operator, comment });
    } catch (error) {
      throw this.mapError(error, '取消任务失败');
    }
  }

  getTaskStatus(taskId: string): TaskStatusSnapshot {
    this.ensureTaskId(taskId);

    try {
      const status = this.flowService.getTaskStatus(taskId);
      
      if (this.dispatchService && this.workerRegistry) {
        const dispatch = this.dispatchService.getDispatchByTaskId(taskId);
        if (dispatch) {
          status.dispatchInfo = {
            dispatchId: dispatch.dispatchId,
            workerId: dispatch.workerId,
            dispatchStatus: dispatch.dispatchStatus,
            createdAt: dispatch.createdAt,
          };
          
          const worker = this.workerRegistry.getWorker(dispatch.workerId);
          if (worker) {
            status.workerInfo = {
              workerId: worker.workerId,
              name: worker.name,
              status: worker.status,
            };
          }
        }
      }
      
      return status;
    } catch (error) {
      throw this.mapError(error, '查询任务状态失败');
    }
  }

  listTasks(): TaskListResult {
    const tasks = this.flowService.listTasks();

    return {
      tasks,
      total: tasks.length,
    };
  }

  getTaskDetail(taskId: string): TaskDetail {
    this.ensureTaskId(taskId);

    try {
      return this.flowService.getTaskDetail(taskId);
    } catch (error) {
      throw this.mapError(error, '查询任务详情失败');
    }
  }

  getTaskDraft(taskId: string): TaskDraft {
    this.ensureTaskId(taskId);

    try {
      return this.flowService.inspectTask(taskId).taskDraft;
    } catch (error) {
      throw this.mapError(error, '查询任务草稿失败');
    }
  }

  getDraftHistory(taskId: string): DraftHistoryResult {
    this.ensureTaskId(taskId);

    try {
      return this.flowService.getDraftHistory(taskId);
    } catch (error) {
      throw this.mapError(error, '查询草稿历史失败');
    }
  }

  private ensureTextInput(inputText: string): void {
    if (inputText.trim().length === 0) {
      throw new HttpError({
        statusCode: 400,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING,
        message: '请求体字段 text 不能为空',
        details: { field: 'text' },
      });
    }
  }

  private ensureOpenClawPayload(payload: OpenClawTaskRequest): void {
    this.ensureRequestId(payload.requestId);
    this.ensureSource(payload.source);
    this.ensureConversationSessionId(payload.conversation.sessionId);
    this.ensureOperator(payload.operator.id);
    this.ensureOpenClawAction(payload.action);

    switch (payload.action) {
      case 'create_task':
        this.ensureTextInput(payload.data.text ?? '');
        break;
      case 'approve_draft':
      case 'cancel_task':
      case 'query_status':
        this.ensureTaskId(payload.data.taskId ?? '');
        break;
      case 'revise_draft':
        this.ensureTaskId(payload.data.taskId ?? '');
        this.ensureRevisionText(payload.data.revisionText ?? '');
        break;
    }
  }

  private ensureRequestId(requestId: string): void {
    if (requestId.trim().length === 0) {
      throw new HttpError({
        statusCode: 400,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING,
        message: '请求字段 requestId 不能为空',
        details: { field: 'requestId' },
      });
    }
  }

  private ensureSource(source: string): void {
    if (source !== 'openclaw') {
      throw new HttpError({
        statusCode: 400,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_INVALID,
        message: '请求字段 source 必须为 openclaw',
        details: { field: 'source', value: source },
      });
    }
  }

  private ensureConversationSessionId(sessionId: string): void {
    if (sessionId.trim().length === 0) {
      throw new HttpError({
        statusCode: 400,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING,
        message: '请求字段 conversation.sessionId 不能为空',
        details: { field: 'conversation.sessionId' },
      });
    }
  }

  private ensureOpenClawAction(action: OpenClawTaskRequest['action']): void {
    const supportedActions: ReadonlyArray<OpenClawTaskRequest['action']> = [
      'create_task',
      'approve_draft',
      'revise_draft',
      'cancel_task',
      'query_status',
    ];

    if (!supportedActions.includes(action)) {
      throw new HttpError({
        statusCode: 400,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_INVALID,
        message: `请求字段 action 不支持：${action}`,
        details: { field: 'action', value: action },
      });
    }
  }

  private ensureTaskId(taskId: string): void {
    if (taskId.trim().length === 0) {
      throw new HttpError({
        statusCode: 400,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING,
        message: '请求字段 taskId 不能为空',
        details: { field: 'taskId' },
      });
    }
  }

  private ensureOperator(operator: string): void {
    if (operator.trim().length === 0) {
      throw new HttpError({
        statusCode: 400,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING,
        message: '请求字段 operator 不能为空',
        details: { field: 'operator' },
      });
    }
  }

  private ensureRevisionText(revisionText: string): void {
    if (revisionText.trim().length === 0) {
      throw new HttpError({
        statusCode: 400,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING,
        message: '请求字段 revisionText 不能为空',
        details: { field: 'revisionText' },
      });
    }
  }

  private buildOpenClawDraftResponse(result: IngestTaskTextResult): OpenClawDraftResponseData {
    return {
      taskId: result.taskDraft.taskId,
      projectKey: result.taskDraft.projectKey,
      status: result.status.status,
      taskDraft: result.taskDraft,
      promptDraft: result.promptDraft,
      statusSnapshot: result.status,
      draftMessage: this.buildDraftMessage(result.taskDraft, result.promptDraft, result.status),
    };
  }

  private buildDraftMessage(
    taskDraft: TaskDraft,
    promptDraft: PromptDraft,
    statusSnapshot: TaskStatusSnapshot,
  ): OpenClawDraftMessage {
    return {
      taskId: taskDraft.taskId,
      title: `请确认任务草稿：${taskDraft.intent}`,
      summary: `项目 ${taskDraft.projectKey} 已生成可确认草稿，当前状态：${statusSnapshot.status}`,
      projectKey: taskDraft.projectKey,
      status: statusSnapshot.status,
      suggestedReplies: [
        `#确认派发 ${taskDraft.taskId}`,
        `#修改草案 ${taskDraft.taskId}`,
        `#取消任务 ${taskDraft.taskId}`,
        `#任务状态 ${taskDraft.taskId}`,
      ],
      rawDraftSummary: promptDraft.summaryView,
      body: this.buildDraftMessageBody(promptDraft),
      draftVersion: promptDraft.version,
    };
  }

  private buildDraftMessageBody(promptDraft: PromptDraft): string {
    const summary = promptDraft.summaryView;

    return [
      `目标：${summary.goal}`,
      `范围：${summary.scope.join('；') || '未提供'}`,
      `约束：${summary.constraints.join('；') || '未提供'}`,
      `验收：${summary.acceptanceCriteria.join('；') || '未提供'}`,
      `确认清单：${summary.confirmationChecklist.join('；') || '未提供'}`,
    ].join('\n');
  }

  private buildOperatorName(payload: OpenClawTaskRequest): string {
    return payload.operator.name?.trim() || payload.operator.id;
  }

  private mapKnownClientError(errorCode: ControllerErrorCode, message: string): HttpError {
    const statusCode = errorCode === ControllerErrorCode.TASK_DRAFT_NOT_FOUND
      || errorCode === ControllerErrorCode.TASK_MEMORY_NOT_FOUND
      || errorCode === ControllerErrorCode.PROMPT_DRAFT_NOT_FOUND
      || errorCode === ControllerErrorCode.TASK_NOT_FOUND
      || errorCode === ControllerErrorCode.WORKER_NOT_FOUND
      || errorCode === ControllerErrorCode.PROJECT_CONFIG_NOT_FOUND
      ? 404
      : errorCode === ControllerErrorCode.NO_AVAILABLE_WORKER
        ? 409
        : 400;

    return new HttpError({
      statusCode,
      errorCode,
      message,
    });
  }

  private mapError(error: unknown, fallbackMessage: string): HttpError {
    if (error instanceof HttpError) {
      return error;
    }

    if (error instanceof Error) {
      const knownCodes: readonly ControllerErrorCode[] = [
        ControllerErrorCode.TASK_DRAFT_NOT_FOUND,
        ControllerErrorCode.TASK_MEMORY_NOT_FOUND,
        ControllerErrorCode.PROMPT_DRAFT_NOT_FOUND,
        ControllerErrorCode.INVALID_TASK_PROTOCOL,
        ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING,
        ControllerErrorCode.TASK_PROTOCOL_FIELD_INVALID,
        ControllerErrorCode.INVALID_APPROVAL_ACTION,
        ControllerErrorCode.INVALID_TASK_STATUS_TRANSITION,
        ControllerErrorCode.PROMPT_DRAFT_VERSION_CONFLICT,
        ControllerErrorCode.PROMPT_ENGINE_NOT_CONFIGURED,
        ControllerErrorCode.PERSISTENCE_INIT_FAILED,
        ControllerErrorCode.TASK_NOT_FOUND,
        ControllerErrorCode.WORKER_NOT_FOUND,
        ControllerErrorCode.NO_AVAILABLE_WORKER,
        ControllerErrorCode.PROJECT_CONFIG_NOT_FOUND,
      ];

      for (const code of knownCodes) {
        if (error.message.includes(code)) {
          return this.mapKnownClientError(code, error.message);
        }
      }

      return new HttpError({
        statusCode: 500,
        errorCode: 'controller.internal_error',
        message: fallbackMessage,
        details: { cause: error.message },
      });
    }

    return new HttpError({
      statusCode: 500,
      errorCode: 'controller.internal_error',
      message: fallbackMessage,
      details: { cause: 'unknown' },
    });
  }
}
