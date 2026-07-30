/**
 * 项目卡片组件
 */

import { Badge } from '../ui/Badge';

export interface Project {
  key: string;
  path: string;
  baseBranch: string;
  autoExecute: boolean;
  dangerousOps: string[];
  openCodePort: number;
  totalTasks?: number;
  runningTasks?: number;
  completedTasks?: number;
  failedTasks?: number;
}

interface ProjectCardProps {
  /** 项目数据 */
  project: Project;
  /** 是否选中 */
  isSelected: boolean;
  /** 点击回调 */
  onClick: () => void;
}

export function ProjectCard({ project, isSelected, onClick }: ProjectCardProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
        isSelected
          ? 'border-slate-900 bg-slate-50'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-slate-900">{project.key}</div>
          <div className="truncate text-[10px] text-slate-500" title={project.path}>
            {project.path}
          </div>
        </div>
        <Badge tone={project.autoExecute ? 'success' : 'warning'} className="shrink-0 text-[10px]">
          {project.autoExecute ? '自动' : '确认'}
        </Badge>
      </div>
    </button>
  );
}
