import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as yaml from 'yaml';

import { ConfigModal } from '../components/ConfigModal';
import { Accordion } from '../components/ui/Accordion';
import { Badge } from '../components/ui/Badge';
import { CodeBlock } from '../components/ui/CodeBlock';
import { Stepper, StepperStepData } from '../components/ui/Stepper';
import { apiPost } from '../lib/api';
import { apiGet } from '../lib/api';
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
  /**
   * 由后端 setup 运行过程写入的上下文信息，用于 UI 引导展示。
   * 注意：字段可能不存在，因此全部做成可选。
   */
  context?: {
    openClawUrl?: string;
    openClawDeployFailed?: boolean;
  };
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
    deployMode: 'local' | 'external' | 'skip';
  };
  promptEngine: {
    mode: 'template' | 'llm' | 'hybrid';
    provider?: 'openai' | 'anthropic' | 'custom';
    baseUrl?: string;
    apiKeyEnv?: string;
    model?: string;
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

interface ModelSummary {
  id: string;
  label: string;
}

interface ListModelsResult {
  provider: QuickSetupFormState['modelProvider'];
  models: ModelSummary[];
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
    publicUrl: 'http://127.0.0.1:18000',
    openClawDeployMode: 'skip',
    promptEngineMode: 'template',
    modelProvider: 'openai',
    modelBaseUrl: '',
    modelApiKeyEnv: 'OPENAI_API_KEY',
    modelApiKey: '',
    defaultModel: '',
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

  if (form.promptEngineMode !== 'template') {
    requireValue('modelApiKeyEnv', '模型 API Key 环境变量', form.modelApiKeyEnv);
    requireValue('defaultModel', '默认模型', form.defaultModel);
    if (form.modelProvider === 'custom') {
      requireValue('modelBaseUrl', '模型 Base URL', form.modelBaseUrl);
    }
    if (form.modelBaseUrl.trim().length > 0 && !isValidUrl(form.modelBaseUrl.trim())) {
      issues.push({ key: 'modelBaseUrl', message: '模型 Base URL 必须是合法的 http/https URL' });
    }
  }

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
      deployMode: form.openClawDeployMode,
    },
    promptEngine: {
      mode: form.promptEngineMode,
      ...(form.promptEngineMode === 'template'
        ? {}
        : {
            provider: form.modelProvider,
            baseUrl: form.modelBaseUrl.trim() || undefined,
            apiKeyEnv: form.modelApiKeyEnv.trim(),
            model: form.defaultModel.trim(),
          }),
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
  if (message.includes('模型供应商')) {
    return '模型供应商不能为空';
  }
  if (message.includes('模型 API Key 环境变量')) {
    return '模型 API Key 环境变量不能为空';
  }
  if (message.includes('默认模型')) {
    return '默认模型不能为空';
  }
  if (message.includes('Base URL')) {
    return '自定义模型供应商必须填写 Base URL';
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

/**
 * OpenClaw 一键部署请求类型
 */
interface OpenClawDeployRequest {
  deployMode: 'local';
}

/**
 * OpenClaw 一键部署响应类型
 */
interface OpenClawDeployResponse {
  success: boolean;
  message: string;
  details?: string;
  openClawUrl?: string;
  deployMode: 'local' | 'external' | 'skip';
  healthCheckPassed?: boolean;
}

/**
 * OpenCode 一键安装请求类型
 */
interface OpenCodeInstallRequest {
  installMode: 'local';
}

/**
 * OpenCode 一键安装响应类型
 */
interface OpenCodeInstallResponse {
  success: boolean;
  message: string;
  details?: string;
  openCodeUrl?: string;
  binaryPath?: string;
  installMode: 'local' | 'external' | 'skip';
  alreadyInstalled?: boolean;
  healthCheckPassed?: boolean;
}

/**
 * 环境检查单项结果
 */
interface EnvironmentCheckItem {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  suggestion?: string;
}

/**
 * 环境检查响应类型
 */
interface EnvironmentCheckResponse {
  overall: 'pass' | 'warn' | 'fail';
  checks: EnvironmentCheckItem[];
}

/**
 * SSE 部署状态
 */
interface SSEDeployState {
  isDeploying: boolean;
  stage: string;
  progress: number;
  logs: string[];
  result: OpenClawDeployResponse | null;
  error: string | null;
}

/**
 * Overview 数据接口（用于查询服务状态）
 */
interface OverviewData {
  openClaw: {
    configured: boolean;
    publicUrl: string;
    tokenConfigured: boolean;
    detail: string;
    serviceStatus: 'online' | 'offline' | 'unknown' | 'checking';
    healthCheckUrl: string | null;
    healthCheckDetail: string;
    lastCheckAt: string | null;
  };
}

/**
 * SSE 安装状态
 */
interface SSEInstallState {
  isInstalling: boolean;
  stage: string;
  progress: number;
  logs: string[];
  result: OpenCodeInstallResponse | null;
  error: string | null;
}

/**
 * 验证日志消息是否为有效的非空字符串
 * @param message - 待验证的消息
 * @returns 是否为有效的非空字符串
 */
function isValidLogMessage(message: unknown): message is string {
  return typeof message === 'string' && message.trim().length > 0;
}

/**
 * 验证 SSE 日志事件的 payload 结构
 * 兼容两种字段名：message（setup.log）和 log（openclaw.log/opencode.log）
 * @param data - SSE 事件解析后的数据
 * @returns 是否包含有效的日志字段
 */
function isValidLogEvent(data: unknown): data is { message: string } | { log: string } {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  
  // 检查 message 字段（setup.log 使用）
  if ('message' in data && isValidLogMessage((data as { message: unknown }).message)) {
    return true;
  }
  
  // 检查 log 字段（openclaw.log/opencode.log 使用）
  if ('log' in data && isValidLogMessage((data as { log: unknown }).log)) {
    return true;
  }
  
  return false;
}

/**
 * 从 SSE 日志事件中提取日志消息
 * @param data - 已验证的日志事件数据
 * @returns 日志消息字符串
 */
function extractLogMessage(data: { message?: string; log?: string }): string {
  return data.message || data.log || '';
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
  const [modelOptions, setModelOptions] = useState<ModelSummary[]>([]);

  const overviewQuery = useQuery({
    queryKey: ['overview'],
    queryFn: () => apiGet<OverviewData>('/overview'),
    refetchInterval: 5000,
  });

  const isOpenClawOnline = overviewQuery.data?.openClaw.serviceStatus === 'online';

  // SSE 部署状态
  const [openClawDeployState, setOpenClawDeployState] = useState<SSEDeployState>({
    isDeploying: false,
    stage: '',
    progress: 0,
    logs: [],
    result: null,
    error: null,
  });
  const [openCodeInstallState, setOpenCodeInstallState] = useState<SSEInstallState>({
    isInstalling: false,
    stage: '',
    progress: 0,
    logs: [],
    result: null,
    error: null,
  });

  const openClawEventSourceRef = useRef<EventSource | null>(null);
  const openCodeEventSourceRef = useRef<EventSource | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null); // 用于 setup run 流式更新

  /**
   * OpenClaw 一键部署 Hook
   * 调用 /api/setup/openclaw/configure 以 local 模式部署 OpenClaw
   */
  const deployOpenClawMutation = useMutation({
    mutationFn: async () =>
      apiPost<OpenClawDeployResponse, OpenClawDeployRequest>('/setup/openclaw/configure', {
        deployMode: 'local',
      }),
  });

  /**
   * OpenCode 一键安装 Hook
   * 调用 /api/setup/opencode/configure 以 local 模式安装 OpenCode
   */
  const deployOpenCodeMutation = useMutation({
    mutationFn: async () =>
      apiPost<OpenCodeInstallResponse, OpenCodeInstallRequest>('/setup/opencode/configure', {
        installMode: 'local',
      }),
  });

  /**
   * 环境检查 mutation hook
   * API: GET /api/setup/check-environment
   */
  const checkEnvironmentMutation = useMutation({
    mutationFn: async () => {
      return await apiGet<EnvironmentCheckResponse>('/setup/check-environment');
    },
    onSuccess: (data) => {
      setEnvCheckResult(data);
    },
    onError: (error) => {
      console.error('环境检查失败:', error);
    },
  });

  const startOpenClawDeploy = () => {
    if (openClawEventSourceRef.current) {
      openClawEventSourceRef.current.close();
    }

    setOpenClawDeployState({
      isDeploying: true,
      stage: '准备部署...',
      progress: 0,
      logs: [],
      result: null,
      error: null,
    });

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    const eventSource = new EventSource(`${apiBaseUrl}/setup/openclaw/deploy/stream`);
    openClawEventSourceRef.current = eventSource;

    eventSource.addEventListener('openclaw.stage', (e) => {
      const data = JSON.parse(e.data);
      setOpenClawDeployState((prev) => ({
        ...prev,
        stage: data.stage,
        progress: data.progress || prev.progress,
      }));
    });

    eventSource.addEventListener('openclaw.log', (e) => {
      const data = JSON.parse(e.data);
      // 运行时校验：只接受包含有效日志字段的事件
      if (isValidLogEvent(data)) {
        setOpenClawDeployState((prev) => ({
          ...prev,
          logs: [...prev.logs, extractLogMessage(data)],
        }));
      } else {
        console.warn('[OpenClaw Deploy] 收到无效日志事件，已忽略:', data);
      }
    });

    eventSource.addEventListener('openclaw.complete', (e) => {
      const data = JSON.parse(e.data);
      setOpenClawDeployState((prev) => ({
        ...prev,
        isDeploying: false,
        stage: '部署完成',
        progress: 100,
        result: data,
      }));
      eventSource.close();
      openClawEventSourceRef.current = null;
    });

    eventSource.addEventListener('openclaw.error', (e) => {
      const data = JSON.parse(e.data);
      setOpenClawDeployState((prev) => ({
        ...prev,
        isDeploying: false,
        error: data.error,
      }));
      eventSource.close();
      openClawEventSourceRef.current = null;
    });

    eventSource.onerror = () => {
      setOpenClawDeployState((prev) => ({
        ...prev,
        isDeploying: false,
        error: '连接中断，请检查网络或重试',
      }));
      eventSource.close();
      openClawEventSourceRef.current = null;
    };
  };

  const startOpenCodeInstall = () => {
    if (openCodeEventSourceRef.current) {
      openCodeEventSourceRef.current.close();
    }

    setOpenCodeInstallState({
      isInstalling: true,
      stage: '准备安装...',
      progress: 0,
      logs: [],
      result: null,
      error: null,
    });

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    const eventSource = new EventSource(`${apiBaseUrl}/setup/opencode/install/stream`);
    openCodeEventSourceRef.current = eventSource;

    eventSource.addEventListener('opencode.stage', (e) => {
      const data = JSON.parse(e.data);
      setOpenCodeInstallState((prev) => ({
        ...prev,
        stage: data.stage,
        progress: data.progress || prev.progress,
      }));
    });

    eventSource.addEventListener('opencode.log', (e) => {
      const data = JSON.parse(e.data);
      // 运行时校验：只接受包含有效日志字段的事件
      if (isValidLogEvent(data)) {
        setOpenCodeInstallState((prev) => ({
          ...prev,
          logs: [...prev.logs, extractLogMessage(data)],
        }));
      } else {
        console.warn('[OpenCode Install] 收到无效日志事件，已忽略:', data);
      }
    });

    eventSource.addEventListener('opencode.complete', (e) => {
      const data = JSON.parse(e.data);
      setOpenCodeInstallState((prev) => ({
        ...prev,
        isInstalling: false,
        stage: '安装完成',
        progress: 100,
        result: data,
      }));
      eventSource.close();
      openCodeEventSourceRef.current = null;
    });

    eventSource.addEventListener('opencode.error', (e) => {
      const data = JSON.parse(e.data);
      setOpenCodeInstallState((prev) => ({
        ...prev,
        isInstalling: false,
        error: data.error,
      }));
      eventSource.close();
      openCodeEventSourceRef.current = null;
    });

    eventSource.onerror = () => {
      setOpenCodeInstallState((prev) => ({
        ...prev,
        isInstalling: false,
        error: '连接中断，请检查网络或重试',
      }));
      eventSource.close();
      openCodeEventSourceRef.current = null;
    };
  };

  const [showOpenClawEnvCheck, setShowOpenClawEnvCheck] = useState(false);
  const [showOpenCodeEnvCheck, setShowOpenCodeEnvCheck] = useState(false);
  const [envCheckResult, setEnvCheckResult] = useState<EnvironmentCheckResponse | null>(null);

  // 页面加载时自动执行环境检查
  useEffect(() => {
    checkEnvironmentMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const listModelsMutation = useMutation({
    mutationFn: async () =>
      apiPost<
        ListModelsResult,
        {
          provider: QuickSetupFormState['modelProvider'];
          apiKey: string;
          baseUrl?: string;
        }
      >('/setup/models/list', {
        provider: quickForm.modelProvider,
        apiKey: quickForm.modelApiKey,
        baseUrl: quickForm.modelBaseUrl.trim() || undefined,
      }),
    onSuccess: (data) => {
      setModelOptions(data.models);
      if (!quickForm.defaultModel && data.models[0]) {
        updateQuickForm('defaultModel', data.models[0].id);
      }
      setYamlError(null);
      setPreviewHint(`已获取 ${data.models.length} 个模型，请选择默认模型。`);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '模型列表获取失败';
      setYamlError(message);
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
      // 运行时校验：只接受包含有效 message 字段的日志事件
      if (event.data && typeof event.data === 'object' && 'message' in event.data) {
        const message = (event.data as { message: unknown }).message;
        if (isValidLogMessage(message)) {
          setLogs((prev) => [...prev, message]);
        } else {
          console.warn('[Setup Run] 收到无效日志消息，已忽略:', event.data);
        }
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

  const isAnyDeploying = 
    openClawDeployState.isDeploying ||
    openCodeInstallState.isInstalling;

  const openClawUrl = runDetail?.context?.openClawUrl;
  const openClawDeployFailed = Boolean(runDetail?.context?.openClawDeployFailed);

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
    setQuickForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'modelProvider') {
        next.modelApiKeyEnv = value === 'anthropic' ? 'ANTHROPIC_API_KEY' : value === 'custom' ? 'MODEL_API_KEY' : 'OPENAI_API_KEY';
        next.defaultModel = '';
      }
      return next;
    });
    if (key === 'modelProvider' || key === 'modelBaseUrl') {
      setModelOptions([]);
    }
  };

  const handleFetchModels = async () => {
    if (quickForm.promptEngineMode === 'template') {
      setYamlError('模板模式不需要获取模型列表');
      return;
    }
    if (quickForm.modelApiKey.trim().length === 0) {
      setYamlError('请先填写模型 API Key，再获取模型列表');
      return;
    }
    if (quickForm.modelProvider === 'custom' && quickForm.modelBaseUrl.trim().length === 0) {
      setYamlError('自定义模型供应商必须填写 Base URL');
      return;
    }
    await listModelsMutation.mutateAsync();
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
          disabled={isOpenClawOnline || isRunning || startMutation.isPending}
          className="inline-flex items-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
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

          {openClawUrl ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">📋 下一步：配置 OpenClaw</div>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
                <li>
                  访问 OpenClaw UI：
                  <a
                    href={openClawUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 break-all font-medium text-slate-900 underline underline-offset-2 hover:text-slate-700"
                  >
                    {openClawUrl}
                  </a>
                </li>
                <li>完成 Onboarding 流程（创建账号、配置 Webhook、生成 Token）。</li>
                <li>
                  更新 clawkit 配置：将 OpenClaw 的 URL / Token 写入 <code className="rounded bg-slate-100 px-1 py-0.5">~/.openclaw/openclaw.json</code>。
                </li>
              </ol>
              <div className="mt-3 text-xs leading-5 text-slate-500">
                提示：Token 属于敏感信息，请避免在日志或截图中泄露。
              </div>
            </div>
          ) : null}

          {openClawDeployFailed ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 ring-1 ring-amber-600/10">
              <div className="text-sm font-semibold">⚠️ OpenClaw 部署失败</div>
              <div className="mt-2 text-sm leading-relaxed">
                该问题通常不会影响 Controller / Worker 的启动与使用；你可以先继续验证主链路，再单独处理 OpenClaw。
              </div>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
                <li>查看日志：展开“实时日志”或失败步骤的“步骤日志”，定位具体错误原因。</li>
                <li>手动运行 docker compose：在部署目录执行 compose 启动（确保 Docker 正常运行并可拉取镜像）。</li>
                <li>切换到 external 模式：回到“一键配置”中选择“使用外部服务”，改用已部署的 OpenClaw 实例。</li>
              </ul>
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
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="text-sm font-semibold text-slate-900">尚未启动配置流程</div>
            <div className="mt-1 text-sm text-slate-600">点击右上角"一键配置"，填写必要信息后确认执行。</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">或单独配置组件</div>
            <div className="mt-1 text-sm text-slate-600">如果你已经有部分服务运行，可以单独配置 OpenClaw 或 OpenCode。</div>
            
            {envCheckResult && envCheckResult.overall !== 'pass' ? (
              <div className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
                envCheckResult.overall === 'warn' 
                  ? 'border-amber-200 bg-amber-50 text-amber-800' 
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}>
                <div className="font-semibold">
                  {envCheckResult.overall === 'warn' ? '⚠️ 环境检查发现警告' : '❌ 环境检查未通过'}
                </div>
                <ul className="mt-2 space-y-1 pl-4 list-disc">
                  {envCheckResult.checks
                    .filter((check) => check.status !== 'pass')
                    .map((check, index) => (
                      <li key={index}>
                        {check.name}: {check.message}
                        {check.suggestion ? ` (${check.suggestion})` : ''}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
            
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">OpenClaw</div>
                    <div className="mt-1 text-xs text-slate-600">部署或连接 OpenClaw 服务</div>
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  {isOpenClawOnline ? (
                    <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">OpenClaw 服务已在线，无需部署</span>
                      </div>
                    </div>
                  ) : !openClawDeployState.result ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setShowOpenClawEnvCheck(false);
                          startOpenClawDeploy();
                        }}
                        disabled={isAnyDeploying}
                        className="w-full rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {openClawDeployState.isDeploying ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            部署中...
                          </span>
                        ) : (
                          '一键部署 OpenClaw'
                        )}
                      </button>

                      {!showOpenClawEnvCheck && !openClawDeployState.isDeploying && !openClawDeployState.error ? (
                        <button
                          type="button"
                          onClick={() => setShowOpenClawEnvCheck(!showOpenClawEnvCheck)}
                          className="text-xs text-slate-500 hover:text-slate-700 underline"
                        >
                          部署前检查清单
                        </button>
                      ) : null}
                    </>
                  ) : null}

                  {showOpenClawEnvCheck ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                      <div className="font-semibold">📋 部署前请确认：</div>
                      <ul className="mt-2 space-y-1 pl-4 list-disc">
                        <li>Docker 服务已启动（sudo systemctl start docker）</li>
                        <li>当前用户有 Docker 权限（docker ps 可正常执行）</li>
                        <li>端口 18000 未被占用</li>
                        <li>网络连接正常（可访问镜像仓库）</li>
                      </ul>
                      <button
                        type="button"
                        onClick={() => setShowOpenClawEnvCheck(false)}
                        className="mt-2 text-blue-600 hover:text-blue-800 underline"
                      >
                        收起
                      </button>
                    </div>
                  ) : null}

                  {openClawDeployState.isDeploying ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <div className="font-semibold">⏳ 部署进行中</div>
                      {openClawDeployState.stage ? (
                        <div className="mt-1 font-medium">{openClawDeployState.stage}</div>
                      ) : null}
                      {openClawDeployState.progress > 0 ? (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span>进度</span>
                            <span>{openClawDeployState.progress}%</span>
                          </div>
                          <div className="h-1.5 bg-amber-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-amber-600 transition-all duration-300"
                              style={{ width: `${openClawDeployState.progress}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                      {openClawDeployState.logs.length > 0 ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer font-medium text-amber-700 hover:text-amber-900">
                            查看实时日志 ({openClawDeployState.logs.length} 条)
                          </summary>
                          <div className="mt-2 max-h-48 overflow-y-auto bg-amber-100 rounded p-2">
                            {openClawDeployState.logs.map((log, idx) => (
                              <div key={idx} className="text-[11px] text-amber-900 font-mono">
                                {log}
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  ) : null}

                  {openClawDeployState.result ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      <div className="font-semibold">✓ {openClawDeployState.result.message}</div>
                      {openClawDeployState.result.openClawUrl ? (
                        <div className="mt-1">
                          服务地址：
                          <a
                            href={openClawDeployState.result.openClawUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-1 font-medium underline"
                          >
                            {openClawDeployState.result.openClawUrl}
                          </a>
                        </div>
                      ) : null}
                      {openClawDeployState.result.healthCheckPassed ? (
                        <div className="mt-1 text-emerald-700">✓ 健康检查通过</div>
                      ) : null}
                      <a href="/setup/openclaw" className="mt-2 inline-block font-medium underline">
                        前往配置 →
                      </a>
                    </div>
                  ) : null}

                  {openClawDeployState.error ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                      <div className="font-semibold">✗ 部署失败</div>
                      <div className="mt-1">{openClawDeployState.error}</div>
                      {openClawDeployState.logs.length > 0 ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer font-medium text-rose-700 hover:text-rose-900">
                            查看详细日志
                          </summary>
                          <div className="mt-2 max-h-48 overflow-y-auto bg-rose-100 rounded p-2">
                            {openClawDeployState.logs.map((log, idx) => (
                              <div key={idx} className="text-[11px] text-rose-900 font-mono">
                                {log}
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => startOpenClawDeploy()}
                        className="mt-2 text-rose-700 hover:text-rose-900 underline font-medium"
                      >
                        重试
                      </button>
                    </div>
                  ) : null}

                  <a
                    href="/setup/openclaw"
                    className="text-center text-xs text-slate-600 underline hover:text-slate-900"
                  >
                    手动配置
                  </a>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">OpenCode</div>
                    <div className="mt-1 text-xs text-slate-600">安装或连接 OpenCode 服务</div>
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  {!openCodeInstallState.result ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setShowOpenCodeEnvCheck(false);
                          startOpenCodeInstall();
                        }}
                        disabled={isAnyDeploying}
                        className="w-full rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {openCodeInstallState.isInstalling ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            安装中...
                          </span>
                        ) : (
                          '一键安装 OpenCode'
                        )}
                      </button>

                      {!showOpenCodeEnvCheck && !openCodeInstallState.isInstalling && !openCodeInstallState.error ? (
                        <button
                          type="button"
                          onClick={() => setShowOpenCodeEnvCheck(!showOpenCodeEnvCheck)}
                          className="text-xs text-slate-500 hover:text-slate-700 underline"
                        >
                          安装前检查清单
                        </button>
                      ) : null}
                    </>
                  ) : null}

                  {showOpenCodeEnvCheck ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                      <div className="font-semibold">📋 安装前请确认：</div>
                      <ul className="mt-2 space-y-1 pl-4 list-disc">
                        <li>系统已安装 curl 和 bash</li>
                        <li>端口 4096 未被占用</li>
                        <li>网络连接正常（可访问 opencode.ai）</li>
                        <li>有足够的磁盘空间（至少 500MB）</li>
                      </ul>
                      <button
                        type="button"
                        onClick={() => setShowOpenCodeEnvCheck(false)}
                        className="mt-2 text-blue-600 hover:text-blue-800 underline"
                      >
                        收起
                      </button>
                    </div>
                  ) : null}

                  {openCodeInstallState.isInstalling ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                      <div className="font-semibold">⏳ 安装进行中</div>
                      {openCodeInstallState.stage ? (
                        <div className="mt-1 font-medium">{openCodeInstallState.stage}</div>
                      ) : null}
                      {openCodeInstallState.progress > 0 ? (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span>进度</span>
                            <span>{openCodeInstallState.progress}%</span>
                          </div>
                          <div className="h-1.5 bg-blue-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-600 transition-all duration-300"
                              style={{ width: `${openCodeInstallState.progress}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                      {openCodeInstallState.logs.length > 0 ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer font-medium text-blue-700 hover:text-blue-900">
                            查看实时日志 ({openCodeInstallState.logs.length} 条)
                          </summary>
                          <div className="mt-2 max-h-48 overflow-y-auto bg-blue-100 rounded p-2">
                            {openCodeInstallState.logs.map((log, idx) => (
                              <div key={idx} className="text-[11px] text-blue-900 font-mono">
                                {log}
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  ) : null}

                  {openCodeInstallState.result ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      <div className="font-semibold">✓ {openCodeInstallState.result.message}</div>
                      {openCodeInstallState.result.binaryPath ? (
                        <div className="mt-1">安装路径：{openCodeInstallState.result.binaryPath}</div>
                      ) : null}
                      {openCodeInstallState.result.openCodeUrl ? (
                        <div className="mt-1">
                          服务地址：
                          <a
                            href={openCodeInstallState.result.openCodeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-1 font-medium underline"
                          >
                            {openCodeInstallState.result.openCodeUrl}
                          </a>
                        </div>
                      ) : null}
                      <a href="/setup/opencode" className="mt-2 inline-block font-medium underline">
                        前往配置 →
                      </a>
                    </div>
                  ) : null}

                  {openCodeInstallState.error ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                      <div className="font-semibold">✗ 安装失败</div>
                      <div className="mt-1">{openCodeInstallState.error}</div>
                      {openCodeInstallState.logs.length > 0 ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer font-medium text-rose-700 hover:text-rose-900">
                            查看详细日志
                          </summary>
                          <div className="mt-2 max-h-40 overflow-y-auto rounded bg-rose-100 p-2 font-mono text-[10px] text-rose-900">
                            {openCodeInstallState.logs.map((log, idx) => (
                              <div key={idx} className="whitespace-pre-wrap">
                                {log}
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}
                      <button
                        type="button"
                        onClick={startOpenCodeInstall}
                        className="mt-2 inline-block rounded bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700"
                      >
                        重试安装
                      </button>
                    </div>
                  ) : null}

                  <a
                    href="/setup/opencode"
                    className="text-center text-xs text-slate-600 underline hover:text-slate-900"
                  >
                    手动配置
                  </a>
                </div>
              </div>
            </div>
          </div>
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
        modelOptions={modelOptions}
        onFetchModels={handleFetchModels}
        isFetchingModels={listModelsMutation.isPending}
        onCheckQuickProfile={handleCheckQuickProfile}
        isCompilePending={compileMutation.isPending}
        isPreviewPending={previewMutation.isPending}
        isStartPending={startMutation.isPending}
        onExecute={() => startMutation.mutate()}
        startErrorMessage={startErrorMessage}
        isOpenClawOnline={isOpenClawOnline}
      />
    </section>
  );
}
