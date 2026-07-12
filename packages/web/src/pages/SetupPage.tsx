import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorNotice, InfoNotice, WarningNotice } from '../components/ui/Notice';
import { inputClassName, primaryButtonClassName, secondaryButtonClassName } from '../components/ui/styles';
import { ApiError, apiGet, apiPost, apiPut } from '../lib/api';
import {
  checkOpenCodeStatus as checkDesktopOpenCodeStatus,
  isDesktop,
  saveOpenCodePassword as saveDesktopOpenCodePassword,
  readOpenCodeLogs as readDesktopOpenCodeLogs,
  startOpenCode as startDesktopOpenCode,
} from '../lib/desktop';

interface OpenCodeInstance {
  workerId: string;
  projectKey: string;
  nodeName: string;
  port: number;
  status: 'online' | 'offline' | 'unknown' | string;
  detail: string;
  canStart?: boolean;
}

interface SetupStatus {
  manifestConfigured: boolean;
  openClawConfigured: boolean;
  openClawTokenConfigured: boolean;
  workersOnline: number;
  openCodeOnline: number;
  openCodeTotal: number;
  openCodeInstances: OpenCodeInstance[];
}

interface ManifestDocument {
  manifestPath: string;
  yamlText: string;
  savedAt: string;
  runtimeNotice: string;
}

interface ControllerConfigDocument {
  manifestPath: string | null;
  source: 'file' | 'env' | 'unset';
  configPath: string;
}

interface OpenCodeStartResult {
  projectKey: string;
  nodeName: string;
  port: number;
  started: boolean;
  message: string;
  detail?: string;
  logFile?: string;
}

interface OpenCodeFailureView {
  title: string;
  reason: string;
  suggestion: string;
}

interface OpenCodeLogsResult {
  projectKey: string;
  logFile: string;
  lines: string[];
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
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return '未知错误';
}

function buildOpenCodeFailureView(message: string): OpenCodeFailureView {
  if (message.includes('未找到项目') && message.includes('OpenCode 配置')) {
    return {
      title: '配置缺失',
      reason: message,
      suggestion: '请先在 manifest 中为该项目补齐 openCode 配置。',
    };
  }

  if (message.includes('位于远程节点')) {
    return {
      title: '远程项目',
      reason: message,
      suggestion: '当前只支持本机节点直接启动 OpenCode，请切到 local 节点。',
    };
  }

  if (message.includes('项目目录不存在')) {
    return {
      title: '目录不存在',
      reason: message,
      suggestion: '请检查项目路径是否正确，并确认目录存在且可访问。',
    };
  }

  if (message.includes('未找到 scripts/start-opencode.sh')) {
    return {
      title: '启动脚本缺失',
      reason: message,
      suggestion: '请确认仓库根目录下存在 `scripts/start-opencode.sh`。',
    };
  }

  if (message.includes('OpenCode 启动失败')) {
    return {
      title: '启动失败',
      reason: message,
      suggestion: '请先查看日志，再确认 OpenCode 可执行文件、端口和目录权限。',
    };
  }

  return {
    title: '启动失败',
    reason: message,
    suggestion: '请查看日志并重新尝试启动。',
  };
}

