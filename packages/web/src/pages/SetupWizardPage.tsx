import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as yaml from 'yaml';

import { ConfigModal } from '../components/ConfigModal';
import { Accordion } from '../components/ui/Accordion';
import { Badge } from '../components/ui/Badge';
import { CodeBlock } from '../components/ui/CodeBlock';
import { Stepper, StepperStepData } from '../components/ui/Stepper';
import { apiPost } from '../lib/api';
import {
  calculateProgress,
  findCurrentStepIndex,
  getStepVisualState,
  mapStepKeyToTitle,
  mapStepStatusToText,
  mapStepStatusToTone,
} from '../lib/setup-helpers';
import type { QuickSetupFormState, SetupInputMode, ValidationIssue } from '../lib/setup-wizard-types';

interface SetupRun {
  runId: string;
  sessionId: string;
  status: string;
  manifest: unknown;
  manifestYaml: string;
  currentStep: string | null;
  summary: string | null;
  errorSummary: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface SetupStep {
  stepId: number;
  runId: string;
  stepKey: string;
  title: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  logSummary: string[];
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface SetupRunDetail {
  session: {
    sessionId: string;
    status: string;
    topology: string;
  };
  run: SetupRun;
  steps: SetupStep[];
}

interface SetupPreviewResult {
  manifest: Record<string, unknown>;
  yamlText: string;
}

interface QuickSetupProfile {
  name: string;
  mode: 'all-in-one' | 'hybrid';
  project: {
    key: string;
    repoPath: string;
  };
  openclaw: {
    publicUrl: string;
  };
  worker: {
    id: string;
    opencodePort: number;
  };
  remote?: {
    host: string;
    user: string;
    keyPath: string;
    workDir: string;
  };
}

interface SSEEvent {
  event: string;
  runId: string;
  timestamp: string;
  data: unknown;
}

function defaultQuickFormState(): QuickSetupFormState {
  return {
    name: 'local-studio',
    mode: 'all-in-one',
    projectKey: 'clawkit',
    repoPath: '.',
    publicUrl: 'http://127.0.0.1:8787',
    workerId: 'local-worker',
    opencodePort: '4096',
    remoteHost: '',
    remoteUser: 'deploy',
    remoteKeyPath: '~/.ssh/id_rsa',
    remoteWorkDir: '/srv/clawkit/control',
  };
}

function isValidUrl(value: string): boolean {
  try {
    const target = new URL(value);
    return target.protocol === 'http:' || target.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function parseManifest(yamlText: string): Record<string, unknown> {
  const parsed = yaml.parse(yamlText);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('manifest 必须是对象结构');
  }
  return parsed as Record<string, unknown>;
}

function validateQuickFormState(form: QuickSetupFormState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const requireValue = (key: string, label: string, value: string) => {
    if (value.trim().length === 0) {
      issues.push({ key, message: `${label}不能为空` });
    }
  };

  requireValue('name', '配置名称', form.name);
  requireValue('projectKey', '项目 key', form.projectKey);
  requireValue('repoPath', '仓库路径', form.repoPath);
  requireValue('publicUrl', 'OpenClaw 地址', form.publicUrl);
  requireValue('workerId', 'Worker ID', form.workerId);
  requireValue('opencodePort', 'OpenCode 端口', form.opencodePort);

  if (!isPositiveInteger(form.opencodePort)) {
    issues.push({ key: 'opencodePort', message: 'OpenCode 端口必须是正整数' });
  }

  if (!isValidUrl(form.publicUrl.trim())) {
    issues.push({ key: 'publicUrl', message: 'OpenClaw 地址必须是合法的 http/https URL' });
  }

  if (form.mode === 'hybrid') {
    requireValue('remoteHost', 'SSH 主机', form.remoteHost);
    requireValue('remoteUser', 'SSH 用户', form.remoteUser);
    requireValue('remoteKeyPath', 'SSH 私钥路径', form.remoteKeyPath);
    requireValue('remoteWorkDir', '远程工作目录', form.remoteWorkDir);
  }

  return issues;
}

function buildQuickProfile(form: QuickSetupFormState): QuickSetupProfile {
  return {
    name: form.name.trim(),
    mode: form.mode,
    project: {
      key: form.projectKey.trim(),
      repoPath: form.repoPath.trim(),
    },
    openclaw: {
      publicUrl: form.publicUrl.trim(),
    },
    worker: {
      id: form.workerId.trim(),
      opencodePort: Number(form.opencodePort),
    },
    ...(form.mode === 'hybrid'
      ? {
          remote: {
            host: form.remoteHost.trim(),
            user: form.remoteUser.trim(),
            keyPath: form.remoteKeyPath.trim(),
            workDir: form.remoteWorkDir.trim(),
          },
        }
      : {}),
  };
}

function mapQuickErrorMessage(message: string): string {
  if (message.includes('SSH 私钥路径不能为空')) {
    return 'SSH 私钥路径不能为空';
  }
  if (message.includes('SSH 主机不能为空')) {
    return '远程控制主机不能为空';
  }
  if (message.includes('SSH 用户不能为空')) {
    return 'SSH 用户不能为空';
  }
  if (message.includes('远程工作目录不能为空')) {
    return '远程工作目录不能为空';
  }
  if (message.includes('OpenClaw 地址')) {
    return 'OpenClaw 地址格式不正确';
  }
  if (message.includes('仓库路径')) {
    return '本地项目路径不能为空';
  }
  if (message.includes('OpenCode 端口')) {
    return 'OpenCode 端口必须是正整数';
  }
  if (message.includes('Connection closed') || message.includes('Permission denied')) {
    return '无法连接远程控制主机，请检查 SSH 用户、密钥和主机可达性';
  }
  if (message.includes('No route to host') || message.includes('Name or service not known')) {
    return '远程主机不可达，请检查主机地址和网络连接';
  }
  return message;
}

function summarizeStepStatus(step: SetupStep | undefined): string {
  if (!step) {
    return '未执行';
  }

  if (step.status === 'success') {
    return '正常';
  }

  if (step.status === 'failed') {
    return '失败';
  }

  if (step.status === 'running') {
    return '进行中';
  }

  return '未完成';
}

export function SetupWizardPage(): JSX.Element {
  const [inputMode, setInputMode] = useState<SetupInputMode>('quick');
  const [quickForm, setQuickForm] = useState<QuickSetupFormState>(defaultQuickFormState());
  const [quickIssues, setQuickIssues] = useState<ValidationIssue[]>([]);
  const [manifestYaml, setManifestYaml] = useState<string>('');
  const [yamlError, setYamlError] = useState<string | null>(null);
  const [previewHint, setPreviewHint] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<SetupRunDetail | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [dismissedErrorMessage, setDismissedErrorMessage] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    setQuickIssues(validateQuickFormState(quickForm));
  }, [quickForm]);

  const compileMutation = useMutation({
    mutationFn: async (profile: QuickSetupProfile) =>
      apiPost<SetupPreviewResult, { profile: QuickSetupProfile }>('/setup/quick-profile/compile', { profile }),
    onSuccess: (data) => {
      setManifestYaml(data.yamlText);
      setPreviewHint('配置检查通过，已生成完整部署配置。');
      setYamlError(null);
    },
  });

  const previewMutation = useMutation({
    mutationFn: async (formData: Record<string, unknown>) =>
      apiPost<SetupPreviewResult, { formData: Record<string, unknown> }>('/setup/manifest/preview', { formData }),
    onSuccess: (data) => {
      setManifestYaml(data.yamlText);
      setPreviewHint('配置检查通过，已生成规范化 manifest。');
      setYamlError(null);
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      let preview: SetupPreviewResult;

      if (inputMode === 'quick') {
        const issues = validateQuickFormState(quickForm);
        setQuickIssues(issues);
        if (issues.length > 0) {
          throw new Error(mapQuickErrorMessage(issues[0].message));
        }

        preview = await compileMutation.mutateAsync(buildQuickProfile(quickForm));
      } else {
        let formData: Record<string, unknown>;
        try {
          formData = parseManifest(manifestYaml);
        } catch (error) {
          throw new Error(`YAML 解析失败：${error instanceof Error ? error.message : '未知错误'}`);
        }

        preview = await previewMutation.mutateAsync(formData);
      }

      setManifestYaml(preview.yamlText);
      setYamlError(null);
      setPreviewHint('配置检查通过，正在启动一键配置流程。');

      return apiPost<SetupRunDetail, { formData: Record<string, unknown> }>('/setup/runs', {
        formData: preview.manifest,
      });
    },
    onSuccess: (data) => {
      setRunDetail(data);
      setLogs([]);
      setPreviewHint(null);
      setIsConfigModalOpen(false);
      connectSSE(data.run.runId);
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (runId: string) =>
      apiPost<SetupRunDetail, Record<string, never>>(`/setup/runs/${runId}/retry`, {}),
    onSuccess: (data) => {
      setRunDetail(data);
      setLogs([]);
      setPreviewHint(null);
      connectSSE(data.run.runId);
    },
  });

  const connectSSE = (runId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/setup/runs/${runId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('setup.run', (e) => {
      const event = JSON.parse(e.data) as SSEEvent;
      if (event.data && typeof event.data === 'object' && 'run' in event.data) {
        setRunDetail((prev) => (prev ? { ...prev, run: (event.data as { run: SetupRun }).run } : null));
      }
    });

    eventSource.addEventListener('setup.step', (e) => {
      const event = JSON.parse(e.data) as SSEEvent;
      if (event.data && typeof event.data === 'object' && 'step' in event.data) {
        const step = (event.data as { step: SetupStep }).step;
        setRunDetail((prev) => {
          if (!prev) {
            return null;
          }
          return {
            ...prev,
            steps: prev.steps.map((item) => (item.stepKey === step.stepKey ? step : item)),
          };
        });
      }
    });

    eventSource.addEventListener('setup.log', (e) => {
      const event = JSON.parse(e.data) as SSEEvent;
      if (event.data && typeof event.data === 'object' && 'message' in event.data) {
        setLogs((prev) => [...prev, (event.data as { message: string }).message]);
      }
    });

    eventSource.addEventListener('setup.summary', (e) => {
      const event = JSON.parse(e.data) as SSEEvent;
      if (event.data && typeof event.data === 'object' && 'summary' in event.data) {
        setRunDetail((prev) => {
          if (!prev) {
            return null;
          }
          return {
            ...prev,
            run: {
              ...prev.run,
              summary: (event.data as { summary: string }).summary,
              errorSummary: (event.data as { errorSummary: string | null }).errorSummary,
            },
          };
        });
      }
    });

    eventSource.onerror = () => {
      eventSource.close();
    };
  };

  useEffect(() => () => eventSourceRef.current?.close(), []);

  const isRunning = runDetail?.run.status === 'running';
  const isFinished = runDetail?.run.status === 'success' || runDetail?.run.status === 'partial_success' || runDetail?.run.status === 'failed';
  const usesRemoteControl = quickForm.mode === 'hybrid';

  const startErrorMessage = useMemo(() => {
    if (!startMutation.error) return null;
    if (startMutation.error instanceof Error) {
      return mapQuickErrorMessage(startMutation.error.message);
    }
    return '启动失败';
  }, [startMutation.error]);

  const runErrorMessage = useMemo(() => {
    if (!runDetail?.run.errorSummary) return null;
    return mapQuickErrorMessage(runDetail.run.errorSummary);
  }, [runDetail?.run.errorSummary]);

  const errorMessageRaw = runErrorMessage ?? startErrorMessage ?? yamlError;

  useEffect(() => {
    setDismissedErrorMessage(null);
  }, [errorMessageRaw]);

  const errorMessage = errorMessageRaw && dismissedErrorMessage !== errorMessageRaw ? errorMessageRaw : null;

  const stepperData = useMemo((): { stepperSteps: StepperStepData[]; currentStepIndex: number; progress: number } | null => {
    if (!runDetail) {
      return null;
    }

    return {
      stepperSteps: runDetail.steps.map((step) => ({
        id: step.stepKey,
        title: mapStepKeyToTitle(step.stepKey, step.title),
        state: getStepVisualState(step),
      })),
      currentStepIndex: findCurrentStepIndex(runDetail.steps),
      progress: calculateProgress(runDetail.steps),
    };
  }, [runDetail]);

  const runSummary = useMemo(() => {
    if (!runDetail) {
      return null;
    }

    const findStep = (stepKey: string) => runDetail.steps.find((step) => step.stepKey === stepKey);

    return {
      profileName: String((runDetail.run.manifest as { profile?: { name?: string } } | null)?.profile?.name ?? quickForm.name),
      topology: runDetail.session.topology,
      configStatus: summarizeStepStatus(findStep('generate_manifest')),
      deployStatus: summarizeStepStatus(findStep('apply')),
      controllerStatus: summarizeStepStatus(findStep('check_controller')),
      workerStatus: summarizeStepStatus(findStep('check_worker')),
      opencodeStatus: summarizeStepStatus(findStep('check_opencode')),
    };
  }, [quickForm.name, runDetail]);

  const updateQuickForm = <K extends keyof QuickSetupFormState>(key: K, value: QuickSetupFormState[K]) => {
    setQuickForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCheckQuickProfile = async () => {
    const issues = validateQuickFormState(quickForm);
    setQuickIssues(issues);
    if (issues.length > 0) {
      setYamlError(mapQuickErrorMessage(issues[0].message));
      return;
    }

    setYamlError(null);
    await compileMutation.mutateAsync(buildQuickProfile(quickForm));
  };

  const switchToYamlMode = async () => {
    if (inputMode === 'quick') {
      const issues = validateQuickFormState(quickForm);
      setQuickIssues(issues);
      if (issues.length === 0) {
        try {
          const preview = await compileMutation.mutateAsync(buildQuickProfile(quickForm));
          setManifestYaml(preview.yamlText);
        } catch (error) {
          setYamlError(error instanceof Error ? mapQuickErrorMessage(error.message) : '配置编译失败');
        }
      }
    }

    setInputMode('yaml');
  };

  const switchToQuickMode = () => {
    setInputMode('quick');
    setYamlError(null);
  };

  const failedStepKey = useMemo(() => {
    if (!runDetail) return null;
    return runDetail.steps.find((step) => step.status === 'failed')?.stepKey ?? null;
  }, [runDetail]);

  useEffect(() => {
    if (!failedStepKey || !errorMessageRaw) return;
    const el = document.getElementById(`setup-step-${failedStepKey}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }, [errorMessageRaw, failedStepKey]);

  const currentStep = useMemo(() => {
    if (!runDetail) return null;
    const index = stepperData?.currentStepIndex ?? findCurrentStepIndex(runDetail.steps);
    return runDetail.steps[index] ?? null;
  }, [runDetail, stepperData?.currentStepIndex]);

  return (
    <section className="relative space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div>
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-600">
            Setup Console
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">一键配置向导</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">填写最少必要信息，系统会自动生成部署配置并执行检查。</p>
        </div>
        <button
          type="button"
          onClick={() => setIsConfigModalOpen(true)}
          className="inline-flex items-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-900"
        >
          一键配置
        </button>
      </div>

      {runDetail && stepperData ? (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_-24px_rgba(15,23,42,0.28)]">
          <div className="p-4 md:p-5">
            <div className="overflow-hidden rounded-2xl bg-slate-950 text-slate-50 shadow-sm">
              <div className="flex flex-col gap-2 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs font-semibold tracking-wide">执行步骤</div>
                  <div className="mt-1 text-[11px] text-slate-400">状态将随 SSE 实时刷新</div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="font-semibold tabular-nums text-white">{stepperData.progress}%</div>
                  <div className="h-1 w-1 rounded-full bg-white/30" />
                  <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] font-medium text-slate-200">
                    {runDetail.run.status}
                  </div>
                </div>
              </div>
              <div className="border-t border-white/10 px-5 py-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    className="h-full rounded-full bg-sky-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${stepperData.progress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 border-t border-slate-100 px-1 pt-4 md:px-2 md:pt-5">
              <div className="hidden md:block">
                <Stepper
                  steps={stepperData.stepperSteps}
                  currentStepIndex={stepperData.currentStepIndex}
                  orientation="horizontal"
                  stepIdPrefix="setup-step"
                />
              </div>
              <div className="md:hidden">
                <Stepper
                  steps={stepperData.stepperSteps}
                  currentStepIndex={stepperData.currentStepIndex}
                  orientation="vertical"
                  stepIdPrefix="setup-step"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <AnimatePresence initial={false}>
        {errorMessage ? (
          <motion.div
            className="fixed left-1/2 top-4 z-40 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="flex items-start justify-between gap-3 rounded-xl bg-rose-600/95 px-4 py-3 text-white ring-1 ring-white/15 shadow-[0_18px_50px_-18px_rgba(15,23,42,0.55)] backdrop-blur">
              <div className="min-w-0">
                <div className="text-xs font-semibold tracking-wide">发生错误</div>
                <div className="mt-1 break-words text-sm leading-relaxed opacity-95">{errorMessage}</div>
              </div>
              <button
                type="button"
                onClick={() => setDismissedErrorMessage(errorMessageRaw ?? '')}
                className="shrink-0 rounded-lg p-2 text-white/90 transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/60"
                aria-label="关闭错误提示"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {runDetail ? (
        <div className="space-y-4">
          {currentStep ? (
            <div
              className={[
                'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-l-4',
                currentStep.status === 'failed'
                  ? 'border-l-rose-600 ring-1 ring-rose-500/12'
                  : currentStep.status === 'running'
                    ? 'border-l-slate-950 ring-1 ring-slate-900/8'
                    : 'border-l-slate-200',
              ].join(' ')}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-[11px] font-semibold tracking-wide text-slate-500">当前步骤</div>
                  <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                    {mapStepKeyToTitle(currentStep.stepKey, currentStep.title)}
                  </div>
                </div>
                <Badge tone={mapStepStatusToTone(currentStep.status)}>{mapStepStatusToText(currentStep.status)}</Badge>
              </div>

              {currentStep.errorMessage ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-relaxed text-rose-800 ring-1 ring-rose-600/10">
                  {mapQuickErrorMessage(currentStep.errorMessage)}
                </div>
              ) : null}

              {currentStep.logSummary && currentStep.logSummary.length > 0 ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <Accordion
                    type="single"
                    items={[
                      {
                        id: `current-step-logs-${currentStep.stepKey}`,
                        title: `步骤日志 (${currentStep.logSummary.length})`,
                        content: (
                          <div className="space-y-1 font-mono text-xs text-slate-700">
                            {currentStep.logSummary.map((log, index) => (
                              <div key={`${currentStep.stepKey}-${index}`}>{log}</div>
                            ))}
                          </div>
                        ),
                        defaultOpen: false,
                      },
                    ]}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <Accordion
            type="multiple"
            items={[
              ...(logs.length > 0
                ? [
                    {
                      id: 'realtime-logs',
                      title: `实时日志 (${logs.length})`,
                      content: (
                        <div className="max-h-64 overflow-y-auto font-mono text-xs text-slate-700">
                          {logs.map((log, index) => (
                            <div key={`${index}-${log}`}>{log}</div>
                          ))}
                        </div>
                      ),
                      defaultOpen: false,
                    },
                  ]
                : []),
              ...(runDetail.run.summary
                ? [
                    {
                      id: 'execution-summary',
                      title: '执行摘要',
                      content: <CodeBlock>{runDetail.run.summary}</CodeBlock>,
                      defaultOpen: true,
                    },
                  ]
                : []),
              ...(runSummary
                ? [
                    {
                      id: 'result-overview',
                      title: '结果概览',
                      content: (
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="text-[11px] font-medium text-slate-500">配置名称</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{runSummary.profileName}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="text-[11px] font-medium text-slate-500">部署模式</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{runSummary.topology}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="text-[11px] font-medium text-slate-500">配置生成</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{runSummary.configStatus}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="text-[11px] font-medium text-slate-500">部署文件写入</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{runSummary.deployStatus}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="text-[11px] font-medium text-slate-500">控制服务</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{runSummary.controllerStatus}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="text-[11px] font-medium text-slate-500">执行节点</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{runSummary.workerStatus}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="text-[11px] font-medium text-slate-500">OpenCode 服务</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{runSummary.opencodeStatus}</div>
                          </div>
                        </div>
                      ),
                      defaultOpen: true,
                    },
                  ]
                : []),
            ]}
          />

          {isFinished && runDetail.run.status !== 'success' ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => retryMutation.mutate(runDetail.run.runId)}
                disabled={retryMutation.isPending}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {retryMutation.isPending ? '重试中...' : '重试'}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <div className="text-sm font-semibold text-slate-900">尚未启动配置流程</div>
          <div className="mt-1 text-sm text-slate-600">点击右上角“一键配置”，填写必要信息后确认执行。</div>
        </div>
      )}

      <ConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        inputMode={inputMode}
        onSwitchToQuickMode={switchToQuickMode}
        onSwitchToYamlMode={switchToYamlMode}
        quickForm={quickForm}
        quickIssues={quickIssues}
        formatIssueMessage={mapQuickErrorMessage}
        isRunning={isRunning}
        usesRemoteControl={usesRemoteControl}
        manifestYaml={manifestYaml}
        yamlError={yamlError}
        previewHint={previewHint}
        onUpdateQuickForm={updateQuickForm}
        onUpdateManifestYaml={setManifestYaml}
        onClearYamlError={() => setYamlError(null)}
        onCheckQuickProfile={handleCheckQuickProfile}
        isCompilePending={compileMutation.isPending}
        isPreviewPending={previewMutation.isPending}
        isStartPending={startMutation.isPending}
        onExecute={() => startMutation.mutate()}
        startErrorMessage={startErrorMessage}
      />
    </section>
  );
}
