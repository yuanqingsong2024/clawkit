/**
 * 任务表格组件
 * 表格模式展示任务列表
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

interface TaskTableProps {
  tasks: TaskListItem[];
  isActionBusy: boolean;
  onOpenActionDialog: (taskId: string, action: TaskActionType) => void;
}

/**
 * 任务表格组件
 */
export function TaskTable({ tasks, isActionBusy, onOpenActionDialog }: TaskTableProps): JSX.Element {
  return (
    <Card compact title="任务列表">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-sm lg:table-auto">
          <thead className="text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50 sticky top-0 z-10">
            <tr className="border-b border-slate-200">
              <th className="py-2.5 px-3 pr-3 font-medium min-w-[100px]">任务 ID</th>
              <th className="py-2.5 px-3 pr-3 font-medium min-w-[80px] hidden md:table-cell">项目</th>
              <th className="py-2.5 px-3 pr-3 font-medium min-w-[150px]">意图</th>
              <th className="py-2.5 px-3 pr-3 font-medium min-w-[120px] hidden lg:table-cell">下一步</th>
              <th className="py-2.5 px-3 pr-3 font-medium min-w-[60px]">优先级</th>
              <th className="py-2.5 px-3 pr-3 font-medium min-w-[70px]">状态</th>
              <th className="py-2.5 px-3 pr-3 font-medium min-w-[120px] hidden sm:table-cell">更新时间</th>
              <th className="py-2.5 px-3 font-medium text-right min-w-[120px]">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <tr key={task.taskId} className="hover:bg-blue-50/50 transition-colors">
                  <td className="py-2 px-3 pr-3 font-mono text-xs">
                    <Link className="text-sky-700 hover:underline" to={`/tasks/${task.taskId}`}>
                      {task.taskId}
                    </Link>
                  </td>
                  <td className="py-2 px-3 pr-3 font-mono text-xs text-slate-800 hidden md:table-cell">{task.projectKey}</td>
                  <td className="py-2 px-3 pr-3 text-slate-800 max-w-xs truncate" title={task.intent}>{task.intent}</td>
                  <td className="py-2 px-3 pr-3 max-w-xs hidden lg:table-cell">
                    <div className={getNextStageClassName(task.status)}>{formatNextStageHint(task.status, task.nextStageHint)}</div>
                  </td>
                  <td className="py-2 px-3 pr-3">
                    <Badge tone={toneForPriority(task.priority)} className="text-xs">
                      {labelForPriority(task.priority)}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 pr-3">
                    <Badge tone={toneForTaskStatus(task.status)} className="text-xs">
                      {labelForTaskStatus(task.status)}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 pr-3 text-slate-700 hidden sm:table-cell">{formatDateTime(task.updatedAt)}</td>
                  <td className="py-2 px-3 align-top">
                    <div className="ml-auto max-w-[220px]">
                      <TaskActions
                        task={task}
                        isActionBusy={isActionBusy}
                        onOpenActionDialog={onOpenActionDialog}
                      />
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  暂无任务
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/**
 * 任务操作按钮组
 */
function TaskActions({
  task,
  isActionBusy,
  onOpenActionDialog,
}: {
  task: TaskListItem;
  isActionBusy: boolean;
  onOpenActionDialog: (taskId: string, action: TaskActionType) => void;
}): JSX.Element | null {
  const actions = getAvailableTaskActions(task.status);
  if (actions.length === 0) {
    return <span className="text-[10px] text-slate-400">{getCompactTaskActionHint(task.status)}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
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
  );
}
