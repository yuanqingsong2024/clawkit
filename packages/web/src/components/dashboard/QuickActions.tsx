/**
 * 快捷操作组件 - Dashboard 首页快捷入口
 */
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';

interface QuickAction {
  title: string;
  description: string;
  icon: string;
  to: string;
  variant: 'primary' | 'secondary';
}

const quickActions: QuickAction[] = [
  {
    title: '新建流水线',
    description: '创建自动化工作流',
    icon: '🔄',
    to: '/pipelines/create',
    variant: 'primary',
  },
  {
    title: '浏览插件',
    description: '发现并安装插件',
    icon: '🧩',
    to: '/plugins',
    variant: 'secondary',
  },
  {
    title: '快速配置',
    description: '初始化系统设置',
    icon: '⚙️',
    to: '/setup',
    variant: 'secondary',
  },
  {
    title: '查看任务',
    description: '管理待处理任务',
    icon: '📋',
    to: '/tasks',
    variant: 'secondary',
  },
];

export function QuickActions(): JSX.Element {
  return (
    <Card className="p-4">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">快捷操作</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className={[
              'flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all',
              action.variant === 'primary'
                ? 'border-blue-200 bg-blue-50 hover:border-blue-300 hover:bg-blue-100'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
            ].join(' ')}
          >
            <span className="text-2xl">{action.icon}</span>
            <div>
              <p className="text-sm font-medium text-slate-900">{action.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

export default QuickActions;
