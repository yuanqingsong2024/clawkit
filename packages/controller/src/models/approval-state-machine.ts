import { ApprovalAction, ControllerErrorCode, TaskStatus } from '@clawkit/shared';

const TaskStatusTransitions: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  [TaskStatus.DRAFT]: [TaskStatus.PROMPT_GENERATED, TaskStatus.CANCELLED],
  [TaskStatus.PROMPT_GENERATED]: [TaskStatus.DRAFT, TaskStatus.WAITING_APPROVAL, TaskStatus.CANCELLED],
  [TaskStatus.WAITING_APPROVAL]: [TaskStatus.DRAFT, TaskStatus.APPROVED, TaskStatus.CANCELLED],
  [TaskStatus.APPROVED]: [TaskStatus.DRAFT, TaskStatus.DISPATCHED, TaskStatus.CANCELLED],
  [TaskStatus.DISPATCHED]: [TaskStatus.RUNNING, TaskStatus.CANCELLED],
  [TaskStatus.RUNNING]: [TaskStatus.DONE, TaskStatus.FAILED, TaskStatus.CANCELLED],
  [TaskStatus.DONE]: [],
  [TaskStatus.FAILED]: [TaskStatus.DRAFT, TaskStatus.CANCELLED],
  [TaskStatus.CANCELLED]: [],
};

export const TaskStatusTransitionMap: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = TaskStatusTransitions;

export const ApprovalStateTransitions: Readonly<Record<TaskStatus, Partial<Record<ApprovalAction, TaskStatus>>>> = {
  [TaskStatus.DRAFT]: {
    [ApprovalAction.CANCEL]: TaskStatus.CANCELLED,
    [ApprovalAction.VIEW_STATUS]: TaskStatus.DRAFT,
  },
  [TaskStatus.PROMPT_GENERATED]: {
    [ApprovalAction.REVISE]: TaskStatus.DRAFT,
    [ApprovalAction.CANCEL]: TaskStatus.CANCELLED,
    [ApprovalAction.VIEW_STATUS]: TaskStatus.PROMPT_GENERATED,
  },
  [TaskStatus.WAITING_APPROVAL]: {
    [ApprovalAction.APPROVE]: TaskStatus.APPROVED,
    [ApprovalAction.REVISE]: TaskStatus.DRAFT,
    [ApprovalAction.CANCEL]: TaskStatus.CANCELLED,
    [ApprovalAction.VIEW_STATUS]: TaskStatus.WAITING_APPROVAL,
  },
  [TaskStatus.APPROVED]: {
    [ApprovalAction.CANCEL]: TaskStatus.CANCELLED,
    [ApprovalAction.VIEW_STATUS]: TaskStatus.APPROVED,
  },
  [TaskStatus.DISPATCHED]: {
    [ApprovalAction.CANCEL]: TaskStatus.CANCELLED,
    [ApprovalAction.VIEW_STATUS]: TaskStatus.DISPATCHED,
  },
  [TaskStatus.RUNNING]: {
    [ApprovalAction.CANCEL]: TaskStatus.CANCELLED,
    [ApprovalAction.VIEW_STATUS]: TaskStatus.RUNNING,
  },
  [TaskStatus.DONE]: {
    [ApprovalAction.VIEW_STATUS]: TaskStatus.DONE,
  },
  [TaskStatus.FAILED]: {
    [ApprovalAction.REVISE]: TaskStatus.DRAFT,
    [ApprovalAction.CANCEL]: TaskStatus.CANCELLED,
    [ApprovalAction.VIEW_STATUS]: TaskStatus.FAILED,
  },
  [TaskStatus.CANCELLED]: {
    [ApprovalAction.VIEW_STATUS]: TaskStatus.CANCELLED,
  },
};

export function getAllowedTaskTransitions(currentStatus: TaskStatus): readonly TaskStatus[] {
  return TaskStatusTransitionMap[currentStatus];
}

export function canTransitionTaskStatus(currentStatus: TaskStatus, nextStatus: TaskStatus): boolean {
  return getAllowedTaskTransitions(currentStatus).includes(nextStatus);
}

export function assertTaskStatusTransition(currentStatus: TaskStatus, nextStatus: TaskStatus): void {
  if (!canTransitionTaskStatus(currentStatus, nextStatus)) {
    throw new Error(
      `${ControllerErrorCode.INVALID_TASK_STATUS_TRANSITION}：不允许从 ${currentStatus} 进入 ${nextStatus}`,
    );
  }
}

export function transitionTaskStatus(currentStatus: TaskStatus, nextStatus: TaskStatus): TaskStatus {
  assertTaskStatusTransition(currentStatus, nextStatus);
  return nextStatus;
}

export function getNextTaskStatusForAction(currentStatus: TaskStatus, action: ApprovalAction): TaskStatus | null {
  return ApprovalStateTransitions[currentStatus][action] ?? null;
}

export function canApplyApprovalAction(currentStatus: TaskStatus, action: ApprovalAction): boolean {
  return getNextTaskStatusForAction(currentStatus, action) !== null;
}

export function applyApprovalAction(currentStatus: TaskStatus, action: ApprovalAction): TaskStatus {
  const nextStatus = getNextTaskStatusForAction(currentStatus, action);

  if (nextStatus === null) {
    throw new Error(
      `${ControllerErrorCode.INVALID_APPROVAL_ACTION}：状态 ${currentStatus} 不支持动作 ${action}`,
    );
  }

  if (nextStatus !== currentStatus) {
    assertTaskStatusTransition(currentStatus, nextStatus);
  }

  return nextStatus;
}

export const TaskDraftLifecycleSequence: readonly TaskStatus[] = [
  TaskStatus.DRAFT,
  TaskStatus.PROMPT_GENERATED,
  TaskStatus.WAITING_APPROVAL,
  TaskStatus.APPROVED,
];
