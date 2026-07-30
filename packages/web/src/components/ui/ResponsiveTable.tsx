/**
 * 移动端友好的表格组件
 * 支持：水平滚动、列优先级、卡片视图切换
 */

import { type ReactNode, useState } from 'react';

export interface ResponsiveColumn<T> {
  /** 列标识 */
  key: string;
  /** 表头文本 */
  header: string;
  /** 单元格渲染 */
  render: (row: T, index: number) => ReactNode;
  /** 列宽 */
  width?: string | number;
  /** 最小宽度 */
  minWidth?: string | number;
  /** 移动端优先级（数字越小越优先显示） */
  mobilePriority?: number;
  /** 是否固定在卡片视图中 */
  pinned?: boolean;
}

export interface ResponsiveTableProps<T> {
  /** 列配置 */
  columns: ResponsiveColumn<T>[];
  /** 数据 */
  data: T[];
  /** 唯一键字段 */
  rowKey: keyof T | ((row: T) => string);
  /** 桌面端最小列宽 */
  minColWidth?: number;
  /** 显示设置按钮 */
  showSettings?: boolean;
  /** 默认视图模式 */
  defaultView?: 'table' | 'card';
  /** 空状态内容 */
  empty?: ReactNode;
  /** 加载状态 */
  loading?: boolean;
  /** 行点击事件 */
  onRowClick?: (row: T, index: number) => void;
  /** 卡片渲染（可选） */
  renderCard?: (row: T, index: number) => ReactNode;
  /** 类名 */
  className?: string;
}

/** 检测是否为移动端 */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      setIsMobile(window.innerWidth < 768);
    });
  }

  return isMobile;
}

function getRowKey<T>(row: T, rowKey: keyof T | ((row: T) => string)): string {
  if (typeof rowKey === 'function') {
    return rowKey(row);
  }
  return String(row[rowKey] ?? '');
}

/** 获取可见列（按优先级排序） */
function getVisibleColumns<T>(columns: ResponsiveColumn<T>[], mobilePriority = 3): ResponsiveColumn<T>[] {
  return columns
    .filter((col) => (col.mobilePriority ?? 99) <= mobilePriority)
    .sort((a, b) => (a.mobilePriority ?? 99) - (b.mobilePriority ?? 99));
}

export function ResponsiveTable<T>({
  columns,
  data,
  rowKey,
  minColWidth = 120,
  showSettings = false,
  defaultView = 'table',
  empty,
  loading = false,
  onRowClick,
  renderCard,
  className = '',
}: ResponsiveTableProps<T>): JSX.Element {
  const [viewMode, setViewMode] = useState<'table' | 'card'>(defaultView);
  const [mobileColCount, setMobileColCount] = useState(3);
  const isMobile = useIsMobile();

  const visibleColumns = getVisibleColumns(columns, mobileColCount);

  // 自动切换视图
  const effectiveView = isMobile && !showSettings ? 'card' : viewMode;

  return (
    <div className={className}>
      {/* 视图切换和设置 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">显示列：</span>
          <div className="flex gap-1">
            {[2, 3, 4, 99].map((count) => (
              <button
                key={count}
                onClick={() => setMobileColCount(count)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  mobileColCount === count
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {count === 99 ? '全部' : count}
              </button>
            ))}
          </div>
        </div>

        {!isMobile && showSettings && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table' ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-100'
              }`}
              title="表格视图"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'card' ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-100'
              }`}
              title="卡片视图"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* 表格视图 */}
      {effectiveView === 'table' && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap"
                    style={{
                      width: col.width,
                      minWidth: col.minWidth ?? minColWidth,
                    }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                // 加载骨架
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    {visibleColumns.map((col) => (
                      <td key={col.key} className="px-3 py-3">
                        <div className="h-4 bg-slate-200 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="text-center py-12 text-slate-500">
                    {empty || (
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-4xl">📭</span>
                        <span>暂无数据</span>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                data.map((row, index) => (
                  <tr
                    key={getRowKey(row, rowKey)}
                    className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                    onClick={() => onRowClick?.(row, index)}
                  >
                    {visibleColumns.map((col) => (
                      <td key={col.key} className="px-3 py-2.5 text-slate-700">
                        {col.render(row, index)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 卡片视图 */}
      {effectiveView === 'card' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            // 加载骨架
            Array.from({ length: 6 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="bg-white rounded-lg border border-slate-200 p-4 animate-pulse">
                <div className="space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                  <div className="h-3 bg-slate-200 rounded w-2/3" />
                </div>
              </div>
            ))
          ) : data.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500">
              {empty || (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-4xl">📭</span>
                  <span>暂无数据</span>
                </div>
              )}
            </div>
          ) : (
            data.map((row, index) =>
              renderCard ? (
                <div
                  key={getRowKey(row, rowKey)}
                  onClick={() => onRowClick?.(row, index)}
                  className={onRowClick ? 'cursor-pointer' : ''}
                >
                  {renderCard(row, index)}
                </div>
              ) : (
                <div
                  key={getRowKey(row, rowKey)}
                  className={`bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => onRowClick?.(row, index)}
                >
                  {/* 默认卡片内容 */}
                  {visibleColumns.slice(0, 3).map((col) => (
                    <div key={col.key} className="mb-2 last:mb-0">
                      <div className="text-xs text-slate-500 mb-0.5">{col.header}</div>
                      <div className="text-sm text-slate-900 truncate">{col.render(row, index)}</div>
                    </div>
                  ))}
                </div>
              )
            )
          )}
        </div>
      )}
    </div>
  );
}

export default ResponsiveTable;
