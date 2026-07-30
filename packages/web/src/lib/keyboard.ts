// 文件：packages/web/src/lib/keyboard.ts
/**
 * 键盘导航工具函数
 * 用于增强表格和列表的键盘可访问性
 */

import { useEffect, useState } from 'react';

export function useTableKeyboardNavigation<T>(
  rows: T[],
  options: {
    onRowSelect?: (row: T, index: number) => void;
    onPageChange?: (pageDelta: number) => void;
    pageSize?: number;
    currentPage?: number;
    totalPages?: number;
  } = {}
) {
  const { onRowSelect, onPageChange, pageSize = 20, currentPage = 1, totalPages = 1 } = options;
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  // 计算当前页的起始索引
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize - 1, rows.length - 1);

  useEffect(() => {
    // 当页面或数据变化时重置焦点
    setFocusedIndex(-1);
  }, [currentPage, rows.length]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (focusedIndex === -1) {
      // 如果还没有焦点行，将焦点设置到第一行
      if (e.key === 'ArrowDown' && rows.length > 0) {
        e.preventDefault();
        setFocusedIndex(0);
        onRowSelect?.(rows[0], 0);
      }
      return;
    }

    const actualIndex = startIndex + focusedIndex;
    
    switch (e.key) {
      case 'ArrowUp':
        if (focusedIndex > 0) {
          e.preventDefault();
          setFocusedIndex(focusedIndex - 1);
          onRowSelect?.(rows[focusedIndex - 1], focusedIndex - 1);
        } else if (actualIndex > 0 && onPageChange) {
          // 已经是当前页第一行，向上翻页
          e.preventDefault();
          onPageChange(-1);
          setFocusedIndex(pageSize - 1); // 新页面的最后一行
        }
        break;
        
      case 'ArrowDown':
        if (focusedIndex < Math.min(pageSize - 1, rows.length - startIndex - 1)) {
          e.preventDefault();
          setFocusedIndex(focusedIndex + 1);
          onRowSelect?.(rows[focusedIndex + 1], focusedIndex + 1);
        } else if (actualIndex < rows.length - 1 && onPageChange) {
          // 已经是当前页最后一行，向下翻页
          e.preventDefault();
          onPageChange(1);
          setFocusedIndex(0); // 新页面的第一行
        }
        break;
        
      case 'PageUp':
        if (onPageChange) {
          e.preventDefault();
          onPageChange(-1);
          setFocusedIndex(Math.min(pageSize - 1, rows.length - 1));
        }
        break;
        
      case 'PageDown':
        if (onPageChange) {
          e.preventDefault();
          onPageChange(1);
          setFocusedIndex(0);
        }
        break;
        
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        onRowSelect?.(rows[0], 0);
        break;
        
      case 'End':
        e.preventDefault();
        setFocusedIndex(Math.min(pageSize - 1, rows.length - startIndex - 1));
        onRowSelect?.(rows[focusedIndex], focusedIndex);
        break;
        
      case 'Enter':
      case ' ':
        if (focusedIndex >= 0 && actualIndex < rows.length) {
          e.preventDefault();
          onRowSelect?.(rows[actualIndex], actualIndex);
        }
        break;
    }
  };

  return { focusedIndex, setFocusedIndex, handleKeyDown };
}

export function useItemListKeyboardNavigation<T>(
  items: T[],
  options: {
    onItemSelect?: (item: T, index: number) => void;
    onPageChange?: (pageDelta: number) => void;
    itemsPerPage?: number;
    currentPage?: number;
    totalPages?: number;
  } = {}
) {
  // 与表格导航共享相同的实现
  return useTableKeyboardNavigation(items, options);
}