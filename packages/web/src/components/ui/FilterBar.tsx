/**
 * 筛选栏组件 - 统一筛选操作区域
 */
import { ReactNode } from 'react';

interface FilterItem {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (value: string) => void;
}

interface ActionButton {
  icon?: string;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

interface FilterBarProps {
  filters?: FilterItem[];
  search?: {
    placeholder?: string;
    value?: string;
    onChange?: (value: string) => void;
  };
  actions?: ActionButton[];
  className?: string;
}

/**
 * 筛选栏组件 - 包含筛选器、搜索框、操作按钮
 */
export function FilterBar({
  filters = [],
  search,
  actions = [],
  className = '',
}: FilterBarProps): JSX.Element {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* 筛选器 */}
      {filters.map((filter) => (
        <div key={filter.key} className="flex items-center gap-2">
          <label className="text-sm text-slate-600">{filter.label}:</label>
          <select
            value={filter.value}
            onChange={(e) => filter.onChange?.(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {/* 搜索框 */}
      {search && (
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder={search.placeholder ?? '搜索...'}
            value={search.value}
            onChange={(e) => search.onChange?.(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 ml-auto">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            disabled={action.disabled}
            className={[
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              action.variant === 'primary'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : action.variant === 'danger'
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              action.disabled ? 'cursor-not-allowed opacity-50' : '',
            ].join(' ')}
          >
            {action.icon && <span>{action.icon}</span>}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default FilterBar;
