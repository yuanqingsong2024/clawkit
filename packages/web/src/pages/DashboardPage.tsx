import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { CodeBlock } from '../components/ui/CodeBlock';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorNotice, InfoNotice, WarningNotice } from '../components/ui/Notice';
import { primaryButtonClassName, secondaryButtonClassName } from '../components/ui/styles';
import { StatusCards, WorkersList, RecentTasks, DashboardSkeleton } from '../components/dashboard';
import { formatDateTime, isNonEmptyString } from '../lib/format';
import { apiGet, apiPost } from '../lib/api';
import { checkOpenCodeStatus as checkDesktopOpenCodeStatus } from '../lib/desktop';
import { isDesktop, openUrl as openDesktopUrl, revealOpenCodePassword as revealDesktopOpenCodePassword, saveOpenCodePassword as saveDesktopOpenCodePassword, startOpenCode as startDesktopOpenCode, startProjectManager } from '../lib/desktop';

interface WorkerRecord {
  workerId: string;
  name: string;
  status: 'idle' | 'busy' | 'offline' | string;
  lastHeartbeatAt: string;
  currentTaskId?: string;
}

interface OpenCodeStatusSummary {
  workerId: string;
  projectKey: string;
  nodeName: string;
  port: number;
  status: 'online' | 'offline' | 'unknown' | string;
  detail: string;
  canStart?: boolean;
}

interface OpenCodeStartResult {
  projectKey: string;
  nodeName: string;
  port: number;
  started: boolean;
  message: string;
  detail?: string;
}

interface WorkerStartResult {
  workerId: string;
  started: boolean;
  message: string;
  detail?: string;
}

interface WorkerLogsResult {
  workerId: string;
  logFile: string;
  lines: string[];
}

interface OpenClawStartResult {
  started: boolean;
  message: string;
  detail?: string;
}

interface OpenCodeInstanceGroup {
  key: string;
  workerId: string;
  nodeName: string;
  port: number;
  status: string;
  detail: string;
  canStart: boolean;
  projectKeys: string[];
  primaryProjectKey: string;
}

interface TaskListItem {
  taskId: string;
  projectKey: string;
  intent: string;
  status: string;
  updatedAt: string;
}

interface OverviewData {
  profile: {
    name: string;
    topology: string;
  };
  manifestPath: string | null;
  controller: {
    status: 'online' | string;
    publicUrl: string;
    runtimeNotice: string;
  };
  workers: {
    total: number;
    online: number;
    idle: number;
    busy: number;
    offline: number;
    items: WorkerRecord[];
  };
  openClaw: {
    configured: boolean;
    publicUrl: string;
    tokenConfigured: boolean;
    detail: string;
    localDetected: boolean;
    serviceStatus: 'online' | 'offline' | 'unknown' | 'checking';
    healthCheckUrl: string | null;
    healthCheckDetail: string;
    lastCheckAt: string | null;
    canStart: boolean;
  };
  openCode: OpenCodeStatusSummary[];
  recentTasks: TaskListItem[];
}

interface DesktopOpenCodeStatus {
  passwordConfigured: boolean;
}

const PROJECT_MANAGER_WEB_URL_STORAGE_KEY = 'clawkit.projectManagerWebUrl';

function toneForSystemStatus(status: string): 'success' | 'warning' | 'failed' | 'neutral' {
  if (status === 'online') return 'success';
  if (status === 'warning') return 'warning';
  if (status === 'failed') return 'failed';
  return 'neutral';
}

function toneForWorkerStatus(status: string): 'success' | 'info' | 'failed' | 'neutral' {
  if (status === 'idle') return 'success';
  if (status === 'busy') return 'info';
  if (status === 'offline') return 'failed';
  return 'neutral';
}

function toneForServiceStatus(status: string): 'success' | 'warning' | 'failed' | 'neutral' {
  if (status === 'online') return 'success';
  if (status === 'offline') return 'failed';
  if (status === 'checking') return 'warning';
  return 'neutral';
}

