import { NavLink, Outlet } from 'react-router-dom';
import { isDesktop } from '../lib/desktop';

interface NavItem {
  label: string;
  to: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: '控制台', to: '/', icon: '📊' },
  { label: '流水线', to: '/pipelines', icon: '🔄' },
  { label: '插件市场', to: '/plugins', icon: '🧩' },
  { label: '项目', to: '/projects', icon: '📁' },
  { label: '任务', to: '/tasks', icon: '📋' },
  { label: '日志', to: '/logs', icon: '📜' },
  { label: '配置', to: '/config', icon: '⚙️' },
];

export function Layout(): JSX.Element {
  const desktopMode = isDesktop();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-blue-100/50 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="mx-auto max-w-[1600px] px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Brand */}
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25">
                <span className="text-xl">🦞</span>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  ClawKit
                </h1>
                <p className="text-xs text-slate-500">AI 代码助手工作台</p>
              </div>
              {desktopMode && (
                <span className="ml-3 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
                  桌面模式
                </span>
              )}
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    ].join(' ')
                  }
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-400">
                v0.3.0
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="rounded-2xl border border-slate-200/50 bg-white/80 p-6 shadow-xl shadow-slate-200/50 backdrop-blur-sm">
          <Outlet />
        </div>
        <footer className="mt-6 text-center text-xs text-slate-400">
          ClawKit v0.3.0 - 让 AI 代码助手闭环工作
        </footer>
      </main>
    </div>
  );
}
