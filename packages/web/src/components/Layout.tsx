import { NavLink, Outlet } from 'react-router-dom';

interface NavItem {
  label: string;
  to: string;
}

const navItems: NavItem[] = [
  { label: '总览', to: '/' },
  { label: '配置', to: '/config' },
  { label: '部署', to: '/deploy' },
  { label: '向导', to: '/setup' },
  { label: '修复', to: '/heal' },
  { label: '状态', to: '/status' },
  { label: '任务', to: '/tasks' },
];

export function Layout(): JSX.Element {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-6">
        <aside className="w-56 shrink-0">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <div className="text-lg font-semibold">clawkit 控制台</div>
              <div className="text-sm text-slate-500">轻量 Web Console（骨架）</div>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    [
                      'block rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
                    ].join(' ')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <Outlet />
          </div>
          <div className="mt-4 text-xs text-slate-500">
            当前阶段仅提供路由与布局骨架，不包含真实数据与交互。
          </div>
        </main>
      </div>
    </div>
  );
}
