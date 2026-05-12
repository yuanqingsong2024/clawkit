import type { QuickSetupFormState, SetupInputMode, ValidationIssue } from '../lib/setup-wizard-types';

import { Badge } from './ui/Badge';
import { CodeBlock } from './ui/CodeBlock';
import { ErrorNotice, InfoNotice } from './ui/Notice';
import { Modal } from './ui/Modal';

interface ModelSummary {
  id: string;
  label: string;
}

function inputClassName(hasError: boolean): string {
  return [
    'mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition',
    hasError
      ? 'border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
      : 'border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200',
  ].join(' ');
}

function labelClassName(): string {
  return 'text-sm font-medium text-slate-900';
}

function requiredMark(): JSX.Element {
  return (
    <span className="ml-1 align-middle text-xs font-semibold text-rose-600" aria-hidden="true">
      *
    </span>
  );
}

function fieldErrorText(message: string | null): JSX.Element | null {
  if (!message) return null;
  return <div className="mt-1 text-xs text-rose-700">{message}</div>;
}

function findIssue(issues: ValidationIssue[], key: string): ValidationIssue | undefined {
  return issues.find((item) => item.key === key);
}

export interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  inputMode: SetupInputMode;
  onSwitchToQuickMode: () => void;
  onSwitchToYamlMode: () => Promise<void>;

  quickForm: QuickSetupFormState;
  quickIssues: ValidationIssue[];
  formatIssueMessage: (message: string) => string;
  isRunning: boolean;
  usesRemoteControl: boolean;

  manifestYaml: string;
  yamlError: string | null;
  previewHint: string | null;

  onUpdateQuickForm: <K extends keyof QuickSetupFormState>(key: K, value: QuickSetupFormState[K]) => void;
  onUpdateManifestYaml: (yamlText: string) => void;
  onClearYamlError: () => void;
  modelOptions: ModelSummary[];
  onFetchModels: () => Promise<void>;
  isFetchingModels: boolean;

  onCheckQuickProfile: () => Promise<void>;

  isCompilePending: boolean;
  isPreviewPending: boolean;
  isStartPending: boolean;
  onExecute: () => void;

  startErrorMessage: string | null;
  isOpenClawOnline?: boolean;
}

