/**
 * 骨架屏组件 - 加载状态占位
 */
import { CSSProperties, useMemo } from 'react';

interface SkeletonProps {
  /** 骨架屏类型 */
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  /** 宽度 */
  width?: number | string;
  /** 高度 */
  height?: number | string;
  /** 动画延迟（秒） */
  animation?: 'pulse' | 'wave' | 'none';
  /** 额外的 class */
  className?: string;
  /** 样式 */
  style?: CSSProperties;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  animation = 'pulse',
  className = '',
  style = {},
}: SkeletonProps): JSX.Element {
  const variantClasses = useMemo(() => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
        return 'rounded-none';
      case 'rounded':
        return 'rounded-lg';
      default:
        return 'rounded';
    }
  }, [variant]);

  const animationClass = useMemo(() => {
    switch (animation) {
      case 'wave':
        return 'animate-pulse';
      case 'none':
        return '';
      default:
        return 'animate-pulse';
    }
  }, [animation]);

  return (
    <div
      className={`bg-slate-200 ${variantClasses} ${animationClass} ${className}`}
      style={{
        width: width ?? (variant === 'text' ? '100%' : undefined),
        height: height ?? (variant === 'text' ? '1em' : undefined),
        ...style,
      }}
    />
  );
}

// 预设骨架屏组合
interface SkeletonPresetProps {
  type: 'card' | 'list' | 'form' | 'table';
  rows?: number;
  className?: string;
}

export function SkeletonPreset({ type, rows = 3, className = '' }: SkeletonPresetProps): JSX.Element {
  switch (type) {
    case 'card':
      return (
        <div className={`space-y-3 ${className}`}>
          <Skeleton variant="rectangular" height={200} className="w-full" />
          <div className="space-y-2">
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="80%" />
          </div>
        </div>
      );

    case 'list':
      return (
        <div className={`space-y-2 ${className}`}>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton variant="circular" width={40} height={40} />
              <div className="flex-1 space-y-1">
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="text" width="70%" />
              </div>
            </div>
          ))}
        </div>
      );

    case 'form':
      return (
        <div className={`space-y-4 ${className}`}>
          <div className="space-y-1">
            <Skeleton variant="text" width={80} height={20} />
            <Skeleton variant="rounded" height={40} />
          </div>
          <div className="space-y-1">
            <Skeleton variant="text" width={80} height={20} />
            <Skeleton variant="rounded" height={40} />
          </div>
          <div className="space-y-1">
            <Skeleton variant="text" width={80} height={20} />
            <Skeleton variant="rounded" height={100} />
          </div>
          <Skeleton variant="rounded" height={40} width={120} />
        </div>
      );

    case 'table':
      return (
        <div className={`space-y-2 ${className}`}>
          {/* 表头 */}
          <div className="flex gap-4 border-b border-slate-200 pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="text" width={80} height={20} />
            ))}
          </div>
          {/* 表格行 */}
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex gap-4 py-2">
              {Array.from({ length: 4 }).map((_, colIndex) => (
                <Skeleton key={colIndex} variant="text" width="100%" />
              ))}
            </div>
          ))}
        </div>
      );

    default:
      return <Skeleton className={className} />;
  }
}

export default Skeleton;
