import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ErrorNotice, InfoNotice } from '../components/ui/Notice';
import { apiGet } from '../lib/api';
import { formatDateTime } from '../lib/format';

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
}

interface OverviewData {
  controller: {
    status: 'online' | string;
    publicUrl: string;
    runtimeNotice: string;
  };
  workers: {
    items: WorkerRecord[];
  };
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
  openCode: OpenCodeStatusSummary[];
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

export function StatusPage(): JSX.Element {
  const overviewQuery = useQuery({
    queryKey: ['overview'],
    queryFn: () => apiGet<OverviewData>('/overview'),
  });

  const data = overviewQuery.data;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">状态</h1>
          <div className="mt-1 text-sm text-slate-600">展示 controller、workers、OpenClaw、OpenCode 的当前状态。</div>
        </div>
        <button
          type="button"
          onClick={() => overviewQuery.refetch()}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={overviewQuery.isFetching}
        >
          {overviewQuery.isFetching ? '刷新中…' : '手动刷新'}
        </button>
      </div>

      {overviewQuery.isLoading ? <InfoNotice message="正在加载状态数据…" /> : null}
      {overviewQuery.error ? (
        <ErrorNotice message={overviewQuery.error instanceof Error ? overviewQuery.error.message : '未知错误'} />
      ) : null}

      {data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Controller 状态">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="success">{data.controller.status}</Badge>
                  <span className="text-sm text-slate-700">公开地址：{data.controller.publicUrl || '未配置'}</span>
                </div>
                <InfoNotice title="运行态提示" message={data.controller.runtimeNotice} />
              </div>
            </Card>

            <Card title="OpenClaw 状态">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">地址已配置</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">{data.openClaw.configured ? '是' : '否'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">服务状态</dt>
                  <dd className="mt-1">
                    <Badge tone={toneForServiceStatus(data.openClaw.serviceStatus)}>
                      {labelForServiceStatus(data.openClaw.serviceStatus)}
                    </Badge>
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">公开地址</dt>
                  <dd className="mt-1 break-all text-sm font-medium text-slate-900">{data.openClaw.publicUrl || '未配置'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Token 已配置</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">{data.openClaw.tokenConfigured ? '是' : '否'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">健康检查</dt>
                  <dd className="mt-1 text-sm text-slate-700">{data.openClaw.healthCheckDetail}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">配置说明</dt>
                  <dd className="mt-1 text-sm text-slate-700">{data.openClaw.detail}</dd>
                </div>
              </dl>
            </Card>
          </div>

          <Card title="Workers 列表">
            <div className="overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="py-2 pr-3 font-medium">workerId</th>
                    <th className="py-2 pr-3 font-medium">名称</th>
                    <th className="py-2 pr-3 font-medium">状态</th>
                    <th className="py-2 pr-3 font-medium">最后心跳</th>
                    <th className="py-2 font-medium">当前任务</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.workers.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-slate-500">
                        暂无 worker 记录
                      </td>
                    </tr>
                  ) : (
                    data.workers.items.map((worker) => (
                      <tr key={worker.workerId}>
                        <td className="py-2 pr-3 font-mono text-xs text-slate-800">{worker.workerId}</td>
                        <td className="py-2 pr-3 text-slate-800">{worker.name}</td>
                        <td className="py-2 pr-3">
                          <Badge tone={toneForWorkerStatus(worker.status)}>{worker.status}</Badge>
                        </td>
                        <td className="py-2 pr-3 text-slate-700">{formatDateTime(worker.lastHeartbeatAt)}</td>
                        <td className="py-2">
                          {worker.currentTaskId ? (
                            <Link className="text-sky-700 hover:underline" to={`/tasks/${worker.currentTaskId}`}>
                              {worker.currentTaskId}
                            </Link>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="OpenCode 状态列表">
            <div className="overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="py-2 pr-3 font-medium">workerId</th>
                    <th className="py-2 pr-3 font-medium">projectKey</th>
                    <th className="py-2 pr-3 font-medium">端口</th>
                    <th className="py-2 pr-3 font-medium">状态</th>
                    <th className="py-2 font-medium">详情</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.openCode.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-slate-500">
                        暂无 OpenCode 状态
                      </td>
                    </tr>
                  ) : (
                    data.openCode.map((item) => (
                      <tr key={`${item.workerId}:${item.projectKey}:${item.port}`}>
                        <td className="py-2 pr-3 font-mono text-xs text-slate-800">{item.workerId}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-slate-800">{item.projectKey}</td>
                        <td className="py-2 pr-3 text-slate-700">{item.port}</td>
                        <td className="py-2 pr-3">
                          <Badge
                            tone={
                              item.status === 'online'
                                ? 'success'
                                : item.status === 'offline'
                                  ? 'failed'
                                  : 'neutral'
                            }
                          >
                            {item.status}
                          </Badge>
                        </td>
                        <td className="py-2 text-slate-700">{item.detail}</td>
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
