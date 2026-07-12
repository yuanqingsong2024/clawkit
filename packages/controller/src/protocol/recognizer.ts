import { ControllerErrorCode } from '@clawkit/shared';

import {
  parseCancelTaskProtocol,
  parseConfirmDispatchProtocol,
  parseCreateTaskProtocol,
  parseReviseDraftProtocol,
  parseTaskStatusQueryProtocol,
} from './parser';
import { TaskProtocolCommandType, type TaskProtocol, type TaskProtocolResult } from './types';

function createError(message: string): TaskProtocolResult<never> {
  return {
    ok: false,
    error: {
      code: ControllerErrorCode.INVALID_TASK_PROTOCOL,
      message,
    },
  };
}

export function recognizeTaskProtocolCommand(input: string): TaskProtocolResult<TaskProtocolCommandType> {
  const normalized = input.replace(/\r\n/g, '\n').trim();

  if (normalized.startsWith('#研发任务')) {
    return {
      ok: true,
      data: TaskProtocolCommandType.CREATE_TASK,
    };
  }

  if (normalized.startsWith('#确认派发')) {
    return {
      ok: true,
      data: TaskProtocolCommandType.CONFIRM_DISPATCH,
    };
  }

  if (normalized.startsWith('#修改草案')) {
    return {
      ok: true,
      data: TaskProtocolCommandType.REVISE_DRAFT,
    };
  }

  if (normalized.startsWith('#取消任务')) {
    return {
      ok: true,
      data: TaskProtocolCommandType.CANCEL_TASK,
    };
  }

  if (normalized.startsWith('#任务状态')) {
    return {
      ok: true,
      data: TaskProtocolCommandType.VIEW_STATUS,
    };
  }

  return createError('无法识别输入协议，请使用 #研发任务、#确认派发、#修改草案、#取消任务 或 #任务状态');
}

export function recognizeTaskProtocol(input: string): TaskProtocolResult<TaskProtocol> {
  const command = recognizeTaskProtocolCommand(input);
  if (!command.ok) {
    return command;
  }

  switch (command.data) {
    case TaskProtocolCommandType.CREATE_TASK:
      return parseCreateTaskProtocol(input);
    case TaskProtocolCommandType.CONFIRM_DISPATCH:
      return parseConfirmDispatchProtocol(input);
    case TaskProtocolCommandType.REVISE_DRAFT:
      return parseReviseDraftProtocol(input);
    case TaskProtocolCommandType.CANCEL_TASK:
      return parseCancelTaskProtocol(input);
    case TaskProtocolCommandType.VIEW_STATUS:
      return parseTaskStatusQueryProtocol(input);
    default:
      return createError('无法识别输入协议，请检查命令头是否正确');
  }
}
