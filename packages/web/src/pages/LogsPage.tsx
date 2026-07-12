import { useEffect, useRef, useState } from 'react';

import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorNotice, InfoNotice } from '../components/ui/Notice';
import { primaryButtonClassName, secondaryButtonClassName, selectClassName } from '../components/ui/styles';
import { apiGet } from '../lib/api';
import { isDesktop, readOpenCodeLogs as readDesktopOpenCodeLogs } from '../lib/desktop';

type ServiceType = 'controller' | 'worker' | 'opencode';

interface OpenCodeProjectItem {
  projectKey: string;
  workerId: string;
  nodeName: string;
  port: number;
}

export function LogsPage(): JSX.Element {
  const [service, setService] = useState<ServiceType>('controller');
  const desktopMode = isDesktop();
  const [logs, setLogs] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCodeProjects, setOpenCodeProjects] = useState<OpenCodeProjectItem[]>([]);
  const [selectedProjectKey, setSelectedProjectKey] = useState<string>('all');
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  useEffect(() => {
    const loadOpenCodeProjects = async (): Promise<void> => {
      try {
        const overview = await apiGet<{ openCode?: OpenCodeProjectItem[] }>('/overview');
        setOpenCodeProjects(overview.openCode ?? []);
      } catch {
        setOpenCodeProjects([]);
      }
    };

    void loadOpenCodeProjects();
  }, []);

  const startStreaming = () => {
    if (service === 'opencode') {
      setError('本机 OpenCode 日志不支持实时流，请使用刷新按钮读取最近日志。');
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setLogs([]);
    setError(null);
    setIsStreaming(true);

    const eventSource = new EventSource(`/api/logs/${service}?follow=true&lines=100`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const newLog = event.data;
      setLogs((prev) => [...prev, newLog]);
    };

    eventSource.onerror = () => {
      setError('日志流连接失败');
      setIsStreaming(false);
      eventSource.close();
    };
  };

  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  };

  const loadHistoryLogs = async () => {
    try {
      setError(null);
      if (service === 'opencode') {
        if (!desktopMode) {
          throw new Error('OpenCode 本机日志仅支持桌面模式');
        }

        const data = await readDesktopOpenCodeLogs(200);
        setLogs(data.lines);
        return;
      }

      const response = await fetch(`/api/logs/${service}?lines=100`);
      if (!response.ok) {
        throw new Error('加载日志失败');
      }
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载日志失败');
    }
  };

  useEffect(() => {
    loadHistoryLogs();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [service]);

  const selectedProject = openCodeProjects.find((item) => item.projectKey === selectedProjectKey) ?? null;

  return (
    <div className="space-y-4">
      <PageHeader title="日志查看" description="查看 controller、worker 和本机 OpenCode 日志" />

      <Card compact title="日志控制台" className="overflow-hidden">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">服务</label>
                <select
                  value={service}
                  onChange={(e) => {
                    stopStreaming();
                    setService(e.target.value as ServiceType);
                  }}
                  className={selectClassName}
                >
                  <option value="controller">Controller</option>
                  <option value="worker">Worker</option>
                  <option value="opencode" disabled={!desktopMode}>OpenCode（本机）</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">OpenCode 项目</label>
                <select
                  value={selectedProjectKey}
                  onChange={(e) => setSelectedProjectKey(e.target.value)}
                  className={selectClassName}
                >
                  <option value="all">全部项目</option>
                  {openCodeProjects.map((item) => (
                    <option key={item.projectKey} value={item.projectKey}>
                      {item.projectKey} · {item.port}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadHistoryLogs}
                disabled={isStreaming}
                className={secondaryButtonClassName}
              >
                刷新
              </button>
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopStreaming}
                  className={primaryButtonClassName}
                >
                  停止实时
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startStreaming}
                  disabled={service === 'opencode'}
                  className={primaryButtonClassName}
                >
                  开始实时
                </button>
              )}
              <button
                type="button"
                onClick={() => setLogs([])}
                className={secondaryButtonClassName}
              >
                清空
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">服务 {service}</Badge>
            <Badge tone={isStreaming ? 'info' : 'neutral'}>{isStreaming ? '实时中' : '静态读取'}</Badge>
            <Badge tone="neutral">日志 {logs.length} 行</Badge>
            {selectedProject ? <Badge tone="neutral">项目 {selectedProject.projectKey}</Badge> : null}
          </div>

          {selectedProject ? (
            <InfoNotice
              compact
              title="当前项目"
              message={`${selectedProject.projectKey}（Worker ${selectedProject.workerId} · ${selectedProject.nodeName} · 端口 ${selectedProject.port}）`}
            />
          ) : null}

          {error ? <ErrorNotice message={error} /> : null}

          {isStreaming ? <InfoNotice compact title="实时状态" message="实时日志流已连接" /> : null}

          <div className="h-[600px] overflow-y-auto rounded-xl bg-slate-950 p-4 font-mono text-sm">
            {logs.length === 0 ? (
              <p className="text-slate-400">暂无日志</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="break-all whitespace-pre-wrap text-slate-100">
                    {log}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>

          <div className="text-sm text-slate-500">共 {logs.length} 行日志</div>
        </div>
      </Card>
    </div>
  );
}