export function SetupPage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const desktopMode = isDesktop();

  // 状态检查
  const statusQuery = useQuery({
    queryKey: ['setup-status'],
    queryFn: async () => {
      const overview = await apiGet<any>('/overview');
      return {
        manifestConfigured: Boolean(overview.manifestPath),
        openClawConfigured: overview.openClaw?.configured ?? false,
        openClawTokenConfigured: overview.openClaw?.tokenConfigured ?? false,
        workersOnline: overview.workers?.online ?? 0,
        openCodeOnline: overview.openCode?.filter((c: any) => c.status === 'online').length ?? 0,
        openCodeTotal: overview.openCode?.length ?? 0,
        openCodeInstances: (overview.openCode ?? []) as OpenCodeInstance[],
      } as SetupStatus;
    },
    refetchInterval: 5000,
  });

  const controllerConfigQuery = useQuery({
    queryKey: ['controller-config'],
    queryFn: () => apiGet<ControllerConfigDocument>('/controller-config'),
  });

  const manifestQuery = useQuery({
    queryKey: ['manifest'],
    queryFn: () => apiGet<ManifestDocument>('/manifest'),
    enabled: Boolean(controllerConfigQuery.data?.manifestPath),
  });

  // 表单状态
  const [manifestPath, setManifestPath] = useState('');
  const [openClawUrl, setOpenClawUrl] = useState('http://127.0.0.1:18000');
  const [webhookToken, setWebhookToken] = useState('');
  const [showWebhookToken, setShowWebhookToken] = useState(false);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [showOpenCodeDetails, setShowOpenCodeDetails] = useState(false);
  const [startingProjectKey, setStartingProjectKey] = useState<string | null>(null);
  const [highlightProjectKey, setHighlightProjectKey] = useState<string | null>(null);
  const [startErrorByProject, setStartErrorByProject] = useState<Record<string, OpenCodeFailureView>>({});
  const [expandedErrorByProject, setExpandedErrorByProject] = useState<Record<string, boolean>>({});
  const [loadingLogsProjectKey, setLoadingLogsProjectKey] = useState<string | null>(null);
  const [logsByProject, setLogsByProject] = useState<Record<string, OpenCodeLogsResult>>({});
  const [logsErrorByProject, setLogsErrorByProject] = useState<Record<string, string>>({});
  const [showLogsByProject, setShowLogsByProject] = useState<Record<string, boolean>>({});
  const [opencodeActionsState, setOpencodeActionsState] = useState<'loading' | 'ready' | 'unsupported' | 'unreachable'>('loading');
  const [desktopOpenCodePasswordConfigured, setDesktopOpenCodePasswordConfigured] = useState<boolean | null>(null);
  const [desktopOpenCodePasswordInput, setDesktopOpenCodePasswordInput] = useState('');
  const [desktopOpenCodePasswordSaving, setDesktopOpenCodePasswordSaving] = useState(false);
  const [desktopOpenCodePasswordHint, setDesktopOpenCodePasswordHint] = useState<string | null>(null);

  const copyToClipboard = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setSaveHint('失败详情已复制到剪贴板');
    } catch (error) {
      const message = getErrorMessage(error);
      setSaveHint(`复制失败：${message}`);
    }
  };

  const waitForOpenCodeOnline = async (projectKey: string): Promise<void> => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const overview = await apiGet<any>('/overview');
      const instance = (overview.openCode ?? []).find((item: any) => item.projectKey === projectKey);
      if (instance?.status === 'online') {
        return;
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, 2500);
      });
    }
  };

  const handleSaveDesktopOpenCodePassword = async (): Promise<void> => {
    if (!desktopOpenCodePasswordInput.trim()) {
      setDesktopOpenCodePasswordHint('请先输入 OpenCode 密码');
      return;
    }

    setDesktopOpenCodePasswordSaving(true);
    setDesktopOpenCodePasswordHint(null);
    try {
      const result = await saveDesktopOpenCodePassword(desktopOpenCodePasswordInput);
      setDesktopOpenCodePasswordConfigured(result.passwordConfigured);
      setDesktopOpenCodePasswordInput('');
      setDesktopOpenCodePasswordHint(`${result.message}（${result.configPath}）`);
      setSaveHint('OpenCode 密码已保存，可以继续启动');
    } catch (error) {
      const message = getErrorMessage(error);
      setDesktopOpenCodePasswordHint(`保存失败：${message}`);
    } finally {
      setDesktopOpenCodePasswordSaving(false);
    }
  };

  const detectOpenCodeActions = async (): Promise<void> => {
    if (desktopMode) {
      try {
        const status = await checkDesktopOpenCodeStatus();
        setDesktopOpenCodePasswordConfigured(status.passwordConfigured);
        setOpencodeActionsState('ready');
      } catch {
        setDesktopOpenCodePasswordConfigured(false);
        setOpencodeActionsState('unreachable');
      }
      return;
    }

    try {
      await apiGet<{ service: string; stage: string; timestamp: string }>('/health');
      try {
        const capabilities = await apiGet<{ openCodeActionsEnabled: boolean }>('/system/capabilities');
        setOpencodeActionsState(capabilities.openCodeActionsEnabled ? 'ready' : 'unsupported');
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 404) {
          setOpencodeActionsState('unsupported');
          return;
        }
        setOpencodeActionsState('unreachable');
      }
    } catch {
      setOpencodeActionsState('unreachable');
    }
  };

  useEffect(() => {
    void detectOpenCodeActions();
  }, []);

  const desktopOpenCodeActionsEnabled = desktopMode ? desktopOpenCodePasswordConfigured === true : opencodeActionsState === 'ready';
  const desktopOpenCodeStatusLabel = desktopMode
    ? desktopOpenCodePasswordConfigured === true
      ? '密码已配置'
      : desktopOpenCodePasswordConfigured === false
        ? '未配置密码'
        : '检测中…'
    : opencodeActionsState === 'ready'
      ? '一键启动已启用'
      : opencodeActionsState === 'unsupported'
        ? 'controller 版本偏旧'
        : opencodeActionsState === 'unreachable'
          ? 'controller 不可达'
          : '检测中…';

  // 生成随机 token
  const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setWebhookToken(token);
  };

  // 保存 manifest 路径
  const pathMutation = useMutation({
    mutationFn: (input: { manifestPath: string }) =>
      apiPut<ControllerConfigDocument, { manifestPath: string }>('/controller-config', input),
    onSuccess: () => {
      setSaveHint('manifest 路径保存成功');
      void queryClient.invalidateQueries({ queryKey: ['controller-config'] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
      void queryClient.invalidateQueries({ queryKey: ['setup-status'] });
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setSaveHint(`保存失败：${message}`);
    },
  });

  // 保存 OpenClaw 配置
  const openClawMutation = useMutation({
    mutationFn: async (input: { url: string; token: string }) => {
      // 读取当前 manifest
      const manifest = await apiGet<ManifestDocument>('/manifest');
      const yamlLines = manifest.yamlText.split('\n');
      
      // 更新 OpenClaw 配置
      let inOpenClawSection = false;
      let updatedYaml = '';
      let openClawSectionFound = false;
      
      for (let i = 0; i < yamlLines.length; i++) {
        const line = yamlLines[i];
        
        if (line.trim().startsWith('openClaw:')) {
          inOpenClawSection = true;
          openClawSectionFound = true;
          updatedYaml += line + '\n';
          continue;
        }
        
        if (inOpenClawSection) {
          // 检查是否离开 openClaw 区块
          if (line.match(/^[a-zA-Z]/) && !line.startsWith(' ') && !line.startsWith('\t')) {
            inOpenClawSection = false;
          }
          
          if (inOpenClawSection) {
            if (line.trim().startsWith('url:')) {
              updatedYaml += `  url: ${input.url}\n`;
              continue;
            }
            if (line.trim().startsWith('webhookToken:')) {
              updatedYaml += `  webhookToken: ${input.token}\n`;
              continue;
            }
          }
        }
        
        updatedYaml += line + '\n';
      }
      
      // 如果没有找到 openClaw 区块，添加一个
      if (!openClawSectionFound) {
        updatedYaml += `\nopenClaw:\n  url: ${input.url}\n  webhookToken: ${input.token}\n`;
      }
      
      // 保存更新后的 manifest
      return apiPut<ManifestDocument, { yamlText: string }>('/manifest', { yamlText: updatedYaml });
    },
    onSuccess: () => {
      setSaveHint('OpenClaw 配置保存成功，请重启 controller 和 worker 使配置生效');
      void queryClient.invalidateQueries({ queryKey: ['manifest'] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
      void queryClient.invalidateQueries({ queryKey: ['setup-status'] });
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setSaveHint(`保存失败：${message}`);
    },
  });

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
          logFile: result.logFile,
        } as OpenCodeStartResult;
      }

      return apiPost<OpenCodeStartResult, { projectKey: string }>('/system/opencode/start', { projectKey });
    },
    onMutate: (projectKey) => {
      setStartingProjectKey(projectKey);
      setSaveHint(null);
      setStartErrorByProject((prev) => {
        const next = { ...prev };
        delete next[projectKey];
        return next;
      });
      setExpandedErrorByProject((prev) => {
        const next = { ...prev };
        delete next[projectKey];
        return next;
      });
    },
    onSuccess: (result) => {
      const summary = result.detail ? `${result.message}（${result.detail}）` : result.message;
      if (result.started) {
        setSaveHint(`${result.projectKey}：${summary}`);
      } else {
        const failureView = buildOpenCodeFailureView(summary);
        setSaveHint(`启动失败：${failureView.title}：${failureView.reason}`);
      setStartErrorByProject((prev) => ({
        ...prev,
        [result.projectKey]: failureView,
      }));
      }
      setShowOpenCodeDetails(true);
      setHighlightProjectKey(result.projectKey);
      window.setTimeout(() => {
        setHighlightProjectKey((current) => (current === result.projectKey ? null : current));
      }, 6000);
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
      void queryClient.invalidateQueries({ queryKey: ['setup-status'] });
      void waitForOpenCodeOnline(result.projectKey).then(() => {
        void queryClient.invalidateQueries({ queryKey: ['overview'] });
        void queryClient.invalidateQueries({ queryKey: ['setup-status'] });
      }).catch(() => {
        // 轮询失败不影响主流程，页面会继续按定时刷新更新状态。
      });
    },
    onError: (error, projectKey) => {
      const message = getErrorMessage(error);
      setSaveHint(`启动失败：${message}`);
      setStartErrorByProject((prev) => {
        const failureView = buildOpenCodeFailureView(message);
        return {
          ...prev,
          [projectKey]: failureView,
        };
      });
      setShowOpenCodeDetails(true);
    },
    onSettled: () => {
      setStartingProjectKey(null);
    },
  });

  const handleViewOpenCodeLogs = async (projectKey: string): Promise<void> => {
    if (showLogsByProject[projectKey]) {
      setShowLogsByProject((prev) => ({ ...prev, [projectKey]: false }));
      return;
    }

    setLoadingLogsProjectKey(projectKey);
    setLogsErrorByProject((prev) => {
      const next = { ...prev };
      delete next[projectKey];
      return next;
    });

    try {
      if (desktopMode) {
        const result = await readDesktopOpenCodeLogs(120);
        setLogsByProject((prev) => ({
          ...prev,
          [projectKey]: {
            projectKey,
            logFile: result.logFile,
            lines: result.lines,
          },
        }));
      } else {
        const result = await apiGet<OpenCodeLogsResult>(`/system/opencode/logs?projectKey=${encodeURIComponent(projectKey)}&lines=120`);
        setLogsByProject((prev) => ({ ...prev, [projectKey]: result }));
      }
      setShowLogsByProject((prev) => ({ ...prev, [projectKey]: true }));
    } catch (error) {
      const message = getErrorMessage(error);
      setLogsErrorByProject((prev) => ({ ...prev, [projectKey]: message }));
      setSaveHint(`读取日志失败：${message}`);
    } finally {
      setLoadingLogsProjectKey(null);
    }
  };

  const handleSaveManifestPath = () => {
    setSaveHint(null);
    pathMutation.mutate({ manifestPath });
  };

  const handleSaveOpenClaw = () => {
    setSaveHint(null);
    openClawMutation.mutate({ url: openClawUrl, token: webhookToken });
  };

  const status = statusQuery.data;
  const workersOnline = status?.workersOnline ?? 0;
  const openCodeOnline = status?.openCodeOnline ?? 0;

  useEffect(() => {
    void detectOpenCodeActions();
  }, []);

  return (
    <section className="space-y-4">
      <PageHeader
        title="快速配置向导"
        description="按步骤完成 clawkit 初始化。"
        actions={
          <>
          <button type="button" onClick={() => statusQuery.refetch()} className={secondaryButtonClassName}>
            刷新状态
          </button>
          <button type="button" onClick={() => navigate('/config')} className={secondaryButtonClassName}>
            高级配置
          </button>
          </>
        }
      />

      {saveHint ? (
        saveHint.includes('成功') ? (
          <InfoNotice message={saveHint} />
        ) : (
          <ErrorNotice message={saveHint} />
        )
      ) : null}

      {/* 配置状态总览 */}
      {status ? (
        <Card compact title="配置状态">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="text-sm text-slate-700">Manifest 配置</span>
              <Badge tone={status.manifestConfigured ? 'success' : 'failed'}>
                {status.manifestConfigured ? '已配置' : '未配置'}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="text-sm text-slate-700">OpenClaw 配置</span>
              <Badge tone={status.openClawConfigured && status.openClawTokenConfigured ? 'success' : 'warning'}>
                {status.openClawConfigured && status.openClawTokenConfigured ? '已配置' : '未完成'}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="text-sm text-slate-700">Workers 在线</span>
              <Badge tone={workersOnline > 0 ? 'success' : 'failed'}>
                {workersOnline} 个
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="text-sm text-slate-700">OpenCode 在线</span>
              <Badge tone={openCodeOnline > 0 ? 'success' : 'failed'}>
                {openCodeOnline}/{status?.openCodeTotal ?? 0}
              </Badge>
            </div>
          </div>
        </Card>
      ) : null}

      {/* 步骤 1: 配置 Manifest 路径 */}
      <Card
        compact
        title="步骤 1: 配置 Manifest 路径"
        actions={
          status?.manifestConfigured ? (
            <Badge tone="success">已完成</Badge>
          ) : (
            <Badge tone="warning">待配置</Badge>
          )
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Manifest 管项目和 OpenClaw 连接，先填路径。
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-900" htmlFor="manifest-path">
              Manifest 文件路径
            </label>
            <input
              id="manifest-path"
              type="text"
              value={manifestPath}
              onChange={(e) => setManifestPath(e.target.value)}
              placeholder="/media/yuanqingsong/新加卷1/code/clawkit/examples/simple.yaml"
              className={inputClassName}
            />
            <div className="text-xs text-slate-500">
              示例路径：/media/yuanqingsong/新加卷1/code/clawkit/examples/simple.yaml
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveManifestPath}
            disabled={pathMutation.isPending || !manifestPath.trim()}
            className={primaryButtonClassName}
          >
            {pathMutation.isPending ? '保存中…' : '保存路径'}
          </button>
        </div>
      </Card>

      {/* 步骤 2: 配置 OpenClaw Webhook */}
      <Card
        compact
        title="步骤 2: 配置 OpenClaw Webhook"
        actions={
          status?.openClawConfigured && status?.openClawTokenConfigured ? (
            <Badge tone="success">已完成</Badge>
          ) : (
            <Badge tone="warning">待配置</Badge>
          )
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            配置 OpenClaw 的 webhook，让任务发到 clawkit。
          </div>

          {!status?.manifestConfigured ? (
            <InfoNotice message="请先完成步骤 1：配置 Manifest 路径" />
          ) : (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-900" htmlFor="openclaw-url">
                  OpenClaw 服务地址
                </label>
                <input
                  id="openclaw-url"
                  type="text"
                  value={openClawUrl}
                  onChange={(e) => setOpenClawUrl(e.target.value)}
                  placeholder="http://127.0.0.1:18000"
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-900" htmlFor="webhook-token">
                  Webhook Token
                </label>
                <div className="relative">
                  <input
                    id="webhook-token"
                    type={showWebhookToken ? "text" : "password"}
                    value={webhookToken}
                    onChange={(e) => setWebhookToken(e.target.value)}
                    placeholder="your-webhook-token-here"
                    className={inputClassName}
                  />
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
                    <button
                      type="button"
                      onClick={() => setShowWebhookToken(!showWebhookToken)}
                      className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                      title={showWebhookToken ? "隐藏" : "显示"}
                    >
                      {showWebhookToken ? (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={generateToken}
                      className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                      title="生成随机 Token"
                    >
                      生成
                    </button>
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  此 token 必须与 OpenClaw 配置中的 webhook token 一致
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveOpenClaw}
                disabled={openClawMutation.isPending || !webhookToken.trim()}
                className={primaryButtonClassName}
              >
                {openClawMutation.isPending ? '保存中…' : '保存配置'}
              </button>
            </>
          )}
        </div>
      </Card>

      {/* 步骤 3: 启动服务 */}
      <Card
        compact
        title="步骤 3: 启动服务"
        actions={
          workersOnline > 0 && openCodeOnline > 0 ? (
            <Badge tone="success">运行中</Badge>
          ) : (
            <Badge tone="warning">待启动</Badge>
          )
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            确认下面这些服务在运行。
          </div>

          {/* Controller 状态 */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900">Controller</div>
                <div className="text-xs text-slate-600">调度中心</div>
              </div>
              <Badge tone="success">运行中</Badge>
            </div>
          </div>

          {/* Worker 状态 */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900">Worker</div>
                <div className="text-xs text-slate-600">执行节点</div>
              </div>
              <Badge tone={workersOnline > 0 ? 'success' : 'failed'}>
                {workersOnline > 0 ? '运行中' : '未运行'}
              </Badge>
            </div>
          </div>

          {workersOnline === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="font-medium text-amber-900">Worker 未运行</div>
              <div className="mt-2 rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-sm text-amber-800">
                请运行：<code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">pnpm --filter @clawkit/worker start</code>
              </div>
            </div>
          ) : null}

          {/* OpenCode 服务总览 */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900">OpenCode 服务</div>
                <div className="text-xs text-slate-600">代码执行服务，共 {status?.openCodeTotal ?? 0} 个节点</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={openCodeOnline > 0 ? 'success' : 'failed'}>
                  {openCodeOnline}/{status?.openCodeTotal ?? 0} 在线
                </Badge>
                <Badge
                  tone={
                    desktopMode
                      ? desktopOpenCodePasswordConfigured === true
                        ? 'success'
                        : desktopOpenCodePasswordConfigured === false
                          ? 'failed'
                          : 'neutral'
                      : opencodeActionsState === 'ready'
                        ? 'success'
                        : opencodeActionsState === 'unsupported'
                          ? 'warning'
                          : opencodeActionsState === 'unreachable'
                            ? 'failed'
                            : 'neutral'
                  }
                >
                  {desktopOpenCodeStatusLabel}
                </Badge>
                {status?.openCodeTotal && status.openCodeTotal > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowOpenCodeDetails((value) => !value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {showOpenCodeDetails ? '收起详情' : '查看明细'}
                  </button>
                ) : null}
              </div>
            </div>
            {status?.openCodeTotal && status.openCodeTotal > 0 ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <div className="text-xs text-slate-600">
                  默认仅展示总览，点击“查看明细”可展开每个项目对应的 OpenCode 节点。
                </div>
                  <div className="mt-2">
                  {desktopMode ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                      <div className="font-medium">桌面本机启动</div>
                      {desktopOpenCodePasswordConfigured === false ? (
                        <div className="mt-1 space-y-2">
                          <div className="text-sm leading-6 text-amber-800">
                            当前没有可用的 OpenCode 密码，桌面端一键启动已禁用。你可以直接在这里保存本机密码。
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                              type="password"
                              value={desktopOpenCodePasswordInput}
                              onChange={(e) => {
                                setDesktopOpenCodePasswordHint(null);
                                setDesktopOpenCodePasswordInput(e.target.value);
                              }}
                              className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-400 focus:outline-none"
                              placeholder="输入 OPENCODE_SERVER_PASSWORD"
                              autoComplete="new-password"
                            />
                            <button
                              type="button"
                              onClick={() => void handleSaveDesktopOpenCodePassword()}
                              disabled={desktopOpenCodePasswordSaving || desktopOpenCodePasswordInput.trim().length === 0}
                              className="rounded-lg border border-amber-300 bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {desktopOpenCodePasswordSaving ? '保存中…' : '保存密码'}
                            </button>
                          </div>
                          <div className="text-[11px] text-amber-700">保存后会自动用于后续 OpenCode 启动，不需要再手动导出环境变量。</div>
                        </div>
                      ) : (
                        <div className="mt-1 text-sm leading-6 text-amber-800">
                          已检测到可用的 OpenCode 密码，桌面应用里可以直接启动本机 OpenCode。
                        </div>
                      )}
                    </div>
                ) : opencodeActionsState === 'ready' ? (
                   <InfoNotice
                     compact
                     title="一键启动已可用"
                     message="controller 已支持启动 OpenCode 和读日志。"
                   />
                ) : opencodeActionsState === 'unsupported' ? (
                  <WarningNotice
                    compact
                    title="controller 版本偏旧"
                    message="controller 可达，但未启用一键启动和日志接口。"
                  />
                ) : opencodeActionsState === 'unreachable' ? (
                  <WarningNotice
                    compact
                    title="controller 不可达"
                    message="当前无法连接 controller，暂不能判断接口能力。"
                  />
                ) : null}
                </div>
                {desktopOpenCodePasswordHint ? <InfoNotice compact title="密码配置" message={desktopOpenCodePasswordHint} /> : null}
              </div>
            ) : null}
          </div>

          {/* 每个 OpenCode 节点的详细信息 */}
          {showOpenCodeDetails && status?.openCodeInstances && status.openCodeInstances.length > 0 ? (
            <div className="space-y-2">
              {status.openCodeInstances.map((instance) => (
                <div
                  key={`${instance.workerId}-${instance.projectKey}`}
                  className={`rounded-lg border p-3 ${
                    instance.status === 'online'
                      ? 'border-emerald-200 bg-emerald-50/70'
                      : 'border-rose-200 bg-rose-50/60'
                  } ${
                    highlightProjectKey === instance.projectKey ? 'ring-2 ring-sky-300 ring-offset-1' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div
                        className={`text-sm font-medium ${
                          instance.status === 'online' ? 'text-emerald-900' : 'text-rose-900'
                        }`}
                      >
                        {instance.projectKey}
                      </div>
                      <div
                        className={`mt-0.5 text-xs ${
                          instance.status === 'online' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        节点: {instance.nodeName} · 端口: {instance.port} · Worker: {instance.workerId}
                      </div>
                    </div>
                    <Badge tone={instance.status === 'online' ? 'success' : 'failed'}>
                      {instance.status === 'online' ? '在线' : instance.status === 'unknown' ? '未知' : '离线'}
                    </Badge>
                  </div>

                  <div
                    className={`mt-1 text-xs ${
                      instance.status === 'online' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {instance.detail}
                  </div>

                  {instance.status !== 'online' ? (
                    <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-rose-800">启动命令</div>
                          <code className="mt-1 block rounded bg-white/80 px-2 py-1 font-mono text-[11px] leading-4 text-rose-800 ring-1 ring-inset ring-rose-200 select-all break-all">
                            opencode serve --hostname 127.0.0.1 --port {instance.port}
                          </code>
                          <div className="mt-1 text-xs text-rose-700">在项目目录下运行即可。</div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1.5">
                          {desktopOpenCodeActionsEnabled && instance.canStart !== false ? (
                            <button
                              type="button"
                              disabled={
                                startingProjectKey === instance.projectKey ||
                                startOpenCodeMutation.isPending ||
                                (desktopMode && desktopOpenCodePasswordConfigured === false)
                              }
                              onClick={() => startOpenCodeMutation.mutate(instance.projectKey)}
                              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-800 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {startingProjectKey === instance.projectKey
                                ? '启动中…'
                                : desktopMode && desktopOpenCodePasswordConfigured === false
                                  ? '未配置密码'
                                  : '启动 OpenCode'}
                            </button>
                          ) : null}

                          {desktopOpenCodeActionsEnabled && instance.canStart !== false ? (
                            <button
                              type="button"
                              disabled={loadingLogsProjectKey === instance.projectKey}
                              onClick={() => void handleViewOpenCodeLogs(instance.projectKey)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {loadingLogsProjectKey === instance.projectKey
                                ? '读取中…'
                                : showLogsByProject[instance.projectKey]
                                  ? '收起日志'
                                  : '查看日志'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {!desktopMode && opencodeActionsState === 'unsupported' ? (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="warning" className="shrink-0 text-xs">
                          版本过旧
                        </Badge>
                        <div className="min-w-0 flex-1 text-xs text-amber-800">
                          controller 可达，但未启用一键启动和日志接口。
                        </div>
                      </div>
                    </div>
                  ) : !desktopMode && opencodeActionsState === 'unreachable' ? (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="warning" className="shrink-0 text-xs">
                          不可达
                        </Badge>
                        <div className="min-w-0 flex-1 text-xs text-amber-800">
                          当前无法连接 controller，暂不能判断接口能力。
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {startErrorByProject[instance.projectKey] ? (
                    <div className="mt-1.5">
                      <WarningNotice
                        compact
                        title={startErrorByProject[instance.projectKey].title}
                        message={
                          expandedErrorByProject[instance.projectKey]
                            ? `原因：${startErrorByProject[instance.projectKey].reason}\n建议：${startErrorByProject[instance.projectKey].suggestion}`
                            : `原因：${startErrorByProject[instance.projectKey].reason}`
                        }
                      />
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void copyToClipboard(
                              `${startErrorByProject[instance.projectKey].title}\n原因：${startErrorByProject[instance.projectKey].reason}\n建议：${startErrorByProject[instance.projectKey].suggestion}`
                            )
                          }
                          className="rounded border border-amber-200 bg-white px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-50"
                        >
                          复制
                        </button>
                        {startErrorByProject[instance.projectKey].suggestion ? (
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedErrorByProject((prev) => ({
                                ...prev,
                                [instance.projectKey]: !prev[instance.projectKey],
                              }));
                              }}
                              className="rounded border border-amber-200 bg-white px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-50"
                            >
                              {expandedErrorByProject[instance.projectKey] ? '收起' : '展开'}
                            </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {logsErrorByProject[instance.projectKey] ? (
                    <div className="mt-1.5">
                      <WarningNotice compact title="日志读取失败" message={logsErrorByProject[instance.projectKey]} />
                    </div>
                  ) : null}

                  {showLogsByProject[instance.projectKey] && logsByProject[instance.projectKey] ? (
                    <div className="mt-1.5 rounded-lg border border-slate-200 bg-white p-2">
                      <div className="text-xs font-medium text-slate-700">日志</div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-500">{logsByProject[instance.projectKey].logFile}</div>
                      <pre className="mt-1 max-h-32 overflow-auto rounded bg-slate-900 px-2 py-1 text-[11px] leading-4 text-slate-100">
                        {logsByProject[instance.projectKey].lines.length > 0
                          ? logsByProject[instance.projectKey].lines.join('\n')
                          : '暂无日志'}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : status?.openCodeTotal === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="warning" className="shrink-0 text-xs">
                  未配置
                </Badge>
                <div className="min-w-0 flex-1 text-sm text-amber-800">
                  请确认 manifest 中已正确配置项目和 OpenCode 端口。
                </div>
              </div>
            </div>
          ) : null}

          {/* 全部离线时的汇总提示 */}
          {status?.openCodeTotal && status.openCodeTotal > 0 && status.openCodeOnline === 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="failed" className="shrink-0 text-xs">
                  全部离线
                </Badge>
                <div className="min-w-0 flex-1 text-sm text-red-800">
                  请在对应项目目录启动 OpenCode，页面会自动刷新。
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {/* 步骤 4: 配置 OpenClaw 侧 Webhook */}
      <Card title="步骤 4: 配置 OpenClaw 侧 Webhook">
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            在 OpenClaw 中配置 webhook，把任务发到 clawkit controller。
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-2 font-mono text-xs">
              <div>
                <span className="text-slate-500">Webhook URL:</span>
                <div className="mt-1 text-slate-900">http://localhost:8787/webhook/openclaw</div>
              </div>
              <div>
                <span className="text-slate-500">Token:</span>
                <div className="mt-1 text-slate-900">{webhookToken || '(请先在步骤 2 中配置)'}</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            把上面的地址和 Token 配到 OpenClaw。
          </div>
        </div>
      </Card>

      {/* 完成提示 */}
      {status?.manifestConfigured &&
      status?.openClawConfigured &&
      status?.openClawTokenConfigured &&
       workersOnline > 0 &&
       openCodeOnline > 0 ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="font-medium text-green-900">配置完成！</div>
              <div className="mt-2 rounded-lg border border-green-200 bg-white/70 px-3 py-2 text-sm text-green-800">
                所有服务已就绪，可以开始使用 clawkit。
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500"
            >
              前往控制台
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
