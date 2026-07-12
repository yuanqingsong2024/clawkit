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

          {/* 服务状态卡片（紧凑概览） */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
            {/* Controller */}
            <Card compact title="Controller" className="h-full">
              <div className="flex h-full flex-col space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-600">调度中心</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">任务派发与状态聚合</div>
                  </div>
                  <Badge tone={toneForSystemStatus(data.controller.status)} className="shrink-0 text-sm">
                    {data.controller.status}
                  </Badge>
                </div>
                {isNonEmptyString(data.controller.publicUrl) ? (
                  <div className="mt-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 break-all leading-5">
                    {data.controller.publicUrl}
                  </div>
                ) : null}
              </div>
            </Card>

            {/* Workers */}
            <Card compact title="Workers" className="h-full">
              <div className="flex h-full flex-col space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-600">执行节点</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">在线 / 总数</div>
                  </div>
                  <div className="text-2xl font-semibold tabular-nums text-slate-900">{data.workers.online}/{data.workers.total}</div>
                </div>
                <div className="mt-auto grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-2 text-center">
                    <div className="text-[11px] text-emerald-700">空闲</div>
                    <div className="mt-0.5 text-sm font-semibold text-emerald-900">{data.workers.idle}</div>
                  </div>
                  <div className="rounded-lg border border-sky-100 bg-sky-50 px-2.5 py-2 text-center">
                    <div className="text-[11px] text-sky-700">忙碌</div>
                    <div className="mt-0.5 text-sm font-semibold text-sky-900">{data.workers.busy}</div>
                  </div>
                  <div className="rounded-lg border border-rose-100 bg-rose-50 px-2.5 py-2 text-center">
                    <div className="text-[11px] text-rose-700">离线</div>
                    <div className="mt-0.5 text-sm font-semibold text-rose-900">{data.workers.offline}</div>
                  </div>
                </div>
                {data.workers.offline > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 leading-5">
                    检测到离线 Worker，可在下方列表中直接点击“一键启动”。
                  </div>
                ) : null}
              </div>
            </Card>

            {/* OpenClaw */}
            <Card compact title="OpenClaw" className="h-full">
              <div className="flex h-full flex-col space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-600">Webhook 接入</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">OpenClaw 通道状态</div>
                  </div>
                  <Badge tone={toneForServiceStatus(data.openClaw.serviceStatus)} className="shrink-0 text-sm">
                    {labelForServiceStatus(data.openClaw.serviceStatus)}
                  </Badge>
                </div>
                <div className="mt-auto grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                    <div className="text-[11px] text-slate-500">配置</div>
                    <div className="mt-0.5 font-medium text-slate-800">{data.openClaw.configured ? '已配置' : '未配置'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                    <div className="text-[11px] text-slate-500">Token</div>
                    <div className="mt-0.5 font-medium text-slate-800">{data.openClaw.tokenConfigured ? '已设置' : '未设置'}</div>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 leading-5">
                  {data.openClaw.localDetected
                    ? '已识别到本机 OpenClaw 服务，即使 manifest 尚未配置也会显示在线状态。'
                    : data.openClaw.healthCheckDetail}
                </div>
                {data.openClaw.serviceStatus !== 'online' && data.openClaw.canStart ? (
                  <button
                    type="button"
                    disabled={openClawStarting || startOpenClawMutation.isPending}
                    onClick={() => startOpenClawMutation.mutate()}
                    className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {openClawStarting ? '启动中…' : '一键启动 OpenClaw'}
                  </button>
                ) : null}
              </div>
            </Card>

            {/* OpenCode */}
            <Card compact title="OpenCode 总览" className="h-full">
              <div className={`flex h-full flex-col ${showOpenCodeDetails ? 'space-y-2' : 'space-y-3'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-600">代码执行服务实例</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {showOpenCodeDetails ? '明细已展开，继续向下查看' : '运行中的 OpenCode 节点'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-semibold tabular-nums text-slate-900">
                      {openCodeOnlineCount}/{openCodeInstanceCount}
                    </div>
                    {openCodeHasInstances ? (
                      <button
                        type="button"
                        onClick={() => setShowOpenCodeDetails((value) => !value)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
                      >
                        {showOpenCodeDetails ? '收起总览' : '查看明细'}
                      </button>
                    ) : null}
                  </div>
                </div>

                {!showOpenCodeDetails && openCodeHasInstances ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                        <div className="text-[11px] text-slate-500">实例</div>
                        <div className="mt-0.5 font-medium text-slate-800">{openCodeInstanceCount} 个</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                        <div className="text-[11px] text-slate-500">项目</div>
                        <div className="mt-0.5 font-medium text-slate-800">{openCodeProjectCount} 个</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={openCodeOnlineCount > 0 ? 'success' : 'failed'} className="text-xs">
                        {openCodeInstanceCount > 0 ? `${openCodeOnlineCount} 在线 / ${openCodeInstanceCount} 实例` : '无实例'}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {desktopMode
                          ? '点击“查看明细”展开每个项目对应的节点，同端口关联项目会合并显示。'
                          : '点击“查看明细”展开每个项目对应的节点。'}
                      </span>
                    </div>
                  </>
                ) : null}

                {showOpenCodeDetails && openCodeHasInstances ? (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 leading-5">
                    已折叠总览，只保留状态摘要。明细区已自动定位到页面下方，可直接查看每个实例的运行状态和启动操作。
                  </div>
                ) : null}

                {!showOpenCodeDetails && openCodeHasInstances ? (
                  <div className="mt-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 leading-5">
                    {openCodeOnlineCount > 0
                      ? desktopMode
                        ? '默认只展示总览。点击“查看明细”可展开每个项目对应的 OpenCode 节点，同端口的关联项目会合并显示。'
                        : '默认只展示总览。点击“查看明细”可展开每个项目对应的 OpenCode 节点。'
                      : desktopMode
                        ? '所有 OpenCode 节点都处于离线状态。请先确认 OPENCODE_SERVER_PASSWORD 已配置，再使用明细里的启动按钮。'
                        : '所有 OpenCode 节点都处于离线状态。请先在对应项目目录启动 OpenCode，再刷新此页面。'}
                  </div>
                ) : null}
              </div>
            </Card>
          </div>

          {/* Workers 详细列表 */}
          {data.workers.items.length > 0 ? (
            <Card compact title="Workers 列表">
              <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 leading-5">
                这里展示 Worker 在线状态、最近心跳和当前任务。
              </div>
              <div className="overflow-auto">
                <table className="min-w-full table-fixed text-left text-sm leading-5">
                  <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-100">
                      <th className="w-40 py-1.5 pr-3 font-medium">ID</th>
                      <th className="w-32 py-1.5 pr-3 font-medium">名称</th>
                      <th className="w-22 py-1.5 pr-3 font-medium">状态</th>
                      <th className="w-36 py-1.5 pr-3 font-medium">最后心跳</th>
                      <th className="py-1.5 font-medium">当前任务</th>
                      <th className="w-32 py-1.5 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.workers.items.map((worker) => (
                      <tr key={worker.workerId}>
                        <td className="py-1.5 pr-3 font-mono text-xs text-slate-800 truncate">{worker.workerId}</td>
                        <td className="py-1.5 pr-3 text-slate-800 truncate">{worker.name}</td>
                        <td className="py-1.5 pr-3">
                          <Badge tone={toneForWorkerStatus(worker.status)}>{worker.status}</Badge>
                        </td>
                        <td className="py-1.5 pr-3 text-slate-700">{formatDateTime(worker.lastHeartbeatAt)}</td>
                        <td className="py-1.5">
                          {worker.currentTaskId ? (
                            <Link className="text-sky-700 hover:underline" to={`/tasks/${worker.currentTaskId}`}>
                              {worker.currentTaskId}
                            </Link>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="py-1.5">
                          {worker.status === 'offline' ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                disabled={startingWorkerId === worker.workerId || startWorkerMutation.isPending}
                                onClick={() => startWorkerMutation.mutate(worker.workerId)}
                                className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {startingWorkerId === worker.workerId ? '启动中…' : '一键启动'}
                              </button>
                              <button
                                type="button"
                                disabled={restartingWorkerId === worker.workerId || restartWorkerMutation.isPending}
                                onClick={() => restartWorkerMutation.mutate(worker.workerId)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {restartingWorkerId === worker.workerId ? '重启中…' : '重启'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleOpenWorkerLogs(worker.workerId)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                查看日志
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handleOpenWorkerLogs(worker.workerId)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                查看日志
                              </button>
                              <span className="text-xs text-slate-400">-</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
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
          <Card
            title="最近任务"
            actions={
              <Link
                to="/tasks"
                className="text-sm text-sky-700 hover:underline"
              >
                查看全部
              </Link>
            }
          >
            <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 leading-5">
              最近任务摘要，点击任务 ID 可查看详情。
            </div>
            <div className="overflow-auto">
                <table className="min-w-full table-fixed text-left text-sm leading-5">
                  <thead className="text-xs text-slate-500">
                    <tr className="border-b border-slate-100">
                      <th className="w-32 py-1.5 pr-2 font-medium">任务 ID</th>
                      <th className="w-32 py-1.5 pr-2 font-medium">项目</th>
                      <th className="py-1.5 pr-2 font-medium">意图</th>
                      <th className="w-20 py-1.5 pr-2 font-medium">状态</th>
                      <th className="w-28 py-1.5 font-medium">更新时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recentTasks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-2.5">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 leading-5">
                            暂无最近任务
                          </div>
                        </td>
                      </tr>
                    ) : (
                      data.recentTasks.map((task) => (
                        <tr key={task.taskId}>
                          <td className="py-2 pr-2 font-mono text-xs truncate">
                            <Link className="text-sky-700 hover:underline" to={`/tasks/${task.taskId}`}>
                              {task.taskId}
                            </Link>
                          </td>
                          <td className="py-2 pr-2 font-mono text-xs text-slate-800 truncate">{task.projectKey}</td>
                          <td className="py-2 pr-2 text-slate-800 truncate" title={task.intent}>{task.intent}</td>
                          <td className="py-2 pr-2">
                            <Badge tone="neutral">{task.status}</Badge>
                          </td>
                          <td className="py-2 text-slate-700 truncate">{formatDateTime(task.updatedAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
