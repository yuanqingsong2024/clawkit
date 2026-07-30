/**
 * 分页组件 - 通用分页导航
 */
import { useMemo } from 'react';

interface PaginationProps {
  /** 当前页码 (从 1 开始) */
  currentPage: number;
  /** 总条目数 */
  totalItems: number;
  /** 每页条目数 */
  pageSize: number;
  /** 页码变化回调 */
  onPageChange: (page: number) => void;
  /** 每页大小变化回调 */
  onPageSizeChange?: (size: number) => void;
  /** 可选的每页大小选项 */
  pageSizeOptions?: number[];
  /** 是否显示跳转到某页 */
  showPageJump?: boolean;
  /** 额外 class */
  className?: string;
}

/**
 * 计算分页信息
 */
function calculatePagination(
  currentPage: number,
  totalItems: number,
  pageSize: number
): {
  totalPages: number;
  startPage: number;
  endPage: number;
  startIndex: number;
  endIndex: number;
} {
  const totalPages = Math.ceil(totalItems / pageSize);
  const halfDisplayed = 2; // 两侧显示的页码数

  let startPage = Math.max(1, currentPage - halfDisplayed);
  let endPage = Math.min(totalPages, currentPage + halfDisplayed);

  // 确保显示足够多的页码
  if (endPage - startPage < halfDisplayed * 2) {
    if (startPage === 1) {
      endPage = Math.min(totalPages, startPage + halfDisplayed * 2);
    } else {
      startPage = Math.max(1, endPage - halfDisplayed * 2);
    }
  }

  return {
    totalPages,
    startPage,
    endPage,
    startIndex: (currentPage - 1) * pageSize,
    endIndex: Math.min(currentPage * pageSize, totalItems),
  };
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageJump = false,
  className = '',
}: PaginationProps): JSX.Element | null {
  const pagination = useMemo(
    () => calculatePagination(currentPage, totalItems, pageSize),
    [currentPage, totalItems, pageSize]
  );

  const { totalPages, startPage, endPage, startIndex, endIndex } = pagination;

  // 无数据或单页时不显示
  if (totalItems === 0 || totalPages <= 1) {
    return null;
  }

  // 生成页码数组
  const pageNumbers: (number | '...')[] = [];
  if (totalPages <= 7) {
    // 少于等于7页，显示所有
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }
  } else {
    // 大于7页，使用省略号
    pageNumbers.push(1);
    if (startPage > 2) {
      pageNumbers.push('...');
    }
    for (let i = startPage; i <= endPage; i++) {
      if (i !== 1 && i !== totalPages) {
        pageNumbers.push(i);
      }
    }
    if (endPage < totalPages - 1) {
      pageNumbers.push('...');
    }
    pageNumbers.push(totalPages);
  }

  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 ${className}`}>
      {/* 左侧信息 */}
      <div className="flex items-center gap-4">
        {/* 每页条数选择 */}
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">每页</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="text-sm text-slate-600">条</span>
          </div>
        )}

        {/* 总数统计 */}
        <span className="text-sm text-slate-600">
          共 {totalItems} 条
        </span>
      </div>

      {/* 右侧分页导航 */}
      <div className="flex items-center gap-1">
        {/* 跳转到首页 */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
          title="首页"
        >
          ««
        </button>

        {/* 上一页 */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
          title="上一页"
        >
          «
        </button>

        {/* 页码 */}
        {pageNumbers.map((page, index) =>
          page === '...' ? (
            <span
              key={`ellipsis-${index}`}
              className="px-2 py-1 text-sm text-slate-400"
            >
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={[
                'min-w-[32px] rounded px-2 py-1 text-sm',
                currentPage === page
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              {page}
            </button>
          )
        )}

        {/* 下一页 */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
          title="下一页"
        >
          »
        </button>

        {/* 跳转到末页 */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
          title="末页"
        >
          »»
        </button>

        {/* 跳转到某页 */}
        {showPageJump && (
          <div className="ml-2 flex items-center gap-1">
            <span className="text-sm text-slate-600">跳至</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e.target.value, 10);
                if (page >= 1 && page <= totalPages) {
                  onPageChange(page);
                }
              }}
              className="w-14 rounded border border-slate-200 px-2 py-1 text-center text-sm focus:border-blue-500 focus:outline-none"
            />
            <span className="text-sm text-slate-600">页</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Pagination;
