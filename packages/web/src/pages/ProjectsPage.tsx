import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { InputDialog } from '../components/ui/InputDialog';
import { FileBrowserModal } from '../components/FileBrowserModal';
import { ErrorNotice, InfoNotice, SuccessNotice, WarningNotice } from '../components/ui/Notice';
import { primaryButtonClassName, secondaryButtonClassName } from '../components/ui/styles';
import { ProjectFilters, ProjectCard, ProjectDetail } from '../components/projects';
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
  dangerousOps: Array.isArray(project.dangerousOps) ? project.dangerousOps : [],
  openCodePort: Number.isInteger(project.openCodePort) ? project.openCodePort : Number(project.openCodePort) || 4096,
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
    <section className="space-y-3">
      {/* 顶部标题和操作 */}
      <PageHeader
        title="项目管理"
        description="管理项目配置与审批"
        actions={[
          <button
            key="refresh"
            type="button"
            onClick={() => projectsQuery.refetch()}
            className={secondaryButtonClassName}
            disabled={projectsQuery.isFetching}
          >
            {projectsQuery.isFetching ? '刷新中…' : '刷新'}
          </button>,
          !isAddingProject && (
            <button
              key="add"
              type="button"
              onClick={() => setIsAddingProject(true)}
              className={primaryButtonClassName}
            >
              添加项目
            </button>
          ),
        ]}
      />

      {/* 筛选栏 */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <ProjectFilters
          filter={projectFilter}
          onFilterChange={setProjectFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filteredCount={filteredProjects.length}
          totalCount={projectItems.length}
          autoCount={autoExecuteCount}
          manualCount={manualCount}
          riskyCount={riskyCount}
        />
      </div>

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
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* 模式选择（仅添加时显示） */}
            {!editingProject && (
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
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">项目标识 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  disabled={!!editingProject}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="my-app"
                  required
                />
              </div>

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

              <div className="md:col-span-2 space-y-1">
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

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoExecute"
                checked={formData.autoExecute}
                onChange={(e) => setFormData({ ...formData, autoExecute: e.target.checked })}
                className="rounded border-slate-300"
              />
              <label htmlFor="autoExecute" className="text-sm text-slate-700">自动执行（不需要审批）</label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={addMutation.isPending || updateMutation.isPending || !gitInstalled}
                className={primaryButtonClassName}
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
                className={secondaryButtonClassName}
              >
                取消
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* 项目列表 */}
      {data && data.projects.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
          {/* 左侧项目列表 */}
          <Card compact title="项目列表" className="overflow-hidden">
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.key}
                  project={project}
                  isSelected={project.key === selectedProjectKey}
                  onClick={() => setSelectedProjectKey(project.key)}
                />
              ))}

              {filteredProjects.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500">
                  没有匹配的项目
                </div>
              )}
            </div>
          </Card>

          {/* 右侧项目详情 */}
          {selectedProject ? (
            <ProjectDetail
              project={selectedProject}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isDeleting={deleteMutation.isPending}
            />
          ) : (
            <Card compact title="项目详情">
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-xs text-slate-500">
                选择一个项目查看详情
              </div>
            </Card>
          )}
        </div>
      ) : data && data.projects.length === 0 ? (
        <Card compact title="暂无项目">
          <div className="py-6 text-center">
            <div className="mb-3 text-4xl">📁</div>
            <div className="mb-3 text-sm text-slate-600">还没有添加任何项目</div>
            <button
              type="button"
              onClick={() => setIsAddingProject(true)}
              className={primaryButtonClassName}
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
