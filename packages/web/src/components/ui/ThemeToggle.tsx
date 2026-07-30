/**
 * 主题切换按钮
 */

import { useCallback } from 'react';
import { useTheme } from './ThemeProvider';

export function ThemeToggle(): JSX.Element {
  const { theme, toggleTheme, isDark } = useTheme();

  const handleClick = useCallback(() => {
    toggleTheme();
  }, [toggleTheme]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-full border border-slate-300/50 p-1 transition-colors hover:bg-slate-200/50 hover:text-slate-900"
      title={isDark ? '切换到亮色模式' : '切换到深色模式'}
      aria-label={isDark ? '切换到亮色模式' : '切换到深色模式'}
    >
      <svg
        className={`h-4 w-4 ${isDark ? 'text-yellow-400' : 'text-slate-400'} transition-colors duration-200`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={isDark
            ? 'M20 35H16a2 2 0 01-2-2V16a2 2 0 00-2-2H8a2 2 0 00-2 2v3a2 2 0 01-2 2h-4'
            : 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z'}
        />
      </svg>
    </button>
  );
}