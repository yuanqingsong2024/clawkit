/**
 * Tasks 页面相关类型定义
 */

import type { TaskActionType } from '../../lib/task-ui';

// 重新导出 TaskActionType
export type { TaskActionType } from '../../lib/task-ui';

// 任务列表项
export interface TaskListItem {
  taskId: string;
  projectKey: string;
  intent: string;
  status: string;
  priority: string;
  nextStageHint: string;
  updatedAt: string;
}

// 任务列表结果
export interface TaskListResult {
  tasks: TaskListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// 待处理任务操作
export interface PendingTaskAction {
  taskId: string;
  action: TaskActionType;
}

// 任务操作输入
export interface TaskActionInput {
  taskId: string;
  action: TaskActionType;
  operator: string;
  revisionText?: string;
}

// 审批操作结果
export interface ApproveActionResult {
  dispatchErrorMessage?: string;
  nextStageHint?: string;
}

// 统计卡片数据
export interface TaskStats {
  total: number;
  running: number;
  waiting: number;
  done: number;
  failed: number;
  draft: number;
}

// 任务筛选状态
export interface TaskFiltersState {
  status: string;
  project: string;
  page: number;
  pageSize: number;
}

/**
 * 从任务列表计算统计数据
 */
export function computeTaskStats(tasks: { status: string }[]): TaskStats {
  return {
    total: tasks.length,
    running: tasks.filter(t => t.status === 'RUNNING').length,
    waiting: tasks.filter(t => t.status === 'WAITING_APPROVAL').length,
    done: tasks.filter(t => t.status === 'DONE').length,
    failed: tasks.filter(t => t.status === 'FAILED').length,
    draft: tasks.filter(t => t.status === 'DRAFT').length,
  };
}

/**
 * 根据优先级返回对应的 Badge tone
 */
export function toneForPriority(priority: string): 'failed' | 'warning' | 'info' | 'neutral' {
  const normalizedPriority = priority.trim().toUpperCase();
  if (normalizedPriority === 'URGENT') return 'failed';
  if (normalizedPriority === 'HIGH') return 'warning';
  if (normalizedPriority === 'NORMAL') return 'info';
  return 'neutral';
}

/**
 * 获取优先级中文标签
 */
export function labelForPriority(priority: string): string {
  const normalizedPriority = priority.trim().toUpperCase();
  const labels: Record<string, string> = {
    URGENT: '紧急',
    HIGH: '高',
    NORMAL: '普通',
    LOW: '低',
  };
  return labels[normalizedPriority] || priority;
}

/**
 * 获取任务操作按钮样式
 */
export function getActionClassName(action: TaskActionType, compactButtonClassName: string): string {
  switch (action) {
    case 'approve':
      return `${compactButtonClassName} bg-slate-900 px-2.5 text-[11px] text-white hover:bg-slate-800`;
    case 'cancel':
      return `${compactButtonClassName} bg-rose-600 px-2.5 text-[11px] text-white hover:bg-rose-500`;
    case 'revise':
    default:
      return `${compactButtonClassName} border border-slate-200 bg-white px-2.5 text-[11px] text-slate-700 hover:bg-slate-50`;
  }
}

// 重新导出 task-ui 中的函数
export { toneForTaskStatus, labelForTaskStatus } from '../../lib/task-ui';

/**
 * 获取下一步提示框样式
 */
export function getNextStageClassName(status: string): string {
  const normalizedStatus = status.trim().toUpperCase();
  if (normalizedStatus === 'APPROVED') {
    return 'rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900';
  }
  if (normalizedStatus === 'FAILED') {
    return 'rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900';
  }
  return 'rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600';
}

/**
 * 格式化下一步提示
 */
export function formatNextStageHint(status: string, nextStageHint: string | undefined): string {
  const hint = nextStageHint?.trim() || '暂无提示';
  const normalizedStatus = status.trim().toUpperCase();
  if (normalizedStatus === 'APPROVED') return `需处理：${hint}`;
  if (normalizedStatus === 'FAILED') return `失败后续：${hint}`;
  return `下一步：${hint}`;
}

/**
 * 获取紧凑任务操作提示
 */
export function getCompactTaskActionHint(status: string): string {
  const normalizedStatus = status.trim().toUpperCase();
  switch (normalizedStatus) {
    case 'DRAFT':
      return '仅可取消';
    case 'WAITING_APPROVAL':
      return '可修改/确认/取消';
    case 'PROMPT_GENERATED':
      return '可修改/取消';
    case 'APPROVED':
    case 'DISPATCHED':
    case 'RUNNING':
      return '仅可取消';
    case 'FAILED':
      return '可修改/取消';
    case 'DONE':
      return '无可执行操作';
    case 'CANCELLED':
      return '任务已取消';
    default:
      return '暂无操作';
  }
}
