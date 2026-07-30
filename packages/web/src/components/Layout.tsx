import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { isDesktop } from '../lib/desktop';
import { ThemeToggleButton } from './theme/theme-context';
import { CommandPalette } from './command-palette/CommandPalette';
import { KeyboardHints } from './command-palette/KeyboardHints';
import { SHORTCUTS, getShortcutLabel, useCommandPalette } from '../contexts';

interface NavItem {
  label: string;
  to: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: '总览', to: '/', icon: '📊' },
  { label: '流水线', to: '/pipelines', icon: '🔄' },
  { label: '插件市场', to: '/plugins', icon: '🧩' },
  { label: '项目', to: '/projects', icon: '📁' },
  { label: '任务中心', to: '/tasks', icon: '📋' },
  { label: '日志', to: '/logs', icon: '📜' },
  { label: '配置', to: '/config', icon: '⚙️' },
];

// 页面标题映射
const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: '总览', subtitle: '系统运行状态' },
  '/pipelines': { title: '流水线', subtitle: '管理和执行 AI 工作流' },
  '/pipelines/create': { title: '新建流水线', subtitle: '创建自动化工作流' },
  '/plugins': { title: '插件市场', subtitle: '发现和安装插件' },
  '/plugins/manage': { title: '插件管理', subtitle: '已安装的插件列表' },
  '/projects': { title: '项目管理', subtitle: '管理代码项目' },
  '/setup': { title: '快速配置', subtitle: '初始化系统配置' },
  '/tasks': { title: '任务中心', subtitle: '查看和管理任务' },
  '/logs': { title: '运行日志', subtitle: '系统日志查看' },
  '/config': { title: '系统配置', subtitle: 'manifest 配置管理' },
};

export function Layout(): JSX.Element {
  const location = useLocation();
  const desktopMode = isDesktop();
  const [collapsed, setCollapsed] = useState(false);
  const { isOpen, setIsOpen } = useCommandPalette();

  // 获取当前页面标题
  const getPageInfo = () => {
    // 精确匹配
    if (pageTitles[location.pathname]) {
      return pageTitles[location.pathname];
    }
    // 前缀匹配（用于详情页如 /pipelines/xxx）
    for (const [path, info] of Object.entries(pageTitles)) {
      if (path !== '/' && location.pathname.startsWith(path)) {
        return info;
      }
    }
    return { title: 'ClawKit', subtitle: 'AI 代码助手工作台' };
  };

  const pageInfo = getPageInfo();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* 左侧导航栏 - 深色风格 */}
      <aside
        className={`flex flex-col border-r border-slate-800 bg-slate-900 transition-all duration-200 hidden lg:flex ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Logo 区域 */}
        <div className="flex h-14 items-center gap-3 border-b border-slate-800 px-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25">
            <span className="text-lg">🦞</span>
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-semibold text-white">ClawKit</h1>
              <p className="truncate text-[10px] text-slate-400">AI 代码助手工作台</p>
            </div>
          )}
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                      collapsed ? 'justify-center px-0' : '',
                    ].join(' ')
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <span className="text-base">{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

                {/* 底部区域 */}
  <div className="border-t border-slate-800 px-2 py-2 flex items-center gap-2 justify-end">
    {/* 深色模式切换按钮 */}
    <ThemeToggleButton />
    {/* 折叠按钮 */}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 transition-all hover:bg-slate-800 hover:text-white"
            title={collapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            <span className="text-base">{collapsed ? '→' : '←'}</span>
            {!collapsed && <span className="truncate">收起</span>}
          </button>

          {/* 版本信息 */}
          {!collapsed && (
            <div className="rounded-lg bg-slate-800/50 px-3 py-2 text-center">
              <div className="text-xs text-slate-500">v0.3.0</div>
            </div>
          )}

          {/* 桌面模式标识 */}
          {desktopMode && !collapsed && (
            <div className="mt-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-center">
              <span className="text-xs font-medium text-blue-400">桌面模式</span>
            </div>
          )}
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 移动端顶部导航栏 */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500">
              <span className="text-sm">🦞</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{pageInfo.title}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>

        {/* 移动端抽屉式侧边栏 */}
        {collapsed && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setCollapsed(true)}
          >
            <aside
              className="absolute bottom-0 left-0 right-0 top-auto flex max-h-[70vh] flex-col rounded-t-2xl bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-12 items-center justify-between border-b border-slate-800 px-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500">
                    <span className="text-sm">🦞</span>
                  </div>
                  <span className="text-sm font-semibold text-white">ClawKit</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-2 px-2">
                <ul className="space-y-0.5">
                  {navItems.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        className={({ isActive }) =>
                          [
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                            isActive
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                          ].join(' ')
                        }
                        onClick={() => setCollapsed(true)}
                      >
                        <span className="text-lg">{item.icon}</span>
                        <span>{item.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          </div>
        )}

        {/* 桌面端内容区 Header */}
        <header className="hidden h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:flex">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{pageInfo.title}</h2>
              {pageInfo.subtitle && (
                <p className="text-xs text-slate-500">{pageInfo.subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 全局搜索快捷键 */}
            <button
              type="button"
              onClick={() => {
                // 触发 Command+K / Ctrl+K
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
            >
              <span>⌘K</span>
              <span>搜索</span>
            </button>
          </div>
        </header>

        {/* 内容区域 */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4">
          <div className="mx-auto max-w-[1600px]">
            <Outlet />
          </div>
        </main>

        {/* 命令面板 */}
        <CommandPalette isOpen={isOpen} onClose={() => setIsOpen(false)} />

        {/* 底部状态栏 */}
        <footer className="flex h-7 shrink-0 items-center justify-between border-t border-slate-200 bg-slate-100 px-4 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>ClawKit v0.3.0</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">按住 <kbd className="px-1 py-0.5 bg-slate-200 rounded text-[10px]">?</kbd> 显示快捷键</span>
            <span>{new Date().toLocaleTimeString('zh-CN')}</span>
          </div>
        </footer>
      </div>

      {/* 全局键盘快捷键提示 */}
      <KeyboardHints />
    </div>
  );
}