function labelForServiceStatus(status: string): string {
  if (status === 'online') return '在线';
  if (status === 'offline') return '离线';
  if (status === 'checking') return '检查中';
  if (status === 'unknown') return '未知';
  return status;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }

    const maybeToString = (error as { toString?: unknown }).toString;
    if (typeof maybeToString === 'function') {
      const text = maybeToString.call(error);
      if (typeof text === 'string' && text.trim().length > 0 && text !== '[object Object]') {
        return text;
      }
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return '未知错误';
}

function buildOpenCodeGroups(items: OpenCodeStatusSummary[]): OpenCodeInstanceGroup[] {
  const groups = new Map<string, OpenCodeInstanceGroup>();

  for (const item of items) {
    const key = `${item.workerId}:${item.nodeName}:${item.port}`;
    const existing = groups.get(key);
    if (existing) {
      existing.projectKeys.push(item.projectKey);
      if (existing.status !== 'offline' && item.status === 'offline') {
        existing.status = item.status;
        existing.detail = item.detail;
      }
      existing.canStart = existing.canStart || item.canStart !== false;
      continue;
    }

    groups.set(key, {
      key,
      workerId: item.workerId,
      nodeName: item.nodeName,
      port: item.port,
      status: item.status,
      detail: item.detail,
      canStart: item.canStart !== false,
      projectKeys: [item.projectKey],
      primaryProjectKey: item.projectKey,
    });
  }

  return Array.from(groups.values());
}

interface ProjectManagerNoticeProps {
  desktopMode: boolean;
  message: string;
  detail?: string | null;
  webUrl: string;
  openBlocked: boolean;
  opening: boolean;
  copyState: 'idle' | 'copied' | 'failed';
  onOpen: () => void;
  onCopy: (webUrl: string) => Promise<void>;
}

