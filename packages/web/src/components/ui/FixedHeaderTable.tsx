/**
 * 固定表头表格组件
 * 支持滚动时表头固定、列宽调整、移动端适配
 */

import { type ReactNode } from 'react';

export interface Column<T> {
  /** 列标识 */
  key: string;
  /** 表头文本 */
  header: string;
  /** 单元格渲染 */
  render: (row: T, index: number) => ReactNode;
  /** 列宽 */
  width?: string | number;
  /** 是否可排序 */
  sortable?: boolean;
  /** 是否在移动端隐藏 */
  hideOnMobile?: boolean;
  /** 最小宽度 */
  minWidth?: string | number;
}

export interface FixedHeaderTableProps<T> {
  /** 列配置 */
  columns: Column<T>[];
  /** 数据 */
  data: T[];
  /** 唯一键字段 */
  rowKey: keyof T | ((row: T) => string);
  /** 表格高度 */
  height?: string | number;
  /** 最大高度 */
  maxHeight?: string | number;
  /** 是否显示边框 */
  bordered?: boolean;
  /** 是否显示斑马纹 */
  striped?: boolean;
  /** 紧凑模式 */
  compact?: boolean;
  /** 空状态内容 */
  empty?: ReactNode;
  /** 加载状态 */
  loading?: boolean;
  /** 行点击事件 */
  onRowClick?: (row: T, index: number) => void;
  /** 排序配置 */
  sortConfig?: {
    key: string;
    direction: 'asc' | 'desc';
  };
  onSort?: (key: string) => void;
  /** 类名 */
  className?: string;
  /** 固定表头 */
  stickyHeader?: boolean;
  /** 表头偏移 */
  headerOffset?: number;
}

function getRowKey<T>(row: T, rowKey: keyof T | ((row: T) => string)): string {
  if (typeof rowKey === 'function') {
    return rowKey(row);
  }
  return String(row[rowKey] ?? '');
}

export function FixedHeaderTable<T>({
  columns,
  data,
  rowKey,
  height,
  maxHeight,
  bordered = false,
  striped = true,
  compact = false,
  empty,
  loading = false,
  onRowClick,
  sortConfig,
  onSort,
  className = '',
  stickyHeader = true,
  headerOffset = 0,
}: FixedHeaderTableProps<T>): JSX.Element {
  const heightStyle = height ? (typeof height === 'number' ? `${height}px` : height) : undefined;
  const maxHeightStyle = maxHeight ? (typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight) : undefined;

  const tableClass = [
    'w-full text-sm text-left',
    bordered ? 'border border-slate-200' : '',
    compact ? '' : 'text-base',
  ].filter(Boolean).join(' ');

  const headerRowClass = [
    'bg-slate-50 border-b border-slate-200',
    stickyHeader ? 'sticky top-0 z-10' : '',
    compact ? 'py-2' : 'py-3',
  ].filter(Boolean).join(' ');

  const thClass = (col: Column<T>) => [
    'px-3 font-semibold text-slate-600 whitespace-nowrap',
    col.sortable ? 'cursor-pointer select-none hover:bg-slate-100 transition-colors' : '',
    col.hideOnMobile ? 'hidden md:table-cell' : '',
    compact ? 'text-xs' : 'text-sm',
    col.width ? '' : 'min-w-[100px]',
  ].filter(Boolean).join(' ');

  const tdClass = (col: Column<T>) => [
    'border-slate-100',
    col.hideOnMobile ? 'hidden md:table-cell' : '',
    compact ? 'py-2 text-xs' : 'py-3',
  ].filter(Boolean).join(' ');

  const trClass = (row: T, index: number) => [
    'transition-colors',
    striped && index % 2 === 1 ? 'bg-slate-50/50' : '',
    onRowClick ? 'cursor-pointer hover:bg-blue-50' : '',
    bordered ? 'border-b border-slate-100' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={`overflow-auto ${className}`}
      style={{
        height: heightStyle,
        maxHeight: maxHeightStyle,
      }}
    >
      <table className={tableClass}>
        <thead>
          <tr className={headerRowClass} style={stickyHeader && headerOffset ? { top: headerOffset } : undefined}>
            {columns.map((col) => (
              <th
                key={col.key}
                className={thClass(col)}
                style={{
                  width: col.width,
                  minWidth: col.minWidth,
                }}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                <div className="flex items-center gap-1">
                  <span>{col.header}</span>
                  {col.sortable && sortConfig?.key === col.key && (
                    <span className="text-blue-600">
                      {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                  {col.sortable && sortConfig?.key !== col.key && (
                    <span className="text-slate-300">↕</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            // 加载骨架
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="animate-pulse">
                {columns.map((col) => (
                  <td key={col.key} className={`${tdClass(col)} px-3`}>
                    <div className="h-4 bg-slate-200 rounded" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-slate-500">
                {empty || (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">📭</span>
                    <span>暂无数据</span>
                  </div>
                )}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={getRowKey(row, rowKey)}
                className={trClass(row, index)}
                onClick={() => onRowClick?.(row, index)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={tdClass(col)}>
                    {col.render(row, index)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default FixedHeaderTable;
