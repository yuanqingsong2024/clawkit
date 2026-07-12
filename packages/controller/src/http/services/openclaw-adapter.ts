import { randomUUID } from 'node:crypto';

import { ControllerErrorCode, TaskStatus } from '@clawkit/shared';

import { TaskProtocolCommandType, recognizeTaskProtocol } from '../../protocol';
import { HttpError } from '../errors/http-error';
import { buildSuccessResponse, type ApiSuccessResponse } from '../types/api-response';
import type { ControllerApiService } from './controller-api-service';
import { DraftResponseFormatter } from './draft-response-formatter';
import type { OpenClawTaskRequest } from './controller-api-service';
import type { OpenClawWebhookRequest, OpenClawWebhookResponseData } from './openclaw-response';
import { ResultResponseFormatter } from './result-response-formatter';

export class OpenClawAdapter {
  private readonly draftFormatter: DraftResponseFormatter;

  private readonly resultFormatter: ResultResponseFormatter;

  constructor(private readonly apiService: ControllerApiService) {
    this.draftFormatter = new DraftResponseFormatter();
    this.resultFormatter = new ResultResponseFormatter();
  }

  async handleWebhook(
    payload: OpenClawWebhookRequest,
    authorizationHeader?: string,
  ): Promise<ApiSuccessResponse<OpenClawWebhookResponseData>> {
    this.ensureAuthorized(authorizationHeader);
    const request = this.toTaskRequest(payload);
    const context = {
      requestId: request.requestId,
      sessionKey: payload.sessionKey?.trim() || request.conversation.sessionId,
    };

    switch (request.action) {
      case 'create_task': {
        const created = await this.apiService.ingestTaskText(request.data.text ?? '');
        return buildSuccessResponse(
          'controller.openclaw.webhook.draft_ready',
          '研发任务已创建，已生成草稿摘要',
          this.draftFormatter.formatCreated(created.taskDraft, created.promptDraft, created.status, context),
        );
      }
      case 'revise_draft': {
        const revised = await this.apiService.reviseDraft(
          request.data.taskId ?? '',
          this.buildOperatorName(request),
          request.data.revisionText ?? '',
        );
        const promptDraft = this.apiService.getLatestDraft(revised.taskId);
        const taskDraft = this.apiService.getTaskDraft(revised.taskId);
        const statusSnapshot = this.apiService.getTaskStatus(revised.taskId);
        return buildSuccessResponse(
          'controller.openclaw.webhook.draft_revised',
          '草稿已修改，已返回最新草稿摘要',
          this.draftFormatter.formatRevised(taskDraft, promptDraft, statusSnapshot, context),
        );
      }
      case 'approve_draft': {
        const approved = this.apiService.approveDraftAndDispatch(
          request.data.taskId ?? '',
          this.buildOperatorName(request),
          request.data.comment,
        );
        return buildSuccessResponse(
          approved.status === TaskStatus.DISPATCHED || approved.status === TaskStatus.RUNNING
            ? 'controller.openclaw.webhook.execution_started'
            : 'controller.openclaw.webhook.approved',
          approved.status === TaskStatus.DISPATCHED || approved.status === TaskStatus.RUNNING
            ? '草稿已确认，任务开始执行'
            : '草稿已确认，但暂未进入执行',
          this.resultFormatter.format(approved.statusSnapshot, {
            ...context,
            dispatchErrorMessage: approved.dispatchErrorMessage,
          }),
        );
      }
      case 'cancel_task': {
        const cancelled = this.apiService.cancelTask(
          request.data.taskId ?? '',
          this.buildOperatorName(request),
          request.data.comment,
        );
        const statusSnapshot = this.apiService.getTaskStatus(cancelled.taskId);
        return buildSuccessResponse(
          'controller.openclaw.webhook.cancelled',
          '任务已取消',
          this.resultFormatter.format(statusSnapshot, context),
        );
      }
      case 'query_status': {
        const statusSnapshot = this.apiService.getTaskStatus(request.data.taskId ?? '');
        if (
          statusSnapshot.status === TaskStatus.WAITING_APPROVAL
          || statusSnapshot.status === TaskStatus.PROMPT_GENERATED
          || statusSnapshot.status === TaskStatus.DRAFT
        ) {
          const promptDraft = this.apiService.getLatestDraft(request.data.taskId ?? '');
          const taskDraft = this.apiService.getTaskDraft(request.data.taskId ?? '');
          return buildSuccessResponse(
            'controller.openclaw.webhook.status_draft',
            '任务状态查询成功',
            this.draftFormatter.formatStatus(taskDraft, promptDraft, statusSnapshot, context),
          );
        }

        return buildSuccessResponse(
          'controller.openclaw.webhook.status_result',
          '任务状态查询成功',
          this.resultFormatter.format(statusSnapshot, context),
        );
      }
    }
  }

