/**
 * Dashboard 骨架屏组件
 * 用于数据加载时显示占位效果
 */

import { Skeleton } from '../ui/Skeleton';

/**
 * Dashboard 骨架屏组件
 */
export function DashboardSkeleton(): JSX.Element {
  return (
    <div className="space-y-3">
      {/* 顶部标题骨架 */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton variant="text" width={120} height={24} />
          <Skeleton variant="text" width={200} height={16} />
        </div>
        <div className="flex gap-2">
          <Skeleton variant="rectangular" width={80} height={32} />
          <Skeleton variant="rectangular" width={80} height={32} />
          <Skeleton variant="rectangular" width={80} height={32} />
        </div>
      </div>

      {/* 服务状态卡片骨架 */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-3">
            <Skeleton variant="text" width="60%" height={16} />
            <div className="mt-2 space-y-2">
              <Skeleton variant="text" width="40%" height={14} />
              <Skeleton variant="rectangular" width="100%" height={40} />
            </div>
          </div>
        ))}
      </div>

      {/* Workers 列表骨架 */}
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <Skeleton variant="text" width={100} height={18} />
        <div className="mt-3 space-y-2">
          <Skeleton variant="rectangular" width="100%" height={36} />
          <Skeleton variant="rectangular" width="100%" height={36} />
          <Skeleton variant="rectangular" width="100%" height={36} />
        </div>
      </div>

      {/* 最近任务骨架 */}
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <Skeleton variant="text" width={100} height={18} />
        <div className="mt-3 space-y-2">
          <Skeleton variant="rectangular" width="100%" height={40} />
          <Skeleton variant="rectangular" width="100%" height={40} />
          <Skeleton variant="rectangular" width="100%" height={40} />
        </div>
      </div>
    </div>
  );
}
