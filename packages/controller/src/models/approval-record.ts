import { ApprovalAction, TaskStatus } from '@clawkit/shared';

export interface ApprovalRecord {
  taskId: string;
  action: ApprovalAction;
  operator: string;
  comment: string;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  createdAt: Date;
}
