import { ControllerErrorCode } from '@clawkit/shared';

import {
  TaskProtocolCommandType,
  type CreateTaskProtocol,
  type TaskProtocolResult,
  type ConfirmDispatchProtocol,
  type ReviseDraftProtocol,
  type CancelTaskProtocol,
  type TaskStatusQueryProtocol,
} from './types';
import { ApprovalAction } from '@clawkit/shared';

interface ParsedFieldMap {
  项目?: string;
  目标?: string;
  约束?: string;
  验收?: string;
  修改?: string;
}

function createError(code: ControllerErrorCode, message: string): TaskProtocolResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

function normalizeInput(input: string): string {
  return input.replace(/\r\n/g, '\n').trim();
}

function splitNonEmptyLines(value: string): string[] {
  return value
    .split(/\n|；|;/)
    .map((item) => item.replace(/^[-*•]\s*/, '').trim())
    .filter((item) => item.length > 0);
}

function parseLabeledBody(bodyLines: string[], allowedLabels: readonly string[]): TaskProtocolResult<ParsedFieldMap> {
  const fields: ParsedFieldMap = {};
  let currentLabel: keyof ParsedFieldMap | null = null;

  for (const rawLine of bodyLines) {
    const line = rawLine.trim();

    if (line.length === 0) {
      continue;
    }

    const matched = line.match(/^([\u4e00-\u9fa5]+)\s*:\s*(.*)$/);
    if (matched !== null) {
      const label = matched[1];
      const value = matched[2].trim();

      if (!allowedLabels.includes(label)) {
        return createError(ControllerErrorCode.TASK_PROTOCOL_FIELD_INVALID, `无法识别字段“${label}”，请检查协议格式`);
      }

      currentLabel = label as keyof ParsedFieldMap;
      fields[currentLabel] = value;
      continue;
    }

    if (currentLabel === null) {
      return createError(ControllerErrorCode.TASK_PROTOCOL_FIELD_INVALID, `无法识别内容“${line}”，请检查字段名是否完整`);
    }

    const currentValue = fields[currentLabel] ?? '';
    fields[currentLabel] = `${currentValue}\n${line}`.trim();
  }

  return {
    ok: true,
    data: fields,
  };
}

function parseTaskIdCommand(
  input: string,
  commandPattern: RegExp,
  missingMessage: string,
): TaskProtocolResult<{ taskId: string; rawText: string }> {
  const normalized = normalizeInput(input);
  const matched = normalized.match(commandPattern);

  if (matched === null) {
    return createError(ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING, missingMessage);
  }

  return {
    ok: true,
    data: {
      taskId: matched[1],
      rawText: normalized,
    },
  };
}

export function parseCreateTaskProtocol(input: string): TaskProtocolResult<CreateTaskProtocol> {
  const normalized = normalizeInput(input);
  const lines = normalized.split('\n');

  if (lines[0] !== '#研发任务') {
    return createError(ControllerErrorCode.INVALID_TASK_PROTOCOL, '创建研发任务协议必须以“#研发任务”开头');
  }

  const parsedFields = parseLabeledBody(lines.slice(1), ['项目', '目标', '约束', '验收']);
  if (!parsedFields.ok) {
    return parsedFields;
  }

  const { 项目, 目标, 约束, 验收 } = parsedFields.data;
  const projectKey = 项目?.trim() ?? '';
  const goal = 目标?.trim() ?? '';

  if (projectKey.length === 0) {
    return createError(ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING, '创建研发任务时必须提供“项目”字段');
  }

  if (goal.length === 0) {
    return createError(ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING, '创建研发任务时必须提供“目标”字段');
  }

  return {
    ok: true,
    data: {
      command: TaskProtocolCommandType.CREATE_TASK,
      projectKey,
      goal,
      constraints: 约束 === undefined ? [] : splitNonEmptyLines(约束),
      acceptanceCriteria: 验收 === undefined ? [] : splitNonEmptyLines(验收),
      rawText: normalized,
    },
  };
}

export function parseConfirmDispatchProtocol(input: string): TaskProtocolResult<ConfirmDispatchProtocol> {
  const parsed = parseTaskIdCommand(input, /^#确认派发\s+(\S+)$/, '确认派发协议必须提供 taskId，例如“#确认派发 task-001”');
  if (!parsed.ok) {
    return parsed;
  }

  return {
    ok: true,
    data: {
      command: TaskProtocolCommandType.CONFIRM_DISPATCH,
      taskId: parsed.data.taskId,
      action: ApprovalAction.APPROVE,
      rawText: parsed.data.rawText,
    },
  };
}

export function parseReviseDraftProtocol(input: string): TaskProtocolResult<ReviseDraftProtocol> {
  const normalized = normalizeInput(input);
  const lines = normalized.split('\n');
  const headMatched = lines[0]?.match(/^#修改草案\s+(\S+)$/);

  if (headMatched === null || headMatched === undefined) {
    return createError(ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING, '修改草案协议必须提供 taskId，例如“#修改草案 task-001”');
  }

  const parsedFields = parseLabeledBody(lines.slice(1), ['修改']);
  if (!parsedFields.ok) {
    return parsedFields;
  }

  const modification = parsedFields.data.修改?.trim() ?? '';
  if (modification.length === 0) {
    return createError(ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING, '修改草案协议必须提供“修改”字段');
  }

  return {
    ok: true,
    data: {
      command: TaskProtocolCommandType.REVISE_DRAFT,
      taskId: headMatched[1],
      action: ApprovalAction.REVISE,
      modification,
      rawText: normalized,
    },
  };
}

export function parseCancelTaskProtocol(input: string): TaskProtocolResult<CancelTaskProtocol> {
  const parsed = parseTaskIdCommand(input, /^#取消任务\s+(\S+)$/, '取消任务协议必须提供 taskId，例如“#取消任务 task-001”');
  if (!parsed.ok) {
    return parsed;
  }

  return {
    ok: true,
    data: {
      command: TaskProtocolCommandType.CANCEL_TASK,
      taskId: parsed.data.taskId,
      action: ApprovalAction.CANCEL,
      rawText: parsed.data.rawText,
    },
  };
}

export function parseTaskStatusQueryProtocol(input: string): TaskProtocolResult<TaskStatusQueryProtocol> {
  const parsed = parseTaskIdCommand(input, /^#任务状态\s+(\S+)$/, '任务状态协议必须提供 taskId，例如“#任务状态 task-001”');
  if (!parsed.ok) {
    return parsed;
  }

  return {
    ok: true,
    data: {
      command: TaskProtocolCommandType.VIEW_STATUS,
      taskId: parsed.data.taskId,
      action: ApprovalAction.VIEW_STATUS,
      rawText: parsed.data.rawText,
    },
  };
}
