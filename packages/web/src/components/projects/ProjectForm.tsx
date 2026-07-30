/**
 * 项目表单组件
 * 支持添加和编辑项目
 */

import { useState } from 'react';
import { primaryButtonClassName, secondaryButtonClassName } from '../ui/styles';
import { Card } from '../ui/Card';
import { FileBrowserModal } from '../FileBrowserModal';
import { apiPost } from '../../lib/api';

type ProjectMode = 'local' | 'remote';

export interface ProjectFormData {
  mode: ProjectMode;
  key: string;
  path: string;
  remoteUrl: string;
  cloneDir: string;
  baseBranch: string;
  autoExecute: boolean;
  dangerousOps: string[];
  openCodePort: number;
}

export interface GitRepoInfo {
  currentBranch: string;
  branches: string[];
  remoteUrl: string | null;
  isGitRepo: boolean;
  rootPath: string;
  hasUncommittedChanges: boolean;
}

interface ProjectFormProps {
  /** 编辑中的项目（null 表示添加模式） */
  editingProject: {
    key: string;
    path: string;
    baseBranch: string;
    autoExecute: boolean;
    dangerousOps: string[];
    openCodePort: number;
  } | null;
  /** 初始表单数据 */
  initialData?: Partial<ProjectFormData>;
  /** 表单提交回调 */
  onSubmit: (data: ProjectFormData) => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 是否正在提交 */
  isSubmitting?: boolean;
  /** Git 是否已安装 */
  gitInstalled?: boolean;
  /** 自定义类名 */
  className?: string;
}

const defaultFormData: ProjectFormData = {
  mode: 'local',
  key: '',
  path: '',
  remoteUrl: '',
  cloneDir: '',
  baseBranch: 'main',
  autoExecute: false,
  dangerousOps: [],
  openCodePort: 4096,
};

export function ProjectForm({
  editingProject,
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  gitInstalled = true,
  className = '',
}: ProjectFormProps): JSX.Element {
  const [formData, setFormData] = useState<ProjectFormData>(() => {
    if (editingProject) {
      return {
        ...defaultFormData,
        mode: 'local',
        key: editingProject.key,
        path: editingProject.path,
        baseBranch: editingProject.baseBranch,
        autoExecute: editingProject.autoExecute,
        dangerousOps: editingProject.dangerousOps,
        openCodePort: editingProject.openCodePort,
      };
    }
    return { ...defaultFormData, ...initialData };
  });

  const [gitInfo, setGitInfo] = useState<GitRepoInfo | null>(null);
  const [isLoadingGitInfo, setIsLoadingGitInfo] = useState(false);
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false);

  // 读取本地 git 仓库信息
  const loadGitInfo = async (path: string, currentKey: string) => {
    if (!path) return;
    
    setIsLoadingGitInfo(true);
    try {
      const info = await apiPost<GitRepoInfo, { path: string }>('/projects/git/info', { path });
      setGitInfo(info);
      
      // 自动填充分支信息
      if (info.currentBranch) {
        setFormData((prev) => ({ ...prev, baseBranch: info.currentBranch }));
      }
      
      // 自动生成项目 key（如果未填写）
      if (!currentKey && info.rootPath) {
        const dirName = info.rootPath.split('/').pop() || '';
        setFormData((prev) => ({ ...prev, key: dirName }));
      }
    } catch (error) {
      console.error('读取 git 信息失败:', error);
      setGitInfo(null);
    } finally {
      setIsLoadingGitInfo(false);
    }
  };

  const handlePathChange = (path: string) => {
    setFormData((prev) => ({ ...prev, path }));
    if (path) {
      void loadGitInfo(path, formData.key);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const isEditMode = editingProject !== null;

  return (
    <Card compact title={isEditMode ? '编辑项目' : '添加项目'} className={className}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* 模式选择（仅添加时显示） */}
        {!isEditMode && (
          <div className="flex gap-4">
            <label className="flex cursor items-center gap-2">
              <input
                type="radio"
                name="mode"
                value="local"
                checked={formData.mode === 'local'}
                onChange={(e) => setFormData({ ...formData, mode: e.target.value as ProjectMode })}
                className="text-slate-900"
              />
              <span className="text-sm">本地项目</span>
            </label>
            <label className="flex cursor items-center gap-2">
              <input
                type="radio"
                name="mode"
                value="remote"
                checked={formData.mode === 'remote'}
                onChange={(e) => setFormData({ ...formData, mode: e.target.value as ProjectMode })}
                className="text-slate-900"
              />
              <span className="text-sm">远程仓库</span>
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* 项目标识 */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              项目标识 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              disabled={isEditMode}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="my-app"
              required
            />
          </div>

          {/* 基础分支 */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">基础分支</label>
            <input
              type="text"
              value={formData.baseBranch}
              onChange={(e) => setFormData({ ...formData, baseBranch: e.target.value })}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="main"
            />
          </div>

          {/* OpenCode 端口 */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">OpenCode 端口</label>
            <input
              type="number"
              value={formData.openCodePort}
              onChange={(e) => setFormData({ ...formData, openCodePort: parseInt(e.target.value, 10) })}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              min="1"
              max="65535"
            />
          </div>

          {/* 危险操作关键词 */}
          <div className="space-y-1 md:col-span-2">
            <label className="block text-xs font-medium text-slate-700">危险操作关键词</label>
            <input
              type="text"
              value={formData.dangerousOps?.join(', ')}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  dangerousOps: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="delete, drop, rm -rf"
            />
          </div>
        </div>

        {/* Git 信息提示 */}
        {isLoadingGitInfo && (
          <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
            正在读取 git 信息…
          </div>
        )}
        {gitInfo?.hasUncommittedChanges && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ⚠️ 当前分支有未提交的更改
          </div>
        )}

        {/* 自动执行选项 */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="autoExecute"
            checked={formData.autoExecute}
            onChange={(e) => setFormData({ ...formData, autoExecute: e.target.checked })}
            className="rounded border-slate-300"
          />
          <label htmlFor="autoExecute" className="text-sm text-slate-700">
            自动执行（不需要审批）
          </label>
        </div>

        {/* 提交按钮 */}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting || !gitInstalled}
            className={primaryButtonClassName}
          >
            {isSubmitting ? '保存中…' : isEditMode ? '更新项目' : '添加项目'}
          </button>
          <button type="button" onClick={onCancel} className={secondaryButtonClassName}>
            取消
          </button>
        </div>
      </form>

      {/* 文件浏览器弹窗 */}
      <FileBrowserModal
        isOpen={isFileBrowserOpen}
        onClose={() => setIsFileBrowserOpen(false)}
        onSelect={(path) => {
          handlePathChange(path);
          setIsFileBrowserOpen(false);
        }}
        title="选择项目目录"
      />
    </Card>
  );
}
