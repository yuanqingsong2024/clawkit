/**
 * 项目详情组件
 */

import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { primaryButtonClassName, secondaryButtonClassName } from '../ui/styles';
import type { Project } from './ProjectCard';

interface ProjectDetailProps {
  /** 项目数据 */
  project: Project;
  /** 编辑回调 */
  onEdit: (project: Project) => void;
  /** 删除回调 */
  onDelete: (key: string) => void;
  /** 删除操作进行中 */
  isDeleting?: boolean;
  /** 是否有未保存的更改 */
  hasChanges?: boolean;
}

export function ProjectDetail({
  project,
  onEdit,
  onDelete,
  isDeleting = false,
  hasChanges = false,
}: ProjectDetailProps): JSX.Element {
  const handleDelete = () => {
    if (confirm(`确定要删除项目 ${project.key} 吗？`)) {
      onDelete(project.key);
    }
  };

  return (
    <Card compact title={`项目详情 · ${project.key}`}>
      <div className="space-y-3">
        {/* 项目概览 */}
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={project.autoExecute ? 'info' : 'warning'}>
                {project.autoExecute ? '自动执行' : '需要确认'}
              </Badge>
              <Badge tone="neutral">{project.baseBranch}</Badge>
              <Badge tone="neutral">端口 {project.openCodePort}</Badge>
            </div>
            <div className="text-xs text-slate-600 break-all">{project.path}</div>
          </div>
        </div>

        {/* 项目信息 */}
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded border border-slate-200 bg-white p-2.5">
            <div className="text-[10px] text-slate-500">基础分支</div>
            <div className="text-sm font-medium text-slate-900">{project.baseBranch}</div>
          </div>
          <div className="rounded border border-slate-200 bg-white p-2.5">
            <div className="text-[10px] text-slate-500">OpenCode 端口</div>
            <div className="text-sm font-medium text-slate-900">{project.openCodePort}</div>
          </div>
        </div>

        {/* 危险操作关键词 */}
        <div className="rounded border border-slate-200 bg-white p-2.5">
          <div className="text-[10px] font-medium text-slate-500">危险操作关键词</div>
          {project.dangerousOps.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {project.dangerousOps.map((op) => (
                <Badge key={op} tone="failed" className="text-xs">
                  {op}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="mt-1 rounded border border-dashed border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] text-slate-500">
              无
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <button type="button" onClick={() => onEdit(project)} className={primaryButtonClassName}>
            编辑
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className={secondaryButtonClassName}
          >
            {isDeleting ? '删除中…' : '删除'}
          </button>
        </div>

        {/* 提示信息 */}
        {hasChanges && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            项目配置已修改，请在下方表单中保存更改
          </div>
        )}
      </div>
    </Card>
  );
}
