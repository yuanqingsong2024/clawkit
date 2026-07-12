export enum TaskStatus {
  DRAFT = 'draft',
  PROMPT_GENERATED = 'prompt_generated',
  WAITING_APPROVAL = 'waiting_approval',
  APPROVED = 'approved',
  DISPATCHED = 'dispatched',
  RUNNING = 'running',
  DONE = 'done',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum TaskPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum ApprovalAction {
  APPROVE = 'approve',
  REVISE = 'revise',
  CANCEL = 'cancel',
  VIEW_STATUS = 'view_status',
}