function ProjectManagerNotice(props: ProjectManagerNoticeProps): JSX.Element {
  const {
    desktopMode,
    message,
    detail,
    webUrl,
    openBlocked,
    opening,
    copyState,
    onOpen,
    onCopy,
  } = props;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
      <div className="flex flex-wrap items-center gap-2 leading-6">
        <span className="font-medium text-slate-800">提示</span>
        <span className="min-w-0 flex-1 break-words text-slate-600">
          {openBlocked
            ? '项目管理页已在后台启动，但当前未自动打开浏览器，请点击下方按钮或复制地址手动打开'
            : message}
          {detail ? <span className="block text-xs text-slate-500">{detail}</span> : null}
        </span>
        <button
          type="button"
          onClick={onOpen}
          disabled={opening}
          className="inline-flex w-fit items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {opening ? '打开中…' : desktopMode ? '手动打开项目管理页' : '在新标签页打开项目管理页'}
        </button>
        {desktopMode && openBlocked ? (
          <button
            type="button"
            onClick={() => void onCopy(webUrl)}
            className="inline-flex w-fit items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            {copyState === 'copied' ? '已复制地址' : copyState === 'failed' ? '复制失败，重试' : '复制地址'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function DashboardPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [healHint, setHealHint] = useState<string | null>(null);
  const [showOpenCodeDetails, setShowOpenCodeDetails] = useState(false);
  const [projectManagerHint, setProjectManagerHint] = useState<string | null>(null);
  const [projectManagerWebUrl, setProjectManagerWebUrl] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage.getItem(PROJECT_MANAGER_WEB_URL_STORAGE_KEY);
  });
  const [projectManagerOpenDetail, setProjectManagerOpenDetail] = useState<string | null>(null);
  const [projectManagerOpenBlocked, setProjectManagerOpenBlocked] = useState(false);
  const [projectManagerCopyState, setProjectManagerCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [projectManagerOpening, setProjectManagerOpening] = useState(false);
  const [projectManagerStarting, setProjectManagerStarting] = useState(false);
  const [openCodeHint, setOpenCodeHint] = useState<string | null>(null);
  const [workerHint, setWorkerHint] = useState<string | null>(null);
  const [openClawHint, setOpenClawHint] = useState<string | null>(null);
  const [startingProjectKey, setStartingProjectKey] = useState<string | null>(null);
  const [startingWorkerId, setStartingWorkerId] = useState<string | null>(null);
  const [openClawStarting, setOpenClawStarting] = useState(false);
  const [restartingWorkerId, setRestartingWorkerId] = useState<string | null>(null);
  const [workerLogsOpen, setWorkerLogsOpen] = useState(false);
  const [workerLogsLoading, setWorkerLogsLoading] = useState(false);
  const [workerLogsError, setWorkerLogsError] = useState<string | null>(null);
  const [workerLogsData, setWorkerLogsData] = useState<WorkerLogsResult | null>(null);
  const [desktopOpenCodeStatus, setDesktopOpenCodeStatus] = useState<DesktopOpenCodeStatus | null>(null);
  const [desktopOpenCodePasswordInput, setDesktopOpenCodePasswordInput] = useState('');
  const [desktopOpenCodePasswordVisible, setDesktopOpenCodePasswordVisible] = useState(false);
  const [desktopOpenCodePasswordRevealing, setDesktopOpenCodePasswordRevealing] = useState(false);
  const [desktopOpenCodePasswordSaveHint, setDesktopOpenCodePasswordSaveHint] = useState<string | null>(null);
  const [desktopOpenCodePasswordSaving, setDesktopOpenCodePasswordSaving] = useState(false);
  const desktopMode = isDesktop();
  const projectManagerOpenLockRef = useRef(false);
  const projectManagerCopyResetTimerRef = useRef<number | null>(null);
  const openCodeDetailsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!desktopMode || desktopOpenCodeStatus !== null) {
      return;
    }

    void checkDesktopOpenCodeStatus()
      .then((status) => {
        setDesktopOpenCodeStatus({ passwordConfigured: status.passwordConfigured });
      })
      .catch(() => {
        setDesktopOpenCodeStatus({ passwordConfigured: false });
      });
  }, [desktopMode, desktopOpenCodeStatus]);

  useEffect(() => {
    return () => {
      if (projectManagerCopyResetTimerRef.current !== null) {
        window.clearTimeout(projectManagerCopyResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (projectManagerWebUrl) {
      window.localStorage.setItem(PROJECT_MANAGER_WEB_URL_STORAGE_KEY, projectManagerWebUrl);
      return;
    }

    window.localStorage.removeItem(PROJECT_MANAGER_WEB_URL_STORAGE_KEY);
  }, [projectManagerWebUrl]);

  const copyProjectManagerUrl = async (webUrl: string): Promise<void> => {
    if (projectManagerCopyResetTimerRef.current !== null) {
      window.clearTimeout(projectManagerCopyResetTimerRef.current);
    }

    try {
      await navigator.clipboard.writeText(webUrl);
      setProjectManagerCopyState('copied');
    } catch {
      setProjectManagerCopyState('failed');
    }

    projectManagerCopyResetTimerRef.current = window.setTimeout(() => {
      setProjectManagerCopyState('idle');
      projectManagerCopyResetTimerRef.current = null;
    }, 1500);
  };

  const handleOpenProjectManager = (): void => {
    if (!projectManagerWebUrl || projectManagerOpenLockRef.current) {
      return;
    }

    projectManagerOpenLockRef.current = true;
    setProjectManagerOpening(true);

    if (desktopMode) {
      void openDesktopUrl(projectManagerWebUrl)
        .then((result) => {
          setProjectManagerOpenBlocked(result.opened === false);
          if (result.detail) {
            setProjectManagerOpenDetail(result.detail);
          }
        })
        .catch((error) => {
          setProjectManagerOpenBlocked(true);
          setProjectManagerOpenDetail(`打开项目管理页失败：${getErrorMessage(error)}`);
        })
        .finally(() => {
          window.setTimeout(() => {
            projectManagerOpenLockRef.current = false;
            setProjectManagerOpening(false);
          }, 500);
        });
      return;
    }

    if (typeof window !== 'undefined') {
      const openedWindow = window.open(projectManagerWebUrl, '_blank', 'noopener,noreferrer');
      setProjectManagerOpenBlocked(openedWindow === null);
    }

    window.setTimeout(() => {
      projectManagerOpenLockRef.current = false;
      setProjectManagerOpening(false);
    }, 500);
  };

  const handleClearProjectManagerState = (): void => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(PROJECT_MANAGER_WEB_URL_STORAGE_KEY);
    }

    setProjectManagerWebUrl(null);
    setProjectManagerOpenDetail(null);
    setProjectManagerOpenBlocked(false);
    setProjectManagerCopyState('idle');
    setProjectManagerHint('已清除项目管理页状态');
  };

  const overviewQuery = useQuery({
    queryKey: ['overview'],
    queryFn: () => apiGet<OverviewData>('/overview'),
  });

  // 一键修复 mutation
  const healMutation = useMutation({
    mutationFn: () => apiPost<any, { dryRun: boolean; confirmExecution: boolean }>('/system/heal', { 
      dryRun: false, 
      confirmExecution: true 
    }),
    onSuccess: (result) => {
      setHealHint(result.summary || '修复操作已完成');
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setHealHint(`修复失败：${message}`);
    },
  });

  const handleQuickHeal = () => {
    setHealHint(null);
    healMutation.mutate();
  };

  useEffect(() => {
    if (!showOpenCodeDetails) {
      return;
    }

    openCodeDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showOpenCodeDetails]);

  const startOpenCodeMutation = useMutation({
    mutationFn: async (projectKey: string) => {
      if (desktopMode) {
        const result = await startDesktopOpenCode();
        return {
          projectKey,
          nodeName: 'local-dev',
          port: result.port,
          started: result.started,
          message: result.message,
          detail: result.detail ?? result.logFile,
        } as OpenCodeStartResult;
      }

      return apiPost<OpenCodeStartResult, { projectKey: string }>('/system/opencode/start', { projectKey });
    },
    onMutate: (projectKey) => {
      setStartingProjectKey(projectKey);
      setOpenCodeHint(null);
    },
    onSuccess: (result) => {
      const summary = result.detail ? `${result.message}（${result.detail}）` : result.message;
      setOpenCodeHint(result.started ? `${result.projectKey}：${summary}` : `启动失败：${summary}`);
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setOpenCodeHint(`启动 OpenCode 失败：${message}`);
    },
    onSettled: () => {
      setStartingProjectKey(null);
    },
  });

  const startWorkerMutation = useMutation({
    mutationFn: (workerId: string) => apiPost<WorkerStartResult, { workerId: string }>('/system/worker/start', { workerId }),
    onMutate: (workerId) => {
      setStartingWorkerId(workerId);
      setWorkerHint(null);
    },
    onSuccess: (result) => {
      const summary = result.detail ? `${result.message}（${result.detail}）` : result.message;
      setWorkerHint(result.started ? `${result.workerId}：${summary}` : `启动失败：${summary}`);
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (error) => {
      setWorkerHint(`启动 Worker 失败：${getErrorMessage(error)}`);
    },
    onSettled: () => {
      setStartingWorkerId(null);
    },
  });

  const restartWorkerMutation = useMutation({
    mutationFn: (workerId: string) => apiPost<WorkerStartResult, { workerId: string }>('/system/worker/restart', { workerId }),
    onMutate: (workerId) => {
      setRestartingWorkerId(workerId);
      setWorkerHint(null);
    },
    onSuccess: (result) => {
      const summary = result.detail ? `${result.message}（${result.detail}）` : result.message;
      setWorkerHint(result.started ? `${result.workerId}：${summary}` : `重启失败：${summary}`);
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (error) => {
      setWorkerHint(`重启 Worker 失败：${getErrorMessage(error)}`);
    },
    onSettled: () => {
      setRestartingWorkerId(null);
    },
  });

  const startOpenClawMutation = useMutation({
    mutationFn: () => apiPost<OpenClawStartResult, Record<string, never>>('/system/openclaw/start', {}),
    onMutate: () => {
      setOpenClawStarting(true);
      setOpenClawHint(null);
    },
    onSuccess: (result) => {
      const summary = result.detail ? `${result.message}（${result.detail}）` : result.message;
      setOpenClawHint(result.started ? summary : `启动失败：${summary}`);
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (error) => {
      setOpenClawHint(`启动 OpenClaw 失败：${getErrorMessage(error)}`);
    },
    onSettled: () => {
      setOpenClawStarting(false);
    },
  });

  const handleOpenWorkerLogs = async (workerId: string): Promise<void> => {
    setWorkerLogsOpen(true);
    setWorkerLogsLoading(true);
    setWorkerLogsError(null);
    setWorkerLogsData(null);

    try {
      const result = await apiGet<WorkerLogsResult>(`/system/worker/logs?workerId=${encodeURIComponent(workerId)}&lines=160`);
      setWorkerLogsData(result);
    } catch (error) {
      setWorkerLogsError(getErrorMessage(error));
    } finally {
      setWorkerLogsLoading(false);
    }
  };

  const handleStartProjectManager = async (): Promise<void> => {
    if (!desktopMode) {
      setProjectManagerHint('当前不是桌面模式，无法本机启动项目管理页。');
      setProjectManagerWebUrl(null);
      setProjectManagerOpenBlocked(false);
      setProjectManagerCopyState('idle');
      return;
    }

    setProjectManagerHint(null);
    setProjectManagerWebUrl(null);
    setProjectManagerOpenDetail(null);
    setProjectManagerOpenBlocked(false);
    setProjectManagerCopyState('idle');
    setProjectManagerStarting(true);
    try {
      const result = await startProjectManager();
      setProjectManagerHint(result.message || '项目管理页已启动');
      setProjectManagerWebUrl(result.webUrl ?? null);
      setProjectManagerOpenDetail(result.openDetail ?? null);
      setProjectManagerOpenBlocked(Boolean(desktopMode && result.opened === false));
    } catch (error) {
      const message = getErrorMessage(error).split('\n').find((line) => line.trim().length > 0) ?? '未知错误';
      setProjectManagerHint(`启动项目管理页失败：${message}`);
      setProjectManagerWebUrl(null);
      setProjectManagerOpenDetail(null);
      setProjectManagerOpenBlocked(false);
    } finally {
      setProjectManagerStarting(false);
    }
  };

  const data = overviewQuery.data;
  const openCodeGroups = data ? buildOpenCodeGroups(data.openCode) : [];
  const openCodeOnlineCount = openCodeGroups.filter((item) => item.status === 'online').length;
  const openCodeInstanceCount = openCodeGroups.length;
  const openCodeProjectCount = data?.openCode.length ?? 0;
  const openCodeHasInstances = openCodeInstanceCount > 0;
  const showProjectManagerStartButton = desktopMode && !projectManagerWebUrl && (desktopOpenCodeStatus?.passwordConfigured ?? false);
  const desktopOpenCodePasswordMissing = desktopMode && desktopOpenCodeStatus?.passwordConfigured === false;
  const desktopOpenCodePasswordChecking = desktopMode && desktopOpenCodeStatus === null;
  const desktopOpenCodeCanStart = !desktopMode || (desktopOpenCodeStatus?.passwordConfigured ?? false);
  const projectManagerButtonLabel = '启动项目管理页';
  const projectManagerSuccessMessage = '项目管理页已启动';

  const generateDesktopOpenCodePassword = (): void => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=';
    const length = 24;
    const values = new Uint32Array(length);

    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(values);
    } else {
      for (let index = 0; index < values.length; index += 1) {
        values[index] = Math.floor(Math.random() * chars.length);
      }
    }

    const password = Array.from(values, (value) => chars[value % chars.length]).join('');
    setDesktopOpenCodePasswordSaveHint(null);
    setDesktopOpenCodePasswordInput(password);
    setDesktopOpenCodePasswordVisible(true);
  };

  const handleToggleDesktopOpenCodePasswordVisible = async (): Promise<void> => {
    if (desktopOpenCodePasswordVisible) {
      setDesktopOpenCodePasswordVisible(false);
      return;
    }

    if (desktopOpenCodePasswordInput.trim().length > 0) {
      setDesktopOpenCodePasswordVisible(true);
      return;
    }

    if (!desktopOpenCodeStatus?.passwordConfigured) {
      setDesktopOpenCodePasswordVisible(true);
      return;
    }

    setDesktopOpenCodePasswordRevealing(true);
    setDesktopOpenCodePasswordSaveHint(null);
    try {
      const result = await revealDesktopOpenCodePassword();
      setDesktopOpenCodePasswordInput(result.password);
      setDesktopOpenCodePasswordVisible(true);
      setDesktopOpenCodePasswordSaveHint(`${result.message}（${result.configPath}）`);
    } catch (error) {
      const message = getErrorMessage(error);
      setDesktopOpenCodePasswordSaveHint(`读取密码失败：${message}`);
    } finally {
      setDesktopOpenCodePasswordRevealing(false);
    }
  };

  const handleSaveDesktopOpenCodePassword = async (): Promise<void> => {
    if (!desktopOpenCodePasswordInput.trim()) {
      setDesktopOpenCodePasswordSaveHint('请先输入 OpenCode 密码');
      return;
    }

    setDesktopOpenCodePasswordSaving(true);
    setDesktopOpenCodePasswordSaveHint(null);
    try {
      const result = await saveDesktopOpenCodePassword(desktopOpenCodePasswordInput);
      setDesktopOpenCodeStatus({ passwordConfigured: result.passwordConfigured });
      setDesktopOpenCodePasswordSaveHint(`${result.message}（${result.configPath}）`);
    } catch (error) {
      const message = getErrorMessage(error);
      setDesktopOpenCodePasswordSaveHint(`保存失败：${message}`);
    } finally {
      setDesktopOpenCodePasswordSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      {/* 顶部标题和快速操作 */}
      <PageHeader
        title="控制台"
        description={`${data?.profile.name ?? '-'} · ${data?.profile.topology ?? '-'}`}
        actions={
          <>
          <Link to="/setup" className={secondaryButtonClassName}>
            快速配置
          </Link>
          <Link to="/projects" className={secondaryButtonClassName}>
            项目管理
          </Link>
          {showProjectManagerStartButton ? (
            <button
              type="button"
              onClick={() => void handleStartProjectManager()}
              disabled={projectManagerStarting}
              className={`${secondaryButtonClassName} border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100`.trim()}
            >
              {projectManagerStarting ? '启动中…' : projectManagerButtonLabel}
            </button>
          ) : null}
          {desktopOpenCodePasswordMissing ? (
            <WarningNotice
              compact
              title="OpenCode 未配置"
              message="当前没有可用的 OpenCode 密码，请在下方明细里的行内输入框保存本机密码。保存后即可直接启动。"
            />
          ) : null}
          {desktopOpenCodePasswordSaveHint ? <InfoNotice compact title="密码配置" message={desktopOpenCodePasswordSaveHint} /> : null}
          <Link to="/config" className={secondaryButtonClassName}>
            配置
          </Link>
          {projectManagerWebUrl ? (
            <button
              type="button"
              onClick={handleClearProjectManagerState}
              className={secondaryButtonClassName}
            >
              清除项目管理页状态
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => overviewQuery.refetch()}
            className={primaryButtonClassName}
            disabled={overviewQuery.isFetching}
          >
            {overviewQuery.isFetching ? '刷新中…' : '刷新'}
          </button>
          </>
        }
      />

      {overviewQuery.isLoading ? <InfoNotice message="正在加载数据…" /> : null}
      {overviewQuery.error ? (
        <ErrorNotice message={getErrorMessage(overviewQuery.error)} />
      ) : null}

      <Modal isOpen={workerLogsOpen} onClose={() => setWorkerLogsOpen(false)} title="Worker 日志" size="xl">
        <div className="space-y-3">
          {workerLogsLoading ? <InfoNotice compact message="正在读取 Worker 日志…" /> : null}
          {workerLogsError ? <ErrorNotice compact message={workerLogsError} /> : null}
          {workerLogsData ? (
            <>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 break-all leading-5">
                {workerLogsData.logFile}
              </div>
              <CodeBlock>{workerLogsData.lines.length > 0 ? workerLogsData.lines.join('\n') : '暂无日志'}</CodeBlock>
            </>
          ) : null}
        </div>
      </Modal>

      {/* 修复操作提示 */}
      {healHint ? (
        healHint.includes('失败') ? (
          <ErrorNotice message={healHint} />
        ) : (
          <InfoNotice message={healHint} />
        )
      ) : null}

      {projectManagerHint ? (
        projectManagerHint.includes('失败') ? (
          <ErrorNotice message={projectManagerHint} />
        ) : projectManagerWebUrl ? (
          <ProjectManagerNotice
            desktopMode={desktopMode}
            message={projectManagerSuccessMessage}
            detail={projectManagerOpenDetail}
            webUrl={projectManagerWebUrl}
            openBlocked={projectManagerOpenBlocked}
            opening={projectManagerOpening}
            copyState={projectManagerCopyState}
            onOpen={handleOpenProjectManager}
            onCopy={copyProjectManagerUrl}
          />
        ) : (
          <InfoNotice message={projectManagerHint} />
        )
      ) : null}

      {openCodeHint ? (
        openCodeHint.includes('失败') ? (
          <ErrorNotice message={openCodeHint} />
        ) : (
          <InfoNotice message={openCodeHint} />
        )
      ) : null}

      {workerHint ? (
        workerHint.includes('失败') ? (
          <ErrorNotice message={workerHint} />
        ) : (
          <InfoNotice message={workerHint} />
        )
      ) : null}

      {openClawHint ? (
        openClawHint.includes('失败') ? (
          <ErrorNotice message={openClawHint} />
        ) : (
          <InfoNotice message={openClawHint} />
        )
      ) : null}

      {/* 加载骨架屏 */}
      {overviewQuery.isLoading ? <DashboardSkeleton /> : null}

      {/* 数据加载完成后显示内容 */}
      {data ? (
        <div className="space-y-4">
          {/* manifest 路径提示 */}
          {!isNonEmptyString(data.manifestPath) ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="font-medium text-amber-900">尚未配置 manifest 路径</div>
                  <div className="mt-1 text-sm text-amber-800">
                    先去快速配置页初始化，或去配置页保存 manifest 路径。
                  </div>
                </div>
                <Link
                  to="/setup"
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500"
                >
                  快速配置
                </Link>
              </div>
            </div>
          ) : null}

          {/* OpenCode 服务离线提示 */}
          {openCodeHasInstances && openCodeOnlineCount === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="warning" className="shrink-0 text-xs">
                  离线
                </Badge>
                <div className="min-w-0 flex-1 text-sm text-amber-900">
                  {desktopMode
                    ? 'OpenCode 实例当前未启动，可在下方明细中点击「一键启动」启动对应端口的服务；共享模式下启动一次即可影响同端口下的所有项目。'
                    : 'OpenCode 实例当前未启动，请先在对应项目目录手动启动服务，然后刷新页面。'}
                </div>
              </div>
            </div>
          ) : null}

          {/* 服务状态卡片（使用 StatusCards 组件） */}
          <StatusCards
            data={data}
            desktopMode={desktopMode}
            openClawStarting={openClawStarting}
            onStartClaudeCode={() => void startProjectManager()}
            showOpenCodeDetails={showOpenCodeDetails}
            onToggleOpenCodeDetails={() => setShowOpenCodeDetails((value) => !value)}
            openCodeOnlineCount={openCodeOnlineCount}
            openCodeInstanceCount={openCodeInstanceCount}
            openCodeHasInstances={openCodeHasInstances}
            openCodeProjectCount={openCodeProjectCount}
          />

          {/* Workers 详细列表 */}
          {data.workers.items.length > 0 ? (
            <WorkersList
              workers={data.workers.items}
              startingWorkerId={startingWorkerId}
              restartingWorkerId={restartingWorkerId}
              startWorkerMutation={startWorkerMutation}
              restartWorkerMutation={restartWorkerMutation}
              onOpenLogs={handleOpenWorkerLogs}
            />
          ) : null}

          {/* OpenCode 服务明细 */}
          {showOpenCodeDetails && openCodeHasInstances ? (
            <Card compact title="OpenCode 明细">
              <div ref={openCodeDetailsRef} className="scroll-mt-24">
                <div className="mb-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 shadow-sm leading-5">
                  已展开明细。向下查看每个实例的状态和启动操作，同端口的关联项目会合并显示。
                </div>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full table-fixed text-left text-sm leading-5">
                  <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-100">
                      <th className="w-36 py-1.5 pr-3 font-medium">Worker</th>
                      <th className="w-48 py-1.5 pr-3 font-medium">关联项目</th>
                      <th className="w-16 py-1.5 pr-3 font-medium">端口</th>
                      <th className="w-16 py-1.5 pr-3 font-medium">状态</th>
                      <th className="py-1.5 pr-3 font-medium">详情</th>
                      <th className="w-80 py-1.5 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {openCodeGroups.map((group) => (
                      <tr key={group.key}>
                        <td className="py-1.5 pr-3 font-mono text-xs text-slate-800 truncate">{group.workerId}</td>
                        <td className="py-1.5 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {group.projectKeys.map((projectKey) => (
                              <span
                                key={projectKey}
                                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-700"
                              >
                                {projectKey}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-1.5 pr-3 text-slate-700 truncate">{group.port}</td>
                        <td className="py-1.5 pr-3">
                          <Badge
                            tone={
                              group.status === 'online'
                                ? 'success'
                                : group.status === 'offline'
                                  ? 'failed'
                                  : 'neutral'
                            }
                          >
                            {group.status}
                          </Badge>
                        </td>
                        <td className="py-1.5 pr-3 text-slate-700 truncate" title={group.detail}>{group.detail}</td>
                        <td className="py-1.5">
                          {group.status !== 'online' && group.canStart ? (
                            desktopOpenCodePasswordChecking ? (
                              <button
                                type="button"
                                disabled
                                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                检测中…
                              </button>
                            ) : desktopMode ? (
                              <div className="w-80 max-w-full space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type={desktopOpenCodePasswordVisible ? 'text' : 'password'}
                                    value={desktopOpenCodePasswordInput}
                                    onChange={(e) => {
                                      setDesktopOpenCodePasswordSaveHint(null);
                                      setDesktopOpenCodePasswordInput(e.target.value);
                                    }}
                                    className="min-w-0 flex-1 rounded-lg border border-sky-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-sky-400 focus:outline-none"
                                    placeholder={desktopOpenCodeStatus?.passwordConfigured ? '输入新密码可覆盖' : '输入或生成密码'}
                                    autoComplete="new-password"
                                  />
                                  <button
                                    type="button"
                                    disabled={desktopOpenCodePasswordRevealing}
                                    onClick={() => void handleToggleDesktopOpenCodePasswordVisible()}
                                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    aria-label={desktopOpenCodePasswordVisible ? '隐藏密码' : '查看密码'}
                                  >
                                    {desktopOpenCodePasswordRevealing
                                      ? '读取中…'
                                      : desktopOpenCodePasswordVisible
                                        ? '隐藏'
                                        : '查看'}
                                  </button>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={generateDesktopOpenCodePassword}
                                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    生成密码
                                  </button>
                                  <button
                                    type="button"
                                    disabled={desktopOpenCodePasswordSaving || desktopOpenCodePasswordInput.trim().length === 0}
                                    onClick={() => void handleSaveDesktopOpenCodePassword()}
                                    className="flex-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {desktopOpenCodePasswordSaving
                                      ? '保存中…'
                                      : desktopOpenCodeStatus?.passwordConfigured
                                        ? '更新密码'
                                        : '保存密码'}
                                  </button>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={
                                      startingProjectKey === group.primaryProjectKey ||
                                      startOpenCodeMutation.isPending ||
                                      !desktopOpenCodeCanStart
                                    }
                                    onClick={() => startOpenCodeMutation.mutate(group.primaryProjectKey)}
                                    className="flex-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {startingProjectKey === group.primaryProjectKey
                                      ? '启动中…'
                                      : desktopOpenCodeCanStart
                                        ? '一键启动'
                                        : '保存后启动'}
                                  </button>
                                </div>
                                <div className="text-[11px] leading-4 text-slate-500">
                                  {desktopOpenCodeStatus?.passwordConfigured
                                    ? '密码已保存，可继续查看当前输入或覆盖重置'
                                    : '保存后即可启动本机 OpenCode'}
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={
                                  startingProjectKey === group.primaryProjectKey ||
                                  startOpenCodeMutation.isPending ||
                                  !desktopOpenCodeCanStart
                                }
                                onClick={() => startOpenCodeMutation.mutate(group.primaryProjectKey)}
                                className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {startingProjectKey === group.primaryProjectKey
                                  ? '启动中…'
                                  : !desktopOpenCodeCanStart
                                    ? '未配置密码'
                                    : '一键启动'}
                              </button>
                            )
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {desktopOpenCodePasswordSaveHint ? <InfoNotice compact title="密码配置" message={desktopOpenCodePasswordSaveHint} /> : null}

          {/* 最近任务 */}
          <RecentTasks tasks={data.recentTasks} />
        </div>
      ) : null}
    </section>
  );
}