  private toTaskRequest(payload: OpenClawWebhookRequest): OpenClawTaskRequest {
    this.ensureWebhookPayload(payload);
    const protocolResult = recognizeTaskProtocol(payload.message);

    if (!protocolResult.ok) {
      throw new HttpError({
        statusCode: 400,
        errorCode: protocolResult.error.code,
        message: `OpenClaw webhook 消息无法识别：${protocolResult.error.message}`,
        details: {
          message: payload.message,
        },
      });
    }

    const requestId = payload.requestId?.trim() || randomUUID();
    const sessionId = payload.sessionKey?.trim() || `openclaw-${requestId}`;

    switch (protocolResult.data.command) {
      case TaskProtocolCommandType.CREATE_TASK:
        return this.buildRequestBase(payload, requestId, sessionId, 'create_task', {
          text: payload.message,
        });
      case TaskProtocolCommandType.CONFIRM_DISPATCH:
        return this.buildRequestBase(payload, requestId, sessionId, 'approve_draft', {
          taskId: protocolResult.data.taskId,
          comment: this.readOptionalMetadataText(payload.metadata, 'comment'),
        });
      case TaskProtocolCommandType.REVISE_DRAFT:
        return this.buildRequestBase(payload, requestId, sessionId, 'revise_draft', {
          taskId: protocolResult.data.taskId,
          revisionText: protocolResult.data.modification,
        });
      case TaskProtocolCommandType.CANCEL_TASK:
        return this.buildRequestBase(payload, requestId, sessionId, 'cancel_task', {
          taskId: protocolResult.data.taskId,
          comment: this.readOptionalMetadataText(payload.metadata, 'comment'),
        });
      case TaskProtocolCommandType.VIEW_STATUS:
        return this.buildRequestBase(payload, requestId, sessionId, 'query_status', {
          taskId: protocolResult.data.taskId,
        });
    }
  }

  private buildRequestBase(
    payload: OpenClawWebhookRequest,
    requestId: string,
    sessionId: string,
    action: OpenClawTaskRequest['action'],
    data: OpenClawTaskRequest['data'],
  ): OpenClawTaskRequest {
    return {
      requestId,
      source: 'openclaw',
      conversation: {
        sessionId,
      },
      operator: {
        id: payload.operator.id,
        name: payload.operator.name,
      },
      action,
      data,
    };
  }

  private ensureAuthorized(authorizationHeader?: string): void {
    const expectedToken = process.env.OPENCLAW_WEBHOOK_TOKEN?.trim();

    if (!expectedToken) {
      throw new HttpError({
        statusCode: 503,
        errorCode: 'controller.openclaw.token_not_configured',
        message: 'Controller 未配置 OpenClaw webhook token，请先设置 OPENCLAW_WEBHOOK_TOKEN',
      });
    }

    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      throw new HttpError({
        statusCode: 401,
        errorCode: 'controller.openclaw.unauthorized',
        message: '缺少 OpenClaw webhook 鉴权信息，请使用 Bearer token',
      });
    }

    const token = authorizationHeader.slice('Bearer '.length).trim();
    if (token !== expectedToken) {
      throw new HttpError({
        statusCode: 401,
        errorCode: 'controller.openclaw.unauthorized',
        message: 'OpenClaw webhook token 无效',
      });
    }
  }

  private ensureWebhookPayload(payload: OpenClawWebhookRequest): void {
    if (payload.source !== 'openclaw') {
      throw new HttpError({
        statusCode: 400,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_INVALID,
        message: 'OpenClaw webhook 字段 source 必须为 openclaw',
        details: { field: 'source', value: payload.source },
      });
    }

    if (payload.message.trim().length === 0) {
      throw new HttpError({
        statusCode: 400,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING,
        message: 'OpenClaw webhook 字段 message 不能为空',
        details: { field: 'message' },
      });
    }

    if (payload.operator.id.trim().length === 0) {
      throw new HttpError({
        statusCode: 400,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING,
        message: 'OpenClaw webhook 字段 operator.id 不能为空',
        details: { field: 'operator.id' },
      });
    }
  }

  private buildOperatorName(request: OpenClawTaskRequest): string {
    return request.operator.name?.trim() || request.operator.id;
  }

  private readOptionalMetadataText(
    metadata: OpenClawWebhookRequest['metadata'],
    key: string,
  ): string | undefined {
    const value = metadata?.[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }
}
