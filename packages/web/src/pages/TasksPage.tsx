import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ErrorNotice, InfoNotice } from '../components/ui/Notice';
import { apiGet } from '../lib/api';
import { formatDateTime } from '../lib/format';

interface TaskListItem {
  taskId: string;
  projectKey: string;
  intent: string;
  status: string;
  updatedAt: string;
}

interface TaskListResult {
  tasks: TaskListItem[];
  total: number;
}

export function TasksPage(): JSX.Element {
  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: () => apiGet<TaskListResult>('/tasks'),
  });

  const data = tasksQuery.data;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">任务中心</h1>
          <div className="mt-1 text-sm text-slate-600">查看任务列表，并进入详情进行确认/修改/取消。</div>
        </div>
        <button
          type="button"
          onClick={() => tasksQuery.refetch()}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={tasksQuery.isFetching}
        >
          {tasksQuery.isFetching ? '刷新中…' : '手动刷新'}
        </button>
      </div>

      {tasksQuery.isLoading ? <InfoNotice message="正在加载任务列表…" /> : null}
      {tasksQuery.error ? (
        <ErrorNotice message={tasksQuery.error instanceof Error ? tasksQuery.error.message : '未知错误'} />
      ) : null}

      <Card
        title="任务列表"
        actions={data ? <Badge tone="neutral">总数 {data.total}</Badge> : undefined}
      >
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="py-2 pr-3 font-medium">taskId</th>
                <th className="py-2 pr-3 font-medium">projectKey</th>
                <th className="py-2 pr-3 font-medium">意图</th>
                <th className="py-2 pr-3 font-medium">状态</th>
                <th className="py-2 font-medium">更新时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.tasks?.length ? (
                data.tasks.map((task) => (
                  <tr key={task.taskId}>
                    <td className="py-2 pr-3 font-mono text-xs">
                      <Link className="text-sky-700 hover:underline" to={`/tasks/${task.taskId}`}>
                        {task.taskId}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-800">{task.projectKey}</td>
                    <td className="py-2 pr-3 text-slate-800">{task.intent}</td>
                    <td className="py-2 pr-3">
                      <Badge tone="neutral">{task.status}</Badge>
                    </td>
                    <td className="py-2 text-slate-700">{formatDateTime(task.updatedAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-3 text-slate-500">
                    暂无任务
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-slate-500">点击 taskId 进入详情页：/tasks/:taskId</div>
      </Card>
    </section>
  );
}
