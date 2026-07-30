/**
 * 最近任务组件
 * 展示最近执行的任务列表
 */

import { Link } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { TaskListItem } from './types';
import { formatDateTime } from '../../lib/format';

interface RecentTasksProps {
  tasks: TaskListItem[];
}

/**
 * 最近任务组件
 */
export function RecentTasks({ tasks }: RecentTasksProps): JSX.Element {
  return (
    <Card
      title="最近任务"
      actions={
        <Link to="/tasks" className="text-sm text-sky-700 hover:underline">
          查看全部
        </Link>
      }
    >
      <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 leading-5">
        最近任务摘要，点击任务 ID 可查看详情。
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full table-fixed text-left text-sm leading-5">
          <thead className="text-xs text-slate-500 bg-slate-50 sticky top-0 z-10">
            <tr className="border-b border-slate-200">
              <th className="w-32 py-2.5 px-3 pr-2 font-medium">任务 ID</th>
              <th className="w-32 py-2.5 px-3 pr-2 font-medium">项目</th>
              <th className="py-2.5 px-3 pr-2 font-medium">意图</th>
              <th className="w-20 py-2.5 px-3 pr-2 font-medium">状态</th>
              <th className="w-28 py-2.5 px-3 font-medium">更新时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-2.5 px-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 leading-5">
                    暂无最近任务
                  </div>
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.taskId} className="hover:bg-blue-50/50 transition-colors">
                  <td className="py-2 px-3 pr-2 font-mono text-xs truncate">
                    <Link className="text-sky-700 hover:underline" to={`/tasks/${task.taskId}`}>
                      {task.taskId}
                    </Link>
                  </td>
                  <td className="py-2 px-3 pr-2 font-mono text-xs text-slate-800 truncate">{task.projectKey}</td>
                  <td className="py-2 px-3 pr-2 text-slate-800 truncate" title={task.intent}>
                    {task.intent}
                  </td>
                  <td className="py-2 px-3 pr-2">
                    <Badge tone="neutral">{task.status}</Badge>
                  </td>
                  <td className="py-2 px-3 text-slate-700 truncate">{formatDateTime(task.updatedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
