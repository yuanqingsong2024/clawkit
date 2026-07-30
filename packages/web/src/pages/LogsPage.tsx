/**
 * 日志查看页面
 * 工作台风格：紧凑布局
 */

import { useEffect, useRef, useState } from 'react';

import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorNotice, InfoNotice } from '../components/ui/Notice';
import { FilterBar } from '../components/ui/FilterBar';
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

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  raw: string;
}

// 日志级别映射
const LOG_LEVELS = ['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'] as const;
type LogLevel = typeof LOG_LEVELS[number];

// 解析日志行
function parseLogLine(line: string): LogEntry {
  // 尝试解析标准日志格式：[timestamp] level message
  const timestampMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\]/);
  const levelMatch = line.match(/\s+(ERROR|WARN|INFO|DEBUG|TRACE)\s+/i);

  const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();
  const level = levelMatch ? levelMatch[1].toUpperCase() : 'INFO';
  const message = line.replace(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\]\s*(ERROR|WARN|INFO|DEBUG|TRACE)\s+/i, '').trim();

  return {
    timestamp,
    level,
    message: message || line,
    raw: line
  };
}

// 检查日志是否匹配过滤条件
function matchesFilter(log: LogEntry, filters: { level: LogLevel; search: string; startTime: string; endTime: string }): boolean {
  // 级别过滤
  if (filters.level !== 'ALL' && log.level !== filters.level) {
    return false;
  }

  // 搜索过滤
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    const messageLower = log.message.toLowerCase();
    if (!messageLower.includes(searchLower)) {
      return false;
    }
  }

  // 时间范围过滤
  if (filters.startTime || filters.endTime) {
    const logTime = new Date(log.timestamp).getTime();
    if (filters.startTime && logTime < new Date(filters.startTime).getTime()) {
      return false;
    }
    if (filters.endTime && logTime > new Date(filters.endTime).getTime()) {
      return false;
    }
  }

  return true;
}

// 高亮搜索关键词
function highlightSearch(text: string, searchTerm: string): JSX.Element {
  if (!searchTerm) {
    return <>{text}</>;
  }

  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 0 ?
          part :
          <mark key={index} className="bg-yellow-200">{part}</mark>
      )}
    </>
  );
}

// 获取日志级别对应的颜色类
function getLevelColorClass(level: string): string {
  switch (level) {
    case 'ERROR': return 'text-red-500';
    case 'WARN': return 'text-amber-500';
    case 'INFO': return 'text-blue-500';
    case 'DEBUG': return 'text-green-500';
    case 'TRACE': return 'text-violet-500';
    default: return 'text-slate-500';
  }
}

export function LogsPage(): JSX.Element {
  const [service, setService] = useState<ServiceType>('controller');
  const desktopMode = isDesktop();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCodeProjects, setOpenCodeProjects] = useState<OpenCodeProjectItem[]>([]);
  const [selectedProjectKey, setSelectedProjectKey] = useState<string>('all');
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // 过滤状态
  const [filters, setFilters] = useState({
    level: 'ALL' as LogLevel,
    search: '',
    startTime: '',
    endTime: ''
  });

  // 过滤后的日志
  const filteredLogs = logs.filter(log => matchesFilter(log, filters));

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [filteredLogs]);

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
      const logEntry = parseLogLine(event.data);
      setLogs((prev) => [...prev, logEntry]);
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
        const parsedLogs = data.lines.map(parseLogLine);
        setLogs(parsedLogs);
        return;
      }

      const response = await fetch(`/api/logs/${service}?lines=200`);
      if (!response.ok) {
        throw new Error('加载日志失败');
      }
      const data = await response.json();
      const parsedLogs = (data.logs || []).map(parseLogLine);
      setLogs(parsedLogs);
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
    <div className="space-y-3">
      {/* 页面标题 */}
      <PageHeader
        title="日志查看"
        description="查看 controller、worker 和本机 OpenCode 日志"
        actions={[
          <button
            key="refresh"
            type="button"
            onClick={loadHistoryLogs}
            className={secondaryButtonClassName}
          >
            刷新
          </button>,
          isStreaming ? (
            <button
              key="stop"
              type="button"
              onClick={stopStreaming}
              className={primaryButtonClassName}
            >
              停止实时
            </button>
          ) : (
            <button
              key="start"
              type="button"
              onClick={startStreaming}
              disabled={service === 'opencode'}
              className={primaryButtonClassName}
            >
              开始实时
            </button>
          ),
        ]}
      />

      {/* 日志控制台 */}
      <Card compact title="日志控制台" className="overflow-hidden">
        <div className="space-y-3">
          {/* 日志过滤栏 */}
          <FilterBar
            search={{
              placeholder: '搜索日志内容...',
              value: filters.search,
              onChange: (value) => setFilters(prev => ({ ...prev, search: value }))
            }}
            filters={[
              {
                key: 'level',
                label: '日志级别',
                value: filters.level,
                options: LOG_LEVELS.map(level => ({
                  value: level,
                  label: level,
                })),
                onChange: (value) => setFilters(prev => ({ ...prev, level: value as LogLevel }))
              }
            ]}
          />

          {/* 服务选择 */}
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-500">服务</label>
              <select
                value={service}
                onChange={(e) => {
                  stopStreaming();
                  setFilters(prev => ({ ...prev, search: '', startTime: '', endTime: '' }));
                  setService(e.target.value as ServiceType);
                }}
                className={selectClassName}
              >
                <option value="controller">Controller</option>
                <option value="worker">Worker</option>
                <option value="opencode" disabled={!desktopMode}>OpenCode（本机）</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-500">OpenCode 项目</label>
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

          {/* 状态标签 */}
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">服务 {service}</Badge>
            <Badge tone={isStreaming ? 'info' : 'neutral'}>{isStreaming ? '实时中' : '静态读取'}</Badge>
            <Badge tone="neutral">总日志 {logs.length} 行</Badge>
            <Badge tone={filteredLogs.length < logs.length ? 'info' : 'neutral'}>匹配 {filteredLogs.length} 行</Badge>
            {selectedProject ? <Badge tone="neutral">项目 {selectedProject.projectKey}</Badge> : null}
          </div>

          {error && <ErrorNotice message={error} />}
          {isStreaming && <InfoNotice compact message="实时日志流已连接" />}

          {/* 日志显示区域 */}
          <div className="h-[calc(100vh-420px)] min-h-[200px] max-h-[600px] overflow-y-auto rounded-lg bg-slate-950 p-3 font-mono text-xs sm:h-[400px] sm:max-h-[500px]">
            {filteredLogs.length === 0 ? (
              <p className="text-slate-500 text-center py-8">暂无匹配的日志</p>
            ) : (
              <div className="space-y-0.5">
                {filteredLogs.map((log, index) => (
                  <div key={index} className="break-all whitespace-pre-wrap text-slate-100 leading-relaxed flex items-start gap-2">
                    <div className="w-20 text-[11px] flex-none">
                      <div className="text-slate-400">{log.timestamp.split('T')[1]?.split('.')[0] ?? ''}</div>
                      <div className={`text-xs font-medium ${getLevelColorClass(log.level)}`}>
                        {log.level}
                      </div>
                    </div>
                    <div className="flex-1">
                      {highlightSearch(log.message, filters.search)}
                    </div>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>

          <div className="text-xs text-slate-500 text-right">
            共 {logs.length} 行日志，显示 {filteredLogs.length} 行
          </div>
        </div>
      </Card>
    </div>
  );
}
