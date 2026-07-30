/**
 * ClawKit UI 样式主题
 * 工作台风格 - 深色侧边栏 + 浅色内容区
 */

// ========== 颜色变量 ==========

export const colors = {
  // 主色调 - 蓝色
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  // 辅助色 - 紫色
  accent: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
  },
  // 成功色
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  // 警告色
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  // 错误色
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  // 侧边栏深色
  sidebar: {
    bg: '#0f172a', // slate-900
    border: '#1e293b', // slate-800
    text: '#94a3b8', // slate-400
    textActive: '#ffffff',
    hover: '#1e293b', // slate-800
  },
};

// ========== 渐变 ==========

export const gradients = {
  primary: 'bg-gradient-to-r from-blue-600 to-indigo-600',
  accent: 'bg-gradient-to-r from-indigo-600 to-purple-600',
  header: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600',
  card: 'bg-gradient-to-br from-white to-slate-50',
};

// ========== 输入框 ==========

export const inputClassName =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

export const selectClassName =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

// ========== 按钮 ==========

// 主按钮 - 蓝色渐变（紧凑版）
export const primaryButtonClassName =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100';

// 次要按钮（紧凑版）
export const secondaryButtonClassName =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100';

// 成功按钮
export const successButtonClassName =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-green-600 to-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:from-green-700 hover:to-emerald-700 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

// 警告按钮
export const warningButtonClassName =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:from-amber-600 hover:to-orange-600 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

// 危险按钮
export const dangerButtonClassName =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-red-600 to-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:from-red-700 hover:to-rose-700 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

// 紧凑按钮
export const compactButtonClassName =
  'inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';

// 图标按钮
export const iconButtonClassName =
  'inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';

// ========== 卡片 ==========

export const cardClassName =
  'rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md';

export const cardHeaderClassName = 'flex items-center justify-between mb-3';

export const cardTitleClassName = 'text-sm font-semibold text-slate-900';

// ========== 状态徽章 ==========

export const badgeClassName = {
  success: 'inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700',
  warning: 'inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700',
  error: 'inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700',
  info: 'inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700',
  default: 'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600',
};

// ========== 表格 ==========

export const tableClassName = 'w-full text-sm';

export const tableHeaderClassName =
  'border-b border-slate-200 bg-slate-50/50 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500';

export const tableCellClassName = 'whitespace-nowrap px-3 py-2 text-slate-600';

export const tableRowClassName = 'border-b border-slate-100 transition-colors hover:bg-slate-50/50';

// ========== 导航 ==========

// 工作台风格侧边栏导航
export const navItemClassName =
  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all';

export const navItemActiveClassName =
  'bg-blue-600 text-white shadow-sm';

export const navItemInactiveClassName =
  'text-slate-400 hover:bg-slate-800 hover:text-white';

// ========== 动画 ==========

export const animations = {
  fadeIn: 'animate-fade-in',
  slideUp: 'animate-slide-up',
  slideDown: 'animate-slide-down',
  pulse: 'animate-pulse',
  spin: 'animate-spin',
};

// ========== 阴影 ==========

export const shadows = {
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  inner: 'shadow-inner',
};

// ========== 间距 ==========

export const spacing = {
  section: 'space-y-4',
  card: 'space-y-3',
};