export function ConfigModal(props: ConfigModalProps): JSX.Element {
  const quickIssueText = (key: string): string | null => {
    const issue = findIssue(props.quickIssues, key);
    return issue ? props.formatIssueMessage(issue.message) : null;
  };

  const isBusy = props.isRunning || props.isCompilePending || props.isPreviewPending || props.isStartPending;

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="一键配置" size="xl">
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-slate-900">输入模式</div>
            <Badge tone="info">{props.inputMode === 'quick' ? 'Quick' : 'YAML'}</Badge>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={props.onSwitchToQuickMode}
              disabled={isBusy}
              className={[
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                props.inputMode === 'quick' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                isBusy ? 'cursor-not-allowed opacity-60' : '',
              ].join(' ')}
            >
              Quick
            </button>
            <button
              type="button"
              onClick={() => void props.onSwitchToYamlMode()}
              disabled={isBusy}
              className={[
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                props.inputMode === 'yaml' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                isBusy ? 'cursor-not-allowed opacity-60' : '',
              ].join(' ')}
            >
              YAML
            </button>
          </div>
        </div>

        {props.previewHint ? <InfoNotice title="配置检查" message={props.previewHint} /> : null}
        {props.startErrorMessage ? <ErrorNotice message={props.startErrorMessage} /> : null}
        {props.yamlError ? <ErrorNotice message={props.yamlError} /> : null}
        {props.inputMode === 'quick' && props.quickIssues.length > 0 ? (
          <ErrorNotice
            title="表单校验"
            message={props.quickIssues.map((item) => `- ${props.formatIssueMessage(item.message)}`).join('\n')}
          />
        ) : null}

        {props.inputMode === 'quick' ? (
          <div className="space-y-4">
            <InfoNotice
              message={
                props.quickForm.mode === 'hybrid'
                  ? 'hybrid 模式将使用远程控制面（SSH）执行 controller 写入与检查，本地执行 worker/OpenCode。'
                  : 'all-in-one 模式将在本机完成部署文件写入与检查。'
              }
            />

            <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
              <legend className="px-2 text-sm font-semibold text-slate-900">基础配置</legend>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <label>
                  <div className={labelClassName()}>
                    部署方式{requiredMark()}
                  </div>
                  <select
                    className={inputClassName(Boolean(quickIssueText('mode')))}
                    value={props.quickForm.mode}
                    onChange={(e) => props.onUpdateQuickForm('mode', e.target.value as QuickSetupFormState['mode'])}
                    disabled={isBusy}
                  >
                    <option value="all-in-one">all-in-one</option>
                    <option value="hybrid">hybrid</option>
                  </select>
                  {fieldErrorText(quickIssueText('mode'))}
                </label>

                <label>
                  <div className={labelClassName()}>
                    配置名称{requiredMark()}
                  </div>
                  <input
                    className={inputClassName(Boolean(quickIssueText('name')))}
                    value={props.quickForm.name}
                    onChange={(e) => props.onUpdateQuickForm('name', e.target.value)}
                    disabled={isBusy}
                  />
                  {fieldErrorText(quickIssueText('name'))}
                </label>
              </div>
            </fieldset>

            <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
              <legend className="px-2 text-sm font-semibold text-slate-900">项目配置</legend>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <label>
                  <div className={labelClassName()}>
                    项目 key{requiredMark()}
                  </div>
                  <input
                    className={inputClassName(Boolean(quickIssueText('projectKey')))}
                    value={props.quickForm.projectKey}
                    onChange={(e) => props.onUpdateQuickForm('projectKey', e.target.value)}
                    disabled={isBusy}
                  />
                  {fieldErrorText(quickIssueText('projectKey'))}
                </label>

                <label>
                  <div className={labelClassName()}>
                    仓库路径{requiredMark()}
                  </div>
                  <input
                    className={inputClassName(Boolean(quickIssueText('repoPath')))}
                    value={props.quickForm.repoPath}
                    onChange={(e) => props.onUpdateQuickForm('repoPath', e.target.value)}
                    disabled={isBusy}
                    placeholder="例如：. 或 /path/to/repo"
                  />
                  {fieldErrorText(quickIssueText('repoPath'))}
                </label>
              </div>
            </fieldset>

            <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
              <legend className="px-2 text-sm font-semibold text-slate-900">服务配置</legend>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <div className={labelClassName()}>OpenClaw 部署方式</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {(
                      [
                        {
                          value: 'local' as const,
                          title: '本地部署',
                          desc: '通过 Docker 自动部署 OpenClaw（需要 Docker 环境）',
                        },
                        {
                          value: 'external' as const,
                          title: '使用外部服务',
                          desc: '使用已部署的 OpenClaw 实例（需要提供 URL 和 API Key）',
                        },
                        {
                          value: 'skip' as const,
                          title: '暂时跳过',
                          desc: '稍后手动配置 OpenClaw',
                        },
                      ]
                    ).map((item) => {
                      const checked = props.quickForm.openClawDeployMode === item.value;
                      return (
                        <label
                          key={item.value}
                          className={[
                            'flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors',
                            checked ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white hover:bg-slate-50',
                            isBusy ? 'cursor-not-allowed opacity-60' : '',
                          ].join(' ')}
                        >
                          <input
                            type="radio"
                            name="openclaw-deploy-mode"
                            className="mt-0.5"
                            disabled={isBusy}
                            checked={checked}
                            onChange={() => props.onUpdateQuickForm('openClawDeployMode', item.value)}
                          />
                          <div>
                            <div className="text-sm font-medium text-slate-900">{item.title}</div>
                            <div className="mt-0.5 text-xs leading-5 text-slate-600">{item.desc}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {props.quickForm.openClawDeployMode === 'local' ? (
                    <div className="mt-2">
                      <InfoNotice message="提示：本地部署会尝试拉起 Docker Compose；请确保 Docker 正常运行，并允许拉取镜像。" />
                    </div>
                  ) : null}
                </div>

                <label>
                  <div className={labelClassName()}>
                    OpenClaw 地址{requiredMark()}
                  </div>
                  <input
                    className={inputClassName(Boolean(quickIssueText('publicUrl')))}
                    value={props.quickForm.publicUrl}
                    onChange={(e) => props.onUpdateQuickForm('publicUrl', e.target.value)}
                    disabled={isBusy}
                    placeholder="http://127.0.0.1:18000"
                  />
                  {fieldErrorText(quickIssueText('publicUrl'))}
                </label>

                <label>
                  <div className={labelClassName()}>
                    Worker ID{requiredMark()}
                  </div>
                  <input
                    className={inputClassName(Boolean(quickIssueText('workerId')))}
                    value={props.quickForm.workerId}
                    onChange={(e) => props.onUpdateQuickForm('workerId', e.target.value)}
                    disabled={isBusy}
                    placeholder="local-worker"
                  />
                  {fieldErrorText(quickIssueText('workerId'))}
                </label>

                <label>
                  <div className={labelClassName()}>
                    OpenCode 端口{requiredMark()}
                  </div>
                  <input
                    className={inputClassName(Boolean(quickIssueText('opencodePort')))}
                    value={props.quickForm.opencodePort}
                    onChange={(e) => props.onUpdateQuickForm('opencodePort', e.target.value)}
                    disabled={isBusy}
                    inputMode="numeric"
                    placeholder="4096"
                  />
                  {fieldErrorText(quickIssueText('opencodePort'))}
                </label>
              </div>
            </fieldset>

            <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
              <legend className="px-2 text-sm font-semibold text-slate-900">模型配置</legend>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <label>
                  <div className={labelClassName()}>Prompt 引擎模式</div>
                  <select
                    className={inputClassName(Boolean(quickIssueText('promptEngineMode')))}
                    value={props.quickForm.promptEngineMode}
                    onChange={(e) => props.onUpdateQuickForm('promptEngineMode', e.target.value as QuickSetupFormState['promptEngineMode'])}
                    disabled={isBusy}
                  >
                    <option value="template">template（默认模板）</option>
                    <option value="llm">llm（大模型）</option>
                    <option value="hybrid">hybrid（混合）</option>
                  </select>
                  {fieldErrorText(quickIssueText('promptEngineMode'))}
                </label>

                <label>
                  <div className={labelClassName()}>模型供应商</div>
                  <select
                    className={inputClassName(Boolean(quickIssueText('modelProvider')))}
                    value={props.quickForm.modelProvider}
                    onChange={(e) => props.onUpdateQuickForm('modelProvider', e.target.value as QuickSetupFormState['modelProvider'])}
                    disabled={isBusy}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="custom">自定义 OpenAI-compatible</option>
                  </select>
                  {fieldErrorText(quickIssueText('modelProvider'))}
                </label>

                <label>
                  <div className={labelClassName()}>模型 Base URL</div>
                  <input
                    className={inputClassName(Boolean(quickIssueText('modelBaseUrl')))}
                    value={props.quickForm.modelBaseUrl}
                    onChange={(e) => props.onUpdateQuickForm('modelBaseUrl', e.target.value)}
                    disabled={isBusy}
                    placeholder={props.quickForm.modelProvider === 'custom' ? 'https://api.example.com' : '默认使用供应商官方地址'}
                  />
                  {fieldErrorText(quickIssueText('modelBaseUrl'))}
                </label>

                <label>
                  <div className={labelClassName()}>API Key 环境变量</div>
                  <input
                    className={inputClassName(Boolean(quickIssueText('modelApiKeyEnv')))}
                    value={props.quickForm.modelApiKeyEnv}
                    onChange={(e) => props.onUpdateQuickForm('modelApiKeyEnv', e.target.value)}
                    disabled={isBusy}
                    placeholder="OPENAI_API_KEY"
                  />
                  {fieldErrorText(quickIssueText('modelApiKeyEnv'))}
                </label>

                <label>
                  <div className={labelClassName()}>API Key（仅用于获取模型）</div>
                  <input
                    type="password"
                    className={inputClassName(Boolean(quickIssueText('modelApiKey')))}
                    value={props.quickForm.modelApiKey}
                    onChange={(e) => props.onUpdateQuickForm('modelApiKey', e.target.value)}
                    disabled={isBusy}
                    placeholder="不会写入 manifest"
                  />
                  {fieldErrorText(quickIssueText('modelApiKey'))}
                </label>

                <label>
                  <div className={labelClassName()}>默认模型</div>
                  <input
                    className={inputClassName(Boolean(quickIssueText('defaultModel')))}
                    list="setup-model-options"
                    value={props.quickForm.defaultModel}
                    onChange={(e) => props.onUpdateQuickForm('defaultModel', e.target.value)}
                    disabled={isBusy}
                    placeholder="例如：gpt-4o-mini"
                  />
                  <datalist id="setup-model-options">
                    {props.modelOptions.map((model) => (
                      <option key={model.id} value={model.id}>{model.label}</option>
                    ))}
                  </datalist>
                  {fieldErrorText(quickIssueText('defaultModel'))}
                </label>
              </div>

              <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs leading-5 text-slate-600">
                  API Key 只用于本次获取模型列表；manifest 只保存环境变量名和默认模型，避免明文密钥落盘。
                </div>
                <button
                  type="button"
                  onClick={() => void props.onFetchModels()}
                  disabled={isBusy || props.isFetchingModels}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {props.isFetchingModels ? '获取中...' : '获取模型'}
                </button>
              </div>
            </fieldset>

            {props.usesRemoteControl ? (
              <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
                <legend className="px-2 text-sm font-semibold text-slate-900">远程配置（hybrid）</legend>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <label>
                    <div className={labelClassName()}>
                      SSH 主机{requiredMark()}
                    </div>
                    <input
                      className={inputClassName(Boolean(quickIssueText('remoteHost')))}
                      value={props.quickForm.remoteHost}
                      onChange={(e) => props.onUpdateQuickForm('remoteHost', e.target.value)}
                      disabled={isBusy}
                      placeholder="例如：1.2.3.4"
                    />
                    {fieldErrorText(quickIssueText('remoteHost'))}
                  </label>

                  <label>
                    <div className={labelClassName()}>
                      SSH 用户{requiredMark()}
                    </div>
                    <input
                      className={inputClassName(Boolean(quickIssueText('remoteUser')))}
                      value={props.quickForm.remoteUser}
                      onChange={(e) => props.onUpdateQuickForm('remoteUser', e.target.value)}
                      disabled={isBusy}
                      placeholder="deploy"
                    />
                    {fieldErrorText(quickIssueText('remoteUser'))}
                  </label>

                  <label>
                    <div className={labelClassName()}>
                      SSH 私钥路径{requiredMark()}
                    </div>
                    <input
                      className={inputClassName(Boolean(quickIssueText('remoteKeyPath')))}
                      value={props.quickForm.remoteKeyPath}
                      onChange={(e) => props.onUpdateQuickForm('remoteKeyPath', e.target.value)}
                      disabled={isBusy}
                      placeholder="~/.ssh/id_rsa"
                    />
                    {fieldErrorText(quickIssueText('remoteKeyPath'))}
                  </label>

                  <label>
                    <div className={labelClassName()}>
                      远程工作目录{requiredMark()}
                    </div>
                    <input
                      className={inputClassName(Boolean(quickIssueText('remoteWorkDir')))}
                      value={props.quickForm.remoteWorkDir}
                      onChange={(e) => props.onUpdateQuickForm('remoteWorkDir', e.target.value)}
                      disabled={isBusy}
                      placeholder="/srv/clawkit/control"
                    />
                    {fieldErrorText(quickIssueText('remoteWorkDir'))}
                  </label>
                </div>
              </fieldset>
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900">配置检查与预览</div>
                  <div className="mt-0.5 text-xs text-slate-500">系统会补齐默认值并生成规范化 manifest。</div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void props.onCheckQuickProfile()}
                    disabled={isBusy}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {props.isCompilePending ? '检查中...' : '检查配置'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void props.onSwitchToYamlMode()}
                    disabled={isBusy}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    切到 YAML
                  </button>
                </div>
              </div>

              {props.manifestYaml ? (
                <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white p-3">
                  <CodeBlock>{props.manifestYaml}</CodeBlock>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <InfoNotice message="高级场景（split、自定义 runtime、通知、部署策略）请使用 YAML 模式。" />

            <textarea
              value={props.manifestYaml}
              onChange={(e) => {
                props.onUpdateManifestYaml(e.target.value);
                props.onClearYamlError();
              }}
              disabled={isBusy}
              className="w-full rounded-lg border border-slate-200 p-3 font-mono text-sm disabled:cursor-not-allowed disabled:opacity-60"
              rows={18}
              placeholder="YAML 配置内容..."
            />
          </div>
        )}

        <div className="sticky bottom-0 -mx-5 border-t border-slate-100 bg-white px-5 py-4">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={props.onClose}
              disabled={isBusy}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              取消
            </button>
            <button
              type="button"
              onClick={props.onExecute}
              disabled={
                props.isStartPending ||
                props.isPreviewPending ||
                props.isCompilePending ||
                props.isRunning ||
                props.isOpenClawOnline ||
                (props.inputMode === 'yaml' && !props.manifestYaml.trim())
              }
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {props.isStartPending || props.isPreviewPending || props.isCompilePending ? '执行中...' : '确认并执行'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
