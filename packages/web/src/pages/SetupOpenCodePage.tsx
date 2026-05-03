import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ErrorNotice, InfoNotice } from '../components/ui/Notice';
import { apiPost } from '../lib/api';

type InstallMode = 'local' | 'external' | 'skip';

interface ConfigureRequest {
  installMode: InstallMode;
  serverUrl?: string;
}

interface ConfigureResponse {
  success: boolean;
  message: string;
  details?: string;
  openCodeUrl?: string;
  binaryPath?: string;
}

export function SetupOpenCodePage(): JSX.Element {
  const navigate = useNavigate();
  const [installMode, setInstallMode] = useState<InstallMode>('local');
  const [serverUrl, setServerUrl] = useState<string>('http://localhost:4096');

  const configureMutation = useMutation({
    mutationFn: async (request: ConfigureRequest) =>
      apiPost<ConfigureResponse, ConfigureRequest>('/setup/opencode/configure', request),
    onSuccess: (data) => {
      if (data.success) {
        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const request: ConfigureRequest = {
      installMode,
    };

    if (installMode === 'external') {
      if (!serverUrl.trim()) {
        configureMutation.reset();
        return;
      }
      request.serverUrl = serverUrl.trim();
    }

    configureMutation.mutate(request);
  };

  const isSubmitting = configureMutation.isPending;
  const error = configureMutation.error;
  const result = configureMutation.data;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">OpenCode 配置</h1>
          <div className="mt-1 text-sm text-slate-600">配置 OpenCode 服务的安装模式和连接信息。</div>
        </div>
        <Link
          to="/"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          返回总览
        </Link>
      </div>

      {error ? (
        <ErrorNotice message={error instanceof Error ? error.message : '配置失败'} />
      ) : null}

      {result?.success ? (
        <InfoNotice
          title="配置成功"
          message={result.message + (result.details ? ` ${result.details}` : '')}
        />
      ) : null}

      <Card title="安装模式选择">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setInstallMode('local')}
              className={[
                'rounded-lg border-2 p-4 text-left transition-all',
                installMode === 'local'
                  ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-600/20'
                  : 'border-slate-200 bg-white hover:border-slate-300',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">本地安装</div>
                {installMode === 'local' ? <Badge tone="success">已选择</Badge> : null}
              </div>
              <div className="mt-2 text-xs text-slate-600">
                自动下载并安装 OpenCode 二进制文件
              </div>
            </button>

            <button
              type="button"
              onClick={() => setInstallMode('external')}
              className={[
                'rounded-lg border-2 p-4 text-left transition-all',
                installMode === 'external'
                  ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-600/20'
                  : 'border-slate-200 bg-white hover:border-slate-300',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">外部服务</div>
                {installMode === 'external' ? <Badge tone="success">已选择</Badge> : null}
              </div>
              <div className="mt-2 text-xs text-slate-600">
                使用已安装的 OpenCode 服务
              </div>
            </button>

            <button
              type="button"
              onClick={() => setInstallMode('skip')}
              className={[
                'rounded-lg border-2 p-4 text-left transition-all',
                installMode === 'skip'
                  ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-600/20'
                  : 'border-slate-200 bg-white hover:border-slate-300',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">跳过配置</div>
                {installMode === 'skip' ? <Badge tone="success">已选择</Badge> : null}
              </div>
              <div className="mt-2 text-xs text-slate-600">
                暂不配置 OpenCode（可稍后配置）
              </div>
            </button>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit}>
        {installMode === 'local' ? (
          <Card title="本地安装配置">
            <InfoNotice
              title="本地安装说明"
              message="系统将自动下载 OpenCode 二进制文件并启动服务。安装过程可能需要几分钟，请耐心等待。"
            />
          </Card>
        ) : null}

        {installMode === 'external' ? (
          <Card title="外部服务配置">
            <div className="space-y-4">
              <div>
                <label htmlFor="serverUrl" className="block text-sm font-medium text-slate-700">
                  服务地址 <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  id="serverUrl"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://localhost:4096"
                  required
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <div className="mt-1 text-xs text-slate-500">
                  已安装的 OpenCode 服务的完整 URL
                </div>
              </div>

              <InfoNotice
                title="外部服务说明"
                message="系统将验证外部 OpenCode 服务的可达性。请确保服务地址正确且网络可访问。"
              />
            </div>
          </Card>
        ) : null}

        {installMode === 'skip' ? (
          <Card title="跳过配置">
            <InfoNotice
              title="跳过说明"
              message="您可以稍后在总览页或配置页重新配置 OpenCode 服务。跳过配置后，任务执行将使用 placeholder 模式。"
            />
          </Card>
        ) : null}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                配置中…
              </>
            ) : (
              '确认配置'
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
