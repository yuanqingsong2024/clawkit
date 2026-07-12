import { NavLink, Outlet } from 'react-router-dom';

import { isDesktop } from '../lib/desktop';

interface NavItem {
  label: string;
  to: string;
}

const navItems: NavItem[] = [
  { label: '控制台', to: '/' },
  { label: '快速配置', to: '/setup' },
  { label: '项目', to: '/projects' },
  { label: '任务', to: '/tasks' },
  { label: '配置', to: '/config' },
  { label: '日志', to: '/logs' },
];

export function Layout(): JSX.Element {
  const desktopMode = isDesktop();

  return (
    <div className="min-h-screen">
      <div className="mx-auto min-h-screen w-full max-w-[1440px] px-4 py-3">
        <header className="sticky top-3 z-20 mb-3 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <div className="whitespace-nowrap text-sm font-semibold text-slate-900">clawkit 控制台</div>
              {desktopMode ? (
                <span className="shrink-0 whitespace-nowrap rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                  桌面模式
                </span>
              ) : null}
              <div className="text-xs text-slate-500">简化版 Web Console</div>
            </div>

            <nav className="flex flex-wrap gap-1.5">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    [
                      'rounded-full px-3 py-1.5 text-sm transition-colors',
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900',
                    ].join(' ')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        <main className="min-w-0">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Outlet />
          </div>
          <div className="mt-4 text-xs text-slate-500">
            Clawkit v0.2.0 - 简化版
          </div>
        </main>
      </div>
    </div>
  );
}
