export type TaskActionType = 'revise' | 'approve' | 'cancel';

function normalizeTaskState(value: string): string {
  return value.trim().toUpperCase();
}

export function toneForTaskStatus(status: string): 'success' | 'info' | 'warning' | 'failed' | 'neutral' {
  const normalizedStatus = normalizeTaskState(status);

  if (normalizedStatus === 'DONE') return 'success';
  if (normalizedStatus === 'RUNNING' || normalizedStatus === 'DISPATCHED') return 'info';
  if (normalizedStatus === 'WAITING_APPROVAL') return 'warning';
  if (normalizedStatus === 'FAILED' || normalizedStatus === 'CANCELLED') return 'failed';
  return 'neutral';
}

export function labelForTaskStatus(status: string): string {
  const normalizedStatus = normalizeTaskState(status);
  const labels: Record<string, string> = {
    DRAFT: '草稿',
    PROMPT_GENERATED: '草案已生成',
    WAITING_APPROVAL: '等待审批',
    APPROVED: '已确认',
    DISPATCHED: '已派发',
    RUNNING: '运行中',
    DONE: '完成',
    FAILED: '失败',
    CANCELLED: '已取消',
  };

  return labels[normalizedStatus] || status;
}

export function toneForExecutionStatus(status: string): 'success' | 'info' | 'failed' | 'neutral' {
  if (status === 'done') return 'success';
  if (status === 'running') return 'info';
  if (status === 'failed') return 'failed';
  return 'neutral';
}

export function labelForExecutionStatus(status: string): string {
  const labels: Record<string, string> = {
    not_started: '未开始',
    running: '运行中',
    done: '完成',
    failed: '失败',
  };

  return labels[status] || status;
}

export function getAvailableTaskActions(status: string): TaskActionType[] {
  switch (normalizeTaskState(status)) {
    case 'DRAFT':
      return ['cancel'];
    case 'WAITING_APPROVAL':
      return ['revise', 'approve', 'cancel'];
    case 'PROMPT_GENERATED':
    case 'FAILED':
      return ['revise', 'cancel'];
    case 'APPROVED':
    case 'DISPATCHED':
    case 'RUNNING':
      return ['cancel'];
    default:
      return [];
  }
}

export function labelForTaskAction(action: TaskActionType): string {
  switch (action) {
    case 'revise':
      return '修改';
    case 'approve':
      return '确认';
    case 'cancel':
      return '取消';
    default:
      return action;
  }
}

export function getTaskActionHint(status: string): string {
  switch (normalizeTaskState(status)) {
    case 'DRAFT':
      return '草稿阶段仅支持取消。';
    case 'WAITING_APPROVAL':
      return '可修改草案、确认派发或取消。';
    case 'PROMPT_GENERATED':
      return '草案已生成，可继续修改或取消。';
    case 'APPROVED':
      return '已确认，当前仅可取消。';
    case 'DISPATCHED':
    case 'RUNNING':
      return '任务已进入执行阶段，当前仅可取消。';
    case 'FAILED':
      return '任务失败后可修改草案或取消。';
    case 'DONE':
      return '任务已完成，当前无可执行操作。';
    case 'CANCELLED':
      return '任务已取消，当前无可执行操作。';
    default:
      return '当前状态暂无可执行操作。';
  }
}
