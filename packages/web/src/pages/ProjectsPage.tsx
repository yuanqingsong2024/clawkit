import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { InputDialog } from '../components/ui/InputDialog';
import { FileBrowserModal } from '../components/FileBrowserModal';
import { ErrorNotice, InfoNotice, SuccessNotice, WarningNotice } from '../components/ui/Notice';
import { primaryButtonClassName, secondaryButtonClassName } from '../components/ui/styles';
import { apiGet, apiPost, apiDelete, apiPut } from '../lib/api';

interface Project {
  key: string;
  path: string;
  baseBranch: string;
  autoExecute: boolean;
  dangerousOps: string[];
  openCodePort: number;
  // 运行时统计
  totalTasks?: number;
  runningTasks?: number;
  completedTasks?: number;
  failedTasks?: number;
}

interface ProjectListResult {
  projects: Project[];
  total: number;
}

interface GitRepoInfo {
  currentBranch: string;
  branches: string[];
  remoteUrl: string | null;
  isGitRepo: boolean;
  rootPath: string;
  hasUncommittedChanges: boolean;
}

type ProjectMode = 'local' | 'remote';

interface AddProjectFormData {
  mode: ProjectMode;
  key: string;
  // 本地模式
  path: string;
  // 远程模式
  remoteUrl: string;
  cloneDir: string;
  // 通用字段
  baseBranch: string;
  autoExecute: boolean;
  dangerousOps: string[];
  openCodePort: number;
}

interface RemoteProjectDialogState {
  isOpen: boolean;
  remoteUrl: string;
  cloneDir: string;
}

