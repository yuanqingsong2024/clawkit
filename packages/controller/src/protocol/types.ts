import { ApprovalAction, ControllerErrorCode, TaskPriority } from '@clawkit/shared';

export enum TaskProtocolCommandType {
  CREATE_TASK = 'create_task',
  CONFIRM_DISPATCH = 'confirm_dispatch',
  REVISE_DRAFT = 'revise_draft',
  CANCEL_TASK = 'cancel_task',
  VIEW_STATUS = 'view_status',
}

export interface ProtocolError {
  code: ControllerErrorCode;
  message: string;
}

export interface CreateTaskProtocol {
  command: TaskProtocolCommandType.CREATE_TASK;
  projectKey: string;
  goal: string;
  constraints: string[];
  acceptanceCriteria: string[];
  priority?: TaskPriority;
  rawText: string;
}

export interface ConfirmDispatchProtocol {
  command: TaskProtocolCommandType.CONFIRM_DISPATCH;
  taskId: string;
  action: ApprovalAction.APPROVE;
  rawText: string;
}

export interface ReviseDraftProtocol {
  command: TaskProtocolCommandType.REVISE_DRAFT;
  taskId: string;
  action: ApprovalAction.REVISE;
  modification: string;
  rawText: string;
}

export interface CancelTaskProtocol {
  command: TaskProtocolCommandType.CANCEL_TASK;
  taskId: string;
  action: ApprovalAction.CANCEL;
  rawText: string;
}

export interface TaskStatusQueryProtocol {
  command: TaskProtocolCommandType.VIEW_STATUS;
  taskId: string;
  action: ApprovalAction.VIEW_STATUS;
  rawText: string;
}

export type TaskProtocol =
  | CreateTaskProtocol
  | ConfirmDispatchProtocol
  | ReviseDraftProtocol
  | CancelTaskProtocol
  | TaskStatusQueryProtocol;

export type TaskProtocolResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: ProtocolError;
    };
