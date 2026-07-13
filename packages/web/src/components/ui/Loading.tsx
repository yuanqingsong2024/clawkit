/**
 * 加载状态组件
 * 提供骨架屏和加载动画效果
 */

import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps): JSX.Element {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-200 ${className}`}
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }): JSX.Element {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? 'w-3/4' : 'w-full'} />
      ))}
    </div>
  );
}

export function SkeletonCard(): JSX.Element {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }): JSX.Element {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className={`grid grid-cols-${cols} gap-4 border-b border-slate-200 pb-3`}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className={`grid grid-cols-${cols} gap-4 py-3`}>
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  );
}

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps): JSX.Element {
  const sizeMap = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <motion.div
        className={`${sizeMap[size]} rounded-full border-2 border-blue-200 border-t-blue-600`}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

interface LoadingProps {
  text?: string;
  fullscreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Loading({ text = '加载中...', fullscreen = false, size = 'md' }: LoadingProps): JSX.Element {
  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <Spinner size={size} />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      {content}
    </div>
  );
}

interface ProgressProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Progress({ value, max = 100, showLabel = false, size = 'md', className = '' }: ProgressProps): JSX.Element {
  const percentage = Math.round((value / max) * 100);

  const heightMap = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={`w-full ${className}`}>
      <div className={`w-full overflow-hidden rounded-full bg-slate-200 ${heightMap[size]}`}>
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      {showLabel && (
        <p className="mt-1 text-xs text-slate-500">{percentage}%</p>
      )}
    </div>
  );
}

interface LoadingOverlayProps {
  visible: boolean;
  text?: string;
}

export function LoadingOverlay({ visible, text = '处理中...' }: LoadingOverlayProps): JSX.Element | null {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 shadow-xl">
        <motion.div
          className="h-10 w-10 rounded-full border-3 border-blue-200 border-t-blue-600"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <p className="text-sm font-medium text-slate-600">{text}</p>
      </div>
    </div>
  );
}
