import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ErrorNotice, InfoNotice } from '../components/ui/Notice';
import { formatDateTime, isNonEmptyString } from '../lib/format';
import { apiGet } from '../lib/api';

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

interface OverviewAlert {
  level: 'warning' | 'error';
  title: string;
  detail: string;
}

interface TaskListItem {
  taskId: string;
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
    serviceStatus: 'online' | 'offline' | 'unknown' | 'checking';
    healthCheckUrl: string | null;
    healthCheckDetail: string;
    lastCheckAt: string | null;
  };
  openCode: OpenCodeStatusSummary[];
  recentTasks: TaskListItem[];
  alerts: OverviewAlert[];
}

function toneForSystemStatus(status: string): 'success' | 'warning' | 'failed' | 'neutral' {
  if (status === 'success') return 'success';
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

function labelForBool(value: boolean): string {
  return value ? '是' : '否';
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

export function OverviewPage(): JSX.Element {
  const overviewQuery = useQuery({
    queryKey: ['overview'],
    queryFn: () => apiGet<OverviewData>('/overview'),
  });

  const data = overviewQuery.data;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">首页 / 总览</h1>
          <div className="mt-1 text-sm text-slate-600">聚合展示 controller、worker 与最近任务状态。</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => overviewQuery.refetch()}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={overviewQuery.isFetching}
          >
            {overviewQuery.isFetching ? '刷新中…' : '手动刷新'}
          </button>
        </div>
      </div>

      {overviewQuery.isLoading ? <InfoNotice message="正在加载总览数据…" /> : null}
      {overviewQuery.error ? (
        <ErrorNotice message={overviewQuery.error instanceof Error ? overviewQuery.error.message : '未知错误'} />
      ) : null}

      {data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="系统信息">
            <div className="space-y-4">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">名称</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">{data.profile.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">拓扑</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">{data.profile.topology}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">manifest 路径</dt>
                  <dd className="mt-1 break-all text-sm font-medium text-slate-900">{data.manifestPath ?? '未配置'}</dd>
                </div>
              </dl>

              {!isNonEmptyString(data.manifestPath) ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="font-medium">当前尚未配置 manifest 路径</div>
                  <div className="mt-1">请先前往配置页保存 manifest 路径，随后再编辑 YAML 或查看完整系统信息。</div>
                  <div className="mt-3">
                    <Link
                      to="/config"
                      className="inline-flex rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
                    >
                      去配置页
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <Card title="Controller 状态">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={toneForSystemStatus(data.controller.status)}>{data.controller.status}</Badge>
                {isNonEmptyString(data.controller.publicUrl) ? (
                  <span className="text-sm text-slate-700">公开地址：{data.controller.publicUrl}</span>
                ) : (
                  <span className="text-sm text-slate-500">未配置公开地址</span>
                )}
              </div>
              <InfoNotice title="运行态提示" message={data.controller.runtimeNotice} />
            </div>
          </Card>

          <Card
            title="Workers 统计"
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">总数 {data.workers.total}</Badge>
                <Badge tone="success">在线 {data.workers.online}</Badge>
                <Badge tone="success">空闲 {data.workers.idle}</Badge>
                <Badge tone="info">忙碌 {data.workers.busy}</Badge>
                <Badge tone="failed">离线 {data.workers.offline}</Badge>
              </div>
            }
          >
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

          <Card
            title="OpenClaw 状态"
            actions={
              <div className="flex gap-2">
                {!data.openClaw.configured || data.openClaw.serviceStatus === 'offline' ? (
                  <>
                    <Link
                      to="/setup/openclaw"
                      className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
                    >
                      配置 OpenClaw
                    </Link>
                    <Link
                      to="/setup"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
                    >
                      完整向导
                    </Link>
                  </>
                ) : null}
              </div>
            }
          >
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">地址已配置</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">{labelForBool(data.openClaw.configured)}</dd>
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
                <dd className="mt-1 break-all text-sm font-medium text-slate-900">
                  {isNonEmptyString(data.openClaw.publicUrl) ? data.openClaw.publicUrl : '未配置'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Token 已配置</dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">{labelForBool(data.openClaw.tokenConfigured)}</dd>
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

          <Card
            title="OpenCode 状态列表"
            actions={
              <div className="flex gap-2">
                {data.openCode.length === 0 ? (
                  <>
                    <Link
                      to="/setup/opencode"
                      className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
                    >
                      配置 OpenCode
                    </Link>
                    <Link
                      to="/setup"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-50"
                    >
                      完整向导
                    </Link>
                  </>
                ) : null}
              </div>
            }
          >
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

          <Card title="最近任务列表">
            <div className="overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="py-2 pr-3 font-medium">taskId</th>
                    <th className="py-2 pr-3 font-medium">意图</th>
                    <th className="py-2 pr-3 font-medium">状态</th>
                    <th className="py-2 font-medium">更新时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentTasks.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-3 text-slate-500">
                        暂无最近任务
                      </td>
                    </tr>
                  ) : (
                    data.recentTasks.map((task) => (
                      <tr key={task.taskId}>
                        <td className="py-2 pr-3 font-mono text-xs">
                          <Link className="text-sky-700 hover:underline" to={`/tasks/${task.taskId}`}>
                            {task.taskId}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 text-slate-800">{task.intent}</td>
                        <td className="py-2 pr-3">
                          <Badge tone="neutral">{task.status}</Badge>
                        </td>
                        <td className="py-2 text-slate-700">{formatDateTime(task.updatedAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="告警列表">
            <div className="space-y-2">
              {data.alerts.length === 0 ? <div className="text-sm text-slate-500">当前无告警</div> : null}
              {data.alerts.map((alert, index) => (
                <div key={`${alert.title}-${index}`} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <Badge tone={alert.level === 'error' ? 'failed' : 'warning'}>{alert.level === 'error' ? '错误' : '警告'}</Badge>
                    <div className="text-sm font-medium text-slate-900">{alert.title}</div>
                  </div>
                  <div className="mt-2 text-sm text-slate-700">{alert.detail}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
