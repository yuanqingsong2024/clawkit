/**
 * 任务卡片组件
 * 卡片模式展示单个任务
 */

import { Link } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import {
  TaskListItem,
  getNextStageClassName,
  formatNextStageHint,
  getCompactTaskActionHint,
  getActionClassName,
  toneForPriority,
  labelForPriority,
  toneForTaskStatus,
  labelForTaskStatus,
} from './types';
import { formatDateTime } from '../../lib/format';
import { compactButtonClassName } from '../ui/styles';
import type { TaskActionType } from '../../lib/task-ui';
import { getAvailableTaskActions, labelForTaskAction } from '../../lib/task-ui';

interface TaskCardProps {
  task: TaskListItem;
  isActionBusy: boolean;
  onOpenActionDialog: (taskId: string, action: TaskActionType) => void;
}

/**
 * 任务卡片组件
 */
export function TaskCard({ task, isActionBusy, onOpenActionDialog }: TaskCardProps): JSX.Element {
  const actions = getAvailableTaskActions(task.status);

  return (
    <Card compact className="overflow-hidden">
      <div className="space-y-1.5">
        {/* 任务头部 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            to={`/tasks/${task.taskId}`}
            className="shrink-0 whitespace-nowrap font-mono text-sm text-sky-700 hover:underline"
          >
            {task.taskId}
          </Link>
          <span className="shrink-0 whitespace-nowrap font-mono text-xs text-slate-500">{task.projectKey}</span>
          <Badge tone={toneForPriority(task.priority)} className="text-xs">
            {labelForPriority(task.priority)}
          </Badge>
          <Badge tone={toneForTaskStatus(task.status)} className="text-xs">
            {labelForTaskStatus(task.status)}
          </Badge>
        </div>

        {/* 任务内容 */}
        <div className="space-y-2">
          <div className="text-sm text-slate-900 line-clamp-2">{task.intent}</div>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
              <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">下一步</div>
              <div className={`${getNextStageClassName(task.status)} line-clamp-1 border-none bg-transparent px-0 py-0 text-[11px]`}>
                {formatNextStageHint(task.status, task.nextStageHint)}
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 md:min-w-[140px]">
              <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">操作</div>
              {renderTaskActions(task, actions, isActionBusy, onOpenActionDialog)}
            </div>
          </div>
        </div>

        {/* 任务底部 */}
        <div className="flex items-center gap-2 border-t border-slate-100 pt-1.5 text-[11px] leading-5 text-slate-500">
          <span className="truncate">{formatDateTime(task.updatedAt)}</span>
          <span className="text-slate-300">·</span>
          <Link
            to={`/tasks/${task.taskId}`}
            className="shrink-0 text-sky-700 hover:underline font-medium"
          >
            详情 →
          </Link>
        </div>
      </div>
    </Card>
  );
}

/**
 * 渲染任务操作按钮
 */
function renderTaskActions(
  task: TaskListItem,
  actions: TaskActionType[],
  isActionBusy: boolean,
  onOpenActionDialog: (taskId: string, action: TaskActionType) => void
): JSX.Element | null {
  if (actions.length === 0) {
    return <span className="text-[10px] leading-5 text-right text-slate-300">{getCompactTaskActionHint(task.status)}</span>;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        {actions.map((action) => (
          <button
            key={`${task.taskId}-${action}`}
            type="button"
            onClick={() => onOpenActionDialog(task.taskId, action)}
            className={getActionClassName(action, compactButtonClassName)}
            disabled={isActionBusy}
          >
            {labelForTaskAction(action)}
          </button>
        ))}
      </div>
      <div className="text-[10px] leading-4 text-right text-slate-300">· {getCompactTaskActionHint(task.status)}</div>
    </div>
  );
}
