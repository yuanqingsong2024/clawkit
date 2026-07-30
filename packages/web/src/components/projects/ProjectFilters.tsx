/**
 * 项目筛选栏组件
 */

import { Badge } from '../ui/Badge';

type ProjectFilter = 'all' | 'auto' | 'manual' | 'risky';

interface ProjectFiltersProps {
  /** 当前筛选条件 */
  filter: ProjectFilter;
  /** 筛选条件变更回调 */
  onFilterChange: (filter: ProjectFilter) => void;
  /** 搜索关键词 */
  searchQuery: string;
  /** 搜索关键词变更回调 */
  onSearchChange: (query: string) => void;
  /** 匹配的项目数量 */
  filteredCount: number;
  /** 总项目数量 */
  totalCount: number;
  /** 自动执行项目数量 */
  autoCount: number;
  /** 手动确认项目数量 */
  manualCount: number;
  /** 危险配置项目数量 */
  riskyCount: number;
}

export function ProjectFilters({
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  filteredCount,
  totalCount,
  autoCount,
  manualCount,
  riskyCount,
}: ProjectFiltersProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 搜索框 */}
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="搜索项目名称..."
        className="w-40 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs outline-none focus:border-slate-400"
      />

      {/* 筛选标签 */}
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => onFilterChange('all')}
          className={`rounded px-2 py-1 text-[10px] font-medium ${
            filter === 'all'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          全部 {totalCount}
        </button>
        <button
          type="button"
          onClick={() => onFilterChange('auto')}
          className={`rounded px-2 py-1 text-[10px] font-medium ${
            filter === 'auto'
              ? 'bg-emerald-600 text-white'
              : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          自动 {autoCount}
        </button>
        <button
          type="button"
          onClick={() => onFilterChange('manual')}
          className={`rounded px-2 py-1 text-[10px] font-medium ${
            filter === 'manual'
              ? 'bg-amber-600 text-white'
              : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          确认 {manualCount}
        </button>
        <button
          type="button"
          onClick={() => onFilterChange('risky')}
          className={`rounded px-2 py-1 text-[10px] font-medium ${
            filter === 'risky'
              ? 'bg-rose-600 text-white'
              : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          危险 {riskyCount}
        </button>
      </div>

      {/* 清除按钮 */}
      {(filter !== 'all' || searchQuery) && (
        <button
          type="button"
          onClick={() => {
            onFilterChange('all');
            onSearchChange('');
          }}
          className="text-xs text-sky-600 hover:underline"
        >
          清除
        </button>
      )}

      {/* 统计信息 */}
      <span className="ml-auto text-xs text-slate-500">匹配 {filteredCount} 个项目</span>
    </div>
  );
}
