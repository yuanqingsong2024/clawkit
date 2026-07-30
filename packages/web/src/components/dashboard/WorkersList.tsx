import { Link } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { formatDateTime } from '../../lib/format';

// Worker 数据类型
export interface WorkerRecord {
  workerId: string;
  name: string;
  status: 'idle' | 'busy' | 'offline' | string;
  lastHeartbeatAt: string;
  currentTaskId?: string;
}

// WorkersListProps 接口
export interface WorkersListProps {
  workers: WorkerRecord[];
  startingWorkerId: string | null;
  restartingWorkerId: string | null;
  startWorkerMutation: { isPending: boolean; mutate: (workerId: string) => void };
  restartWorkerMutation: { isPending: boolean; mutate: (workerId: string) => void };
  onOpenLogs: (workerId: string) => void;
}

// 状态对应的 Badge 色调
function toneForWorkerStatus(status: string): 'success' | 'warning' | 'failed' | 'neutral' {
  switch (status) {
    case 'idle':
      return 'success';
    case 'busy':
      return 'warning';
    case 'offline':
      return 'failed';
    default:
      return 'neutral';
  }
}

/**
 * Worker 行组件
 */
function WorkerRow(props: {
  worker: WorkerRecord;
  startingWorkerId: string | null;
  restartingWorkerId: string | null;
  startWorkerMutation: { isPending: boolean; mutate: (workerId: string) => void };
  restartWorkerMutation: { isPending: boolean; mutate: (workerId: string) => void };
  onOpenLogs: (workerId: string) => void;
}): JSX.Element {
  const { worker, startingWorkerId, restartingWorkerId, startWorkerMutation, restartWorkerMutation, onOpenLogs } = props;

  return (
    <tr className="hover:bg-blue-50/50 transition-colors">
      <td className="py-1.5 pr-3 font-mono text-xs text-slate-800 truncate">{worker.workerId}</td>
      <td className="py-1.5 pr-3 text-slate-800 truncate">{worker.name}</td>
      <td className="py-1.5 pr-3">
        <Badge tone={toneForWorkerStatus(worker.status)}>{worker.status}</Badge>
      </td>
      <td className="py-1.5 pr-3 text-slate-700">{formatDateTime(worker.lastHeartbeatAt)}</td>
      <td className="py-1.5">
        {worker.currentTaskId ? (
          <Link className="text-sky-700 hover:underline" to={`/tasks/${worker.currentTaskId}`}>
            {worker.currentTaskId}
          </Link>
        ) : (
          <span className="text-slate-500">-</span>
        )}
      </td>
      <td className="py-1.5">
        {worker.status === 'offline' ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={startingWorkerId === worker.workerId || startWorkerMutation.isPending}
              onClick={() => startWorkerMutation.mutate(worker.workerId)}
              className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {startingWorkerId === worker.workerId ? '启动中…' : '一键启动'}
            </button>
            <button
              type="button"
              disabled={restartingWorkerId === worker.workerId || restartWorkerMutation.isPending}
              onClick={() => restartWorkerMutation.mutate(worker.workerId)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {restartingWorkerId === worker.workerId ? '重启中…' : '重启'}
            </button>
            <button
              type="button"
              onClick={() => onOpenLogs(worker.workerId)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              查看日志
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenLogs(worker.workerId)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              查看日志
            </button>
            <span className="text-xs text-slate-400">-</span>
          </div>
        )}
      </td>
    </tr>
  );
}

/**
 * Workers 列表组件
 */
export function WorkersList(props: WorkersListProps): JSX.Element {
  const { workers, startingWorkerId, restartingWorkerId, startWorkerMutation, restartWorkerMutation, onOpenLogs } = props;

  return (
    <Card compact title="Workers 列表">
      <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 leading-5">
        这里展示 Worker 在线状态、最近心跳和当前任务。
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full table-fixed text-left text-sm leading-5 lg:table-auto">
          <thead className="text-[11px] uppercase tracking-wide text-slate-500 bg-slate-50 sticky top-0 z-10">
            <tr className="border-b border-slate-200">
              <th className="w-40 py-2.5 px-3 pr-3 font-medium min-w-[120px]">ID</th>
              <th className="w-32 py-2.5 px-3 pr-3 font-medium min-w-[100px]">名称</th>
              <th className="w-22 py-2.5 px-3 pr-3 font-medium min-w-[80px]">状态</th>
              <th className="w-36 py-2.5 px-3 pr-3 font-medium min-w-[140px]">最后心跳</th>
              <th className="py-2.5 px-3 font-medium min-w-[150px]">当前任务</th>
              <th className="w-32 py-2.5 px-3 font-medium min-w-[200px]">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {workers.map((worker) => (
              <WorkerRow
                key={worker.workerId}
                worker={worker}
                startingWorkerId={startingWorkerId}
                restartingWorkerId={restartingWorkerId}
                startWorkerMutation={startWorkerMutation}
                restartWorkerMutation={restartWorkerMutation}
                onOpenLogs={onOpenLogs}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