export function ProjectsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<'all' | 'auto' | 'manual' | 'risky'>('all');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [gitInstalled, setGitInstalled] = useState<boolean | null>(null);
  const [gitInfo, setGitInfo] = useState<GitRepoInfo | null>(null);
  const [isLoadingGitInfo, setIsLoadingGitInfo] = useState(false);
  const [isCheckingRemoteUrl, setIsCheckingRemoteUrl] = useState(false);
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false);
  const [remoteDialog, setRemoteDialog] = useState<RemoteProjectDialogState>({
    isOpen: false,
    remoteUrl: '',
    cloneDir: '',
  });
  const [remoteDialogStep, setRemoteDialogStep] = useState<'remoteUrl' | 'cloneDir' | null>(null);

  // 表单状态
  const [formData, setFormData] = useState<AddProjectFormData>({
    mode: 'local',
    key: '',
    path: '',
    remoteUrl: '',
    cloneDir: '',
    baseBranch: 'main',
    autoExecute: false,
    dangerousOps: [],
    openCodePort: 4096,
  });

  // 检查 git 是否安装
  useEffect(() => {
    const checkGit = async () => {
      try {
        const result = await apiGet<{ installed: boolean }>('/projects/git/check');
        setGitInstalled(result.installed);
        if (!result.installed) {
          setNotification({ type: 'warning', message: 'Git 未安装，无法使用项目管理功能' });
        }
      } catch (error) {
        console.error('检查 git 失败:', error);
      }
    };
    void checkGit();
  }, []);

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiGet<ProjectListResult>('/projects'),
  });

  const addMutation = useMutation({
    mutationFn: (project: AddProjectFormData) => apiPost<Project, AddProjectFormData>('/projects', project),
    onSuccess: () => {
      setNotification({ type: 'success', message: '项目添加成功' });
      setIsAddingProject(false);
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error) => {
      setNotification({ type: 'error', message: `添加失败：${error instanceof Error ? error.message : '未知错误'}` });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, data }: { key: string; data: Partial<Project> }) =>
      apiPut<Project, Partial<Project>>(`/projects/${key}`, data),
    onSuccess: () => {
      setNotification({ type: 'success', message: '项目更新成功' });
      setEditingProject(null);
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error) => {
      setNotification({ type: 'error', message: `更新失败：${error instanceof Error ? error.message : '未知错误'}` });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => apiDelete(`/projects/${key}`),
    onSuccess: () => {
      setNotification({ type: 'success', message: '项目删除成功' });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error) => {
      setNotification({ type: 'error', message: `删除失败：${error instanceof Error ? error.message : '未知错误'}` });
    },
  });

  const resetForm = () => {
    setFormData({
      mode: 'local',
      key: '',
      path: '',
      remoteUrl: '',
      cloneDir: '',
      baseBranch: 'main',
      autoExecute: false,
      dangerousOps: [],
      openCodePort: 4096,
    });
    setGitInfo(null);
  };

  const openLocalBrowser = (): void => {
    setIsFileBrowserOpen(true);
  };

  const handleDirectorySelected = (selectedPath: string): void => {
    setFormData((prev) => ({
      ...prev,
      path: selectedPath,
    }));
    void loadGitInfo(selectedPath);
  };

  const openRemoteDialog = (): void => {
    setRemoteDialogStep('remoteUrl');
    setRemoteDialog((prev) => ({
      ...prev,
      remoteUrl: formData.remoteUrl,
      cloneDir: formData.cloneDir,
    }));
  };

  const confirmRemoteUrl = (remoteUrl: string): void => {
    if (!remoteUrl) {
      setNotification({ type: 'error', message: '远程仓库 URL 不能为空' });
      return;
    }

    setIsCheckingRemoteUrl(true);
    void apiPost<{ valid: boolean }, { remoteUrl: string }>('/projects/git/validate', { remoteUrl })
        .then((result) => {
          if (!result.valid) {
            setNotification({ type: 'error', message: '远程仓库不可访问，请检查地址后重试' });
            return;
          }

          const repoName = remoteUrl
            .replace(/\/$/, '')
            .split('/')
            .pop()
            ?.replace(/\.git$/, '') ?? 'repo';

        const defaultCloneDir = formData.cloneDir || `~/projects/${repoName}`;

        setRemoteDialog((prev) => ({
          ...prev,
          remoteUrl,
          cloneDir: defaultCloneDir,
        }));
        setRemoteDialogStep('cloneDir');
      })
      .catch((error) => {
        setNotification({
          type: 'error',
          message: `验证远程仓库失败：${error instanceof Error ? error.message : '未知错误'}`,
        });
      })
      .finally(() => {
        setIsCheckingRemoteUrl(false);
      });
  };

  const confirmCloneDir = (cloneDir: string): void => {
    const nextRemoteUrl = remoteDialog.remoteUrl;
    const nextCloneDir = cloneDir.trim();

    if (!nextRemoteUrl) {
      setNotification({ type: 'error', message: '请先填写远程仓库 URL' });
      setRemoteDialogStep('remoteUrl');
      return;
    }

    if (!nextCloneDir) {
      setNotification({ type: 'error', message: '克隆目录不能为空' });
      return;
    }

    setRemoteDialog((prev) => ({
      ...prev,
      cloneDir: nextCloneDir,
      isOpen: false,
    }));
    setRemoteDialogStep(null);
    setFormData((prev) => ({
      ...prev,
      remoteUrl: nextRemoteUrl,
      cloneDir: nextCloneDir,
    }));
  };

  // 读取本地 git 仓库信息
  const loadGitInfo = async (path: string) => {
    if (!path) return;
    
    setIsLoadingGitInfo(true);
    try {
      const info = await apiPost<GitRepoInfo, { path: string }>('/projects/git/info', { path });
      setGitInfo(info);
      
      // 自动填充分支信息
      if (info.currentBranch) {
        setFormData(prev => ({ ...prev, baseBranch: info.currentBranch }));
      }
      
      // 自动生成项目 key（如果未填写）
      if (!formData.key && info.rootPath) {
        const dirName = info.rootPath.split('/').pop() || '';
        setFormData(prev => ({ ...prev, key: dirName }));
      }
    } catch (error) {
      setNotification({ 
        type: 'error', 
        message: `读取 git 信息失败：${error instanceof Error ? error.message : '未知错误'}` 
      });
      setGitInfo(null);
    } finally {
      setIsLoadingGitInfo(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    if (editingProject) {
      // 编辑模式：只更新部分字段
      const updates: Partial<Project> = {
        path: formData.path,
        baseBranch: formData.baseBranch,
        autoExecute: formData.autoExecute,
        dangerousOps: formData.dangerousOps,
        openCodePort: formData.openCodePort,
      };
      updateMutation.mutate({ key: editingProject.key, data: updates });
    } else {
      // 添加模式
      addMutation.mutate(formData);
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      mode: 'local',
      key: project.key,
      path: project.path,
      remoteUrl: '',
      cloneDir: '',
      baseBranch: project.baseBranch,
      autoExecute: project.autoExecute,
      dangerousOps: project.dangerousOps,
      openCodePort: project.openCodePort,
    });
    setIsAddingProject(true);
  };

  const handleCancelEdit = () => {
    setEditingProject(null);
    setIsAddingProject(false);
    resetForm();
  };

  const handleDelete = (key: string) => {
    if (confirm(`确定要删除项目 ${key} 吗？`)) {
      setNotification(null);
      deleteMutation.mutate(key);
    }
  };

  const data = projectsQuery.data;
  const projectItems = (data?.projects ?? []).map((project) => ({
    ...project,
    autoExecute: project.autoExecute ?? false,
    dangerousOps: project.dangerousOps ?? [],
    openCodePort: project.openCodePort ?? 4096,
  }));
  const autoExecuteCount = projectItems.filter((project) => project.autoExecute).length;
  const manualCount = projectItems.length - autoExecuteCount;
  const riskyCount = projectItems.filter((project) => (project.dangerousOps?.length ?? 0) > 0).length;
  const totalTasks = projectItems.reduce((sum, project) => sum + (project.totalTasks ?? 0), 0);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredProjects = projectItems.filter((project) => {
    const searchMatched =
      normalizedSearchQuery.length === 0 ||
      [project.key, project.path, project.baseBranch, project.openCodePort.toString(), ...(project.dangerousOps ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearchQuery);

    if (!searchMatched) {
      return false;
    }

    if (projectFilter === 'auto') {
      return project.autoExecute;
    }

    if (projectFilter === 'manual') {
      return !project.autoExecute;
    }

    if (projectFilter === 'risky') {
      return (project.dangerousOps?.length ?? 0) > 0;
    }

    return true;
  });

  const selectedProject = filteredProjects.find((project) => project.key === selectedProjectKey) ?? null;

  useEffect(() => {
    if (filteredProjects.length === 0) {
      if (selectedProjectKey !== null) {
        setSelectedProjectKey(null);
      }
      return;
    }

    if (!selectedProjectKey || !filteredProjects.some((project) => project.key === selectedProjectKey)) {
      setSelectedProjectKey(filteredProjects[0].key);
    }
  }, [filteredProjects, selectedProjectKey]);

  return (
    <section className="space-y-4">
      {/* 顶部标题和操作 */}
      <Card compact className="overflow-hidden bg-gradient-to-br from-slate-50 via-white to-sky-50/50">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">项目管理</h1>
              <div className="mt-1 text-sm text-slate-600">管理项目配置与审批</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge tone="neutral">项目总数 {projectItems.length}</Badge>
              <Badge tone="success">自动 {autoExecuteCount}</Badge>
              <Badge tone="warning">需要确认 {manualCount}</Badge>
              <Badge tone="failed">危险配置 {riskyCount}</Badge>
              <Badge tone="info">任务总数 {totalTasks}</Badge>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span>当前筛选：{projectFilter === 'all' ? '全部项目' : projectFilter === 'auto' ? '自动执行' : projectFilter === 'manual' ? '需要确认' : '危险配置'}</span>
              <span>匹配结果：{filteredProjects.length} 个</span>
              {selectedProject ? <span>已选中：{selectedProject.key}</span> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => projectsQuery.refetch()}
              className={secondaryButtonClassName}
              disabled={projectsQuery.isFetching}
            >
              {projectsQuery.isFetching ? '刷新中…' : '刷新'}
            </button>
            {!isAddingProject && (
              <button
                type="button"
                onClick={() => setIsAddingProject(true)}
                className={primaryButtonClassName}
              >
                添加项目
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* 通知 */}
      {notification?.type === 'success' && <SuccessNotice message={notification.message} />}
      {notification?.type === 'error' && <ErrorNotice message={notification.message} />}
      {notification?.type === 'warning' && <WarningNotice message={notification.message} />}

      {projectsQuery.isLoading ? <InfoNotice message="正在加载项目列表…" /> : null}
      {projectsQuery.error ? (
        <ErrorNotice message={projectsQuery.error instanceof Error ? projectsQuery.error.message : '未知错误'} />
      ) : null}

      {/* 添加/编辑表单 */}
      {isAddingProject && (
        <Card compact title={editingProject ? '编辑项目' : '添加项目'}>
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* 模式选择（仅添加时显示） */}
            {!editingProject && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">项目来源</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
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
                  <label className="flex items-center gap-2 cursor-pointer">
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
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  项目标识 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  disabled={!!editingProject}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="my-app"
                  required
                />
                <div className="mt-1 text-xs text-slate-500">唯一标识，创建后不可修改</div>
              </div>

              {/* 本地模式：项目路径 */}
              {(formData.mode === 'local' || editingProject) && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    项目路径 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={formData.path}
                      onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="/path/to/project"
                      required
                    />
                    {!editingProject && (
                      <>
                        <button
                          type="button"
                          onClick={openLocalBrowser}
                          disabled={!gitInstalled}
                          className={secondaryButtonClassName}
                        >
                          选择目录
                        </button>
                        <button
                          type="button"
                          onClick={() => loadGitInfo(formData.path)}
                          disabled={!formData.path || isLoadingGitInfo || gitInstalled === false}
                          className={secondaryButtonClassName}
                        >
                          {isLoadingGitInfo ? '读取中…' : '读取 Git'}
                        </button>
                      </>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    从本机目录中选择一个已初始化的 git 仓库。
                  </div>
                </div>
              )}

              {/* 远程模式：仓库 URL 和克隆目录 */}
              {formData.mode === 'remote' && !editingProject && (
                <div className="sm:col-span-2 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      远程仓库 URL <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.remoteUrl}
                        readOnly
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                        placeholder="https://github.com/user/repo.git"
                        required
                      />
                      <button
                        type="button"
                        onClick={openRemoteDialog}
                        className={secondaryButtonClassName}
                      >
                        选择远程仓库
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      克隆到目录 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.cloneDir}
                      onChange={(e) => setFormData({ ...formData, cloneDir: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="/path/to/clone/directory"
                      required
                    />
                    <div className="mt-1 text-xs text-slate-500">
                      仓库将被克隆到此目录，支持 `~/projects/...` 这种写法，目录必须不存在。
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">基础分支</label>
                <input
                  type="text"
                  value={formData.baseBranch}
                  onChange={(e) => setFormData({ ...formData, baseBranch: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="main"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">OpenCode 端口</label>
                <input
                  type="number"
                  value={formData.openCodePort}
                  onChange={(e) => setFormData({ ...formData, openCodePort: parseInt(e.target.value, 10) })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  min="1"
                  max="65535"
                />
              </div>
            </div>

            {/* Git 信息显示 */}
            {gitInfo && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="font-medium text-slate-700 mb-2">Git 仓库信息</div>
                <div className="space-y-1 text-slate-600">
                  <div>当前分支：<span className="font-mono">{gitInfo.currentBranch}</span></div>
                  <div>所有分支：<span className="font-mono">{gitInfo.branches.join(', ')}</span></div>
                  {gitInfo.remoteUrl && <div>远程仓库：<span className="font-mono text-xs">{gitInfo.remoteUrl}</span></div>}
                  {gitInfo.hasUncommittedChanges && (
                    <div className="text-amber-600">⚠️ 有未提交的更改</div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.autoExecute}
                  onChange={(e) => setFormData({ ...formData, autoExecute: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <span className="text-sm font-medium text-slate-700">自动执行（不需要审批）</span>
              </label>
              <div className="mt-1 text-xs text-slate-500">
                启用后，任务将自动执行；禁用时需要手动确认
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">危险操作关键词</label>
              <input
                type="text"
                value={formData.dangerousOps?.join(', ')}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dangerousOps: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="delete, drop, rm -rf"
              />
              <div className="mt-1 text-xs text-slate-500">
                用逗号分隔，匹配到这些关键词时强制审批（即使启用了自动执行）
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={addMutation.isPending || updateMutation.isPending || !gitInstalled}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {addMutation.isPending || updateMutation.isPending
                  ? '保存中…'
                  : editingProject
                    ? '更新项目'
                    : '添加项目'}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                取消
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* 项目列表 */}
      {data && data.projects.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <Card compact title="项目列表" className="overflow-hidden">
            <div className="space-y-2.5">
              <div className="space-y-2 border-b border-slate-100 pb-2.5">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索项目名、路径、分支、端口、危险词"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setProjectFilter('all')}
                    className={`rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                      projectFilter === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    全部 {projectItems.length}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectFilter('auto')}
                    className={`rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                      projectFilter === 'auto'
                        ? 'bg-sky-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    自动 {autoExecuteCount}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectFilter('manual')}
                    className={`rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                      projectFilter === 'manual'
                        ? 'bg-amber-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    需要确认 {manualCount}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectFilter('risky')}
                    className={`rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                      projectFilter === 'risky'
                        ? 'bg-rose-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    危险配置 {riskyCount}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setProjectFilter('all');
                    }}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    清空
                  </button>
                </div>
                <div className="text-xs text-slate-500">
                  共 {filteredProjects.length} 个匹配项目
                </div>
              </div>

              {filteredProjects.map((project) => {
                const isSelected = project.key === selectedProjectKey;
                const taskCount = project.totalTasks ?? 0;

                return (
                    <button
                      key={project.key}
                      type="button"
                      onClick={() => setSelectedProjectKey(project.key)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                    >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-semibold text-slate-900">{project.key}</div>
                          {isSelected ? <Badge tone="info" className="shrink-0">已选中</Badge> : null}
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-500" title={project.path}>
                          {project.path}
                        </div>
                      </div>
                      <Badge tone={project.autoExecute ? 'info' : 'warning'} className="shrink-0">
                        {project.autoExecute ? '自动' : '确认'}
                      </Badge>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <Badge tone="neutral" className="text-xs">分支 {project.baseBranch}</Badge>
                      <Badge tone="neutral" className="text-xs">端口 {project.openCodePort}</Badge>
                      <Badge tone="neutral" className="text-xs">任务 {taskCount}</Badge>
                      {project.dangerousOps.length > 0 ? <Badge tone="failed" className="text-xs">危险 {project.dangerousOps.length}</Badge> : null}
                    </div>
                  </button>
                );
              })}

              {filteredProjects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  没有找到匹配的项目，试试清空筛选条件
                </div>
              ) : null}
            </div>
          </Card>

          <Card compact title={selectedProject ? `项目详情 · ${selectedProject.key}` : '项目详情'} className="overflow-hidden">
            {selectedProject ? (
              <div className="space-y-3.5">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3.5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={selectedProject.autoExecute ? 'info' : 'warning'}>
                          {selectedProject.autoExecute ? '自动执行' : '需要确认'}
                        </Badge>
                        <Badge tone="neutral">{selectedProject.baseBranch}</Badge>
                        <Badge tone="neutral">端口 {selectedProject.openCodePort}</Badge>
                        <Badge tone="neutral">任务 {selectedProject.totalTasks ?? 0}</Badge>
                      </div>
                      <div className="mt-2.5 text-sm text-slate-600">{selectedProject.path}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-right">
                      <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                        <div className="text-xs text-slate-500">自动执行</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{selectedProject.autoExecute ? '开启' : '关闭'}</div>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                        <div className="text-xs text-slate-500">危险词</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{selectedProject.dangerousOps.length}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <div className="text-xs text-slate-500">路径</div>
                    <div className="mt-1 break-all font-mono text-sm text-slate-900">{selectedProject.path}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <div className="text-xs text-slate-500">基础分支</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{selectedProject.baseBranch}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <div className="text-xs text-slate-500">OpenCode 端口</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{selectedProject.openCodePort}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <div className="text-xs text-slate-500">任务总数</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{selectedProject.totalTasks ?? 0}</div>
                  </div>
                </div>

                <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-medium text-slate-500">危险操作关键词</div>
                    {selectedProject.dangerousOps.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selectedProject.dangerousOps.map((op) => (
                          <Badge key={op} tone="failed" className="text-xs">
                            {op}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        当前没有配置危险操作关键词
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-medium text-slate-500">任务统计</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone="neutral" className="text-xs">总数 {selectedProject.totalTasks ?? 0}</Badge>
                      {(selectedProject.runningTasks ?? 0) > 0 ? <Badge tone="info" className="text-xs">运行中 {selectedProject.runningTasks}</Badge> : null}
                      {(selectedProject.completedTasks ?? 0) > 0 ? <Badge tone="success" className="text-xs">完成 {selectedProject.completedTasks}</Badge> : null}
                      {(selectedProject.failedTasks ?? 0) > 0 ? <Badge tone="failed" className="text-xs">失败 {selectedProject.failedTasks}</Badge> : null}
                    </div>
                  </div>
                </div>

                <div className="sticky bottom-3 z-10 -mx-1 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-500">快捷操作</div>
                      <div className="mt-1 truncate text-sm text-slate-700">
                        当前项目：<span className="font-medium text-slate-900">{selectedProject.key}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(selectedProject)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                      >
                        编辑当前项目
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(selectedProject.key)}
                        disabled={deleteMutation.isPending}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        删除当前项目
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                选择左侧项目以查看详情
              </div>
            )}
          </Card>
        </div>
      ) : data && data.projects.length === 0 ? (
        <Card title="暂无项目">
          <div className="py-8 text-center">
            <div className="mb-4 text-slate-500">还没有添加任何项目</div>
            <button
              type="button"
              onClick={() => setIsAddingProject(true)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              添加第一个项目
            </button>
          </div>
        </Card>
      ) : null}

      <FileBrowserModal
        isOpen={isFileBrowserOpen}
        onClose={() => setIsFileBrowserOpen(false)}
        onSelect={handleDirectorySelected}
        title="选择本地 Git 项目目录"
        selectLabel="选择目录"
        selectType="directory"
        initialPath={formData.path || undefined}
        filter={(item) => item.type === 'directory'}
      />

      <InputDialog
        isOpen={remoteDialogStep === 'remoteUrl'}
        onClose={() => setRemoteDialogStep(null)}
        onConfirm={confirmRemoteUrl}
        title="输入远程仓库地址"
        label="远程仓库 URL"
        placeholder="https://github.com/user/repo.git"
        initialValue={remoteDialog.remoteUrl}
        confirmLabel={isCheckingRemoteUrl ? '校验中…' : '下一步'}
        cancelLabel="取消"
      />

      <InputDialog
        isOpen={remoteDialogStep === 'cloneDir'}
        onClose={() => setRemoteDialogStep(null)}
        onConfirm={confirmCloneDir}
        title="选择克隆目录"
        label="本地目录"
        placeholder="/path/to/clone/directory"
        initialValue={remoteDialog.cloneDir}
        confirmLabel="确认"
        cancelLabel="取消"
      />
    </section>
  );
}
