import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ErrorNotice, InfoNotice } from '../components/ui/Notice';
import { apiPost } from '../lib/api';

type DeployMode = 'local' | 'external' | 'skip';

interface ConfigureRequest {
  deployMode: DeployMode;
  publicUrl?: string;
  apiKey?: string;
}

interface ConfigureResponse {
  success: boolean;
  message: string;
  details?: string;
}

export function SetupOpenClawPage(): JSX.Element {
  const navigate = useNavigate();
  const [deployMode, setDeployMode] = useState<DeployMode>('local');
  const [publicUrl, setPublicUrl] = useState<string>('http://localhost:18000');
  const [apiKey, setApiKey] = useState<string>('');

  const configureMutation = useMutation({
    mutationFn: async (request: ConfigureRequest) =>
      apiPost<ConfigureResponse, ConfigureRequest>('/setup/openclaw/configure', request),
    onSuccess: (data) => {
      if (data.success) {
        // 配置成功，跳转到总览页
        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const request: ConfigureRequest = {
      deployMode,
    };

    if (deployMode === 'external') {
      if (!publicUrl.trim()) {
        configureMutation.reset();
        return;
      }
      request.publicUrl = publicUrl.trim();
      request.apiKey = apiKey.trim() || undefined;
    } else if (deployMode === 'local') {
      request.publicUrl = publicUrl.trim() || undefined;
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
          <h1 className="text-2xl font-semibold">OpenClaw 配置</h1>
          <div className="mt-1 text-sm text-slate-600">配置 OpenClaw 服务的部署模式和连接信息。</div>
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

      {result && !result.success ? (
        <ErrorNotice
          title="配置失败"
          message={result.message + (result.details ? `\n\n详细信息：\n${result.details}` : '')}
        />
      ) : null}

      <Card title="部署模式选择">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setDeployMode('local')}
              className={[
                'rounded-lg border-2 p-4 text-left transition-all',
                deployMode === 'local'
                  ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-600/20'
                  : 'border-slate-200 bg-white hover:border-slate-300',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">本地部署</div>
                {deployMode === 'local' ? <Badge tone="success">已选择</Badge> : null}
              </div>
              <div className="mt-2 text-xs text-slate-600">
                在本地通过 Docker 部署 OpenClaw 服务
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDeployMode('external')}
              className={[
                'rounded-lg border-2 p-4 text-left transition-all',
                deployMode === 'external'
                  ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-600/20'
                  : 'border-slate-200 bg-white hover:border-slate-300',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">外部服务</div>
                {deployMode === 'external' ? <Badge tone="success">已选择</Badge> : null}
              </div>
              <div className="mt-2 text-xs text-slate-600">
                使用已部署的 OpenClaw 服务
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDeployMode('skip')}
              className={[
                'rounded-lg border-2 p-4 text-left transition-all',
                deployMode === 'skip'
                  ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-600/20'
                  : 'border-slate-200 bg-white hover:border-slate-300',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">跳过配置</div>
                {deployMode === 'skip' ? <Badge tone="success">已选择</Badge> : null}
              </div>
              <div className="mt-2 text-xs text-slate-600">
                暂不配置 OpenClaw（可稍后配置）
              </div>
            </button>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit}>
        {deployMode === 'local' ? (
          <Card title="本地部署配置">
            <div className="space-y-4">
              <div>
                <label htmlFor="publicUrl" className="block text-sm font-medium text-slate-700">
                  公开地址（可选）
                </label>
                <input
                  type="text"
                  id="publicUrl"
                  value={publicUrl}
                  onChange={(e) => setPublicUrl(e.target.value)}
                  placeholder="http://localhost:18000"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <div className="mt-1 text-xs text-slate-500">
                  OpenClaw 服务的访问地址，默认为 http://localhost:18000
                </div>
              </div>

              <InfoNotice
                title="本地部署说明"
                message="系统将通过 Docker Compose 在本地启动 OpenClaw 服务。请确保 Docker 已安装并正常运行。"
              />
            </div>
          </Card>
        ) : null}

        {deployMode === 'external' ? (
          <Card title="外部服务配置">
            <div className="space-y-4">
              <div>
                <label htmlFor="externalUrl" className="block text-sm font-medium text-slate-700">
                  服务地址 <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  id="externalUrl"
                  value={publicUrl}
                  onChange={(e) => setPublicUrl(e.target.value)}
                  placeholder="https://openclaw.example.com"
                  required
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <div className="mt-1 text-xs text-slate-500">
                  已部署的 OpenClaw 服务的完整 URL
                </div>
              </div>

              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-slate-700">
                  API Key（可选）
                </label>
                <input
                  type="password"
                  id="apiKey"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="输入 API Key"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <div className="mt-1 text-xs text-slate-500">
                  如果外部服务需要认证，请填写 API Key
                </div>
              </div>

              <InfoNotice
                title="外部服务说明"
                message="系统将验证外部 OpenClaw 服务的可达性。请确保服务地址正确且网络可访问。"
              />
            </div>
          </Card>
        ) : null}

        {deployMode === 'skip' ? (
          <Card title="跳过配置">
            <InfoNotice
              title="跳过说明"
              message="您可以稍后在总览页或配置页重新配置 OpenClaw 服务。跳过配置不会影响 Controller 和 Worker 的正常运行。"
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
