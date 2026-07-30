/**
 * 任务统计卡片组件
 * 展示任务状态分布统计
 */

import { TaskStats } from './types';

interface TaskStatCardProps {
  label: string;
  value: number;
  icon: string;
}

function StatCard({ label, value, icon }: TaskStatCardProps): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm hover:shadow transition-shadow">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-slate-900 tabular-nums">{value}</div>
          <div className="text-xs text-slate-500 truncate">{label}</div>
        </div>
      </div>
    </div>
  );
}

interface TaskStatsCardsProps {
  stats: TaskStats;
}

/**
 * 任务统计卡片网格
 */
export function TaskStatsCards({ stats }: TaskStatsCardsProps): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard label="总计" value={stats.total} icon="📋" />
      <StatCard label="运行中" value={stats.running} icon="⚡" />
      <StatCard label="待审批" value={stats.waiting} icon="⏳" />
      <StatCard label="已完成" value={stats.done} icon="✅" />
      <StatCard label="已失败" value={stats.failed} icon="❌" />
      <StatCard label="草稿" value={stats.draft} icon="📝" />
    </div>
  );
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
