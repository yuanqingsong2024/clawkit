/**
 * Dashboard 页面相关类型定义
 */

// Worker 记录
export interface WorkerRecord {
  workerId: string;
  name: string;
  status: 'idle' | 'busy' | 'offline' | string;
  lastHeartbeatAt: string;
  currentTaskId?: string;
}

// OpenCode 状态摘要
export interface OpenCodeStatusSummary {
  workerId: string;
  projectKey: string;
  nodeName: string;
  port: number;
  status: 'online' | 'offline' | 'unknown' | string;
  detail: string;
  canStart?: boolean;
}

// OpenCode 启动结果
export interface OpenCodeStartResult {
  projectKey: string;
  nodeName: string;
  port: number;
  started: boolean;
  message: string;
  detail?: string;
}

// Worker 启动结果
export interface WorkerStartResult {
  workerId: string;
  started: boolean;
  message: string;
  detail?: string;
}

// Worker 日志结果
export interface WorkerLogsResult {
  workerId: string;
  logFile: string;
  lines: string[];
}

// Claude Code 启动结果
export interface ClaudeCodeStartResult {
  started: boolean;
  message: string;
  detail?: string;
}

// OpenCode 实例分组
export interface OpenCodeInstanceGroup {
  key: string;
  workerId: string;
  nodeName: string;
  port: number;
  status: string;
  detail: string;
  canStart: boolean;
  projectKeys: string[];
  primaryProjectKey: string;
}

// 任务列表项
export interface TaskListItem {
  taskId: string;
  projectKey: string;
  intent: string;
  status: string;
  updatedAt: string;
}

// 总览数据
export interface OverviewData {
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
    localDetected: boolean;
    serviceStatus: 'online' | 'offline' | 'unknown' | 'checking';
    healthCheckUrl: string | null;
    healthCheckDetail: string;
    lastCheckAt: string | null;
    canStart: boolean;
  };
  openCode: OpenCodeStatusSummary[];
  recentTasks: TaskListItem[];
}

// 桌面模式 OpenCode 状态
export interface DesktopOpenCodeStatus {
  passwordConfigured: boolean;
}

// 状态 tone 映射
export type StatusTone = 'success' | 'warning' | 'failed' | 'neutral';
export type WorkerStatusTone = 'success' | 'info' | 'failed' | 'neutral';
export type ServiceStatusTone = 'success' | 'warning' | 'failed' | 'neutral';

/**
 * 根据系统状态返回对应的 Badge tone
 */
export function toneForSystemStatus(status: string): StatusTone {
  if (status === 'online') return 'success';
  if (status === 'warning') return 'warning';
  if (status === 'failed') return 'failed';
  return 'neutral';
}

/**
 * 根据 Worker 状态返回对应的 Badge tone
 */
export function toneForWorkerStatus(status: string): WorkerStatusTone {
  if (status === 'idle') return 'success';
  if (status === 'busy') return 'info';
  if (status === 'offline') return 'failed';
  return 'neutral';
}

/**
 * 根据服务状态返回对应的 Badge tone
 */
export function toneForServiceStatus(status: string): ServiceStatusTone {
  if (status === 'online') return 'success';
  if (status === 'offline') return 'failed';
  if (status === 'checking') return 'warning';
  return 'neutral';
}

/**
 * 获取服务状态的中文标签
 */
export function labelForServiceStatus(status: string): string {
  if (status === 'online') return '在线';
  if (status === 'offline') return '离线';
  if (status === 'checking') return '检查中';
  if (status === 'unknown') return '未知';
  return status;
}

/**
 * 将 OpenCode 状态列表分组
 */
export function buildOpenCodeGroups(items: OpenCodeStatusSummary[]): OpenCodeInstanceGroup[] {
  const groups = new Map<string, OpenCodeInstanceGroup>();

  for (const item of items) {
    const key = `${item.workerId}:${item.nodeName}:${item.port}`;
    const existing = groups.get(key);
    if (existing) {
      existing.projectKeys.push(item.projectKey);
      if (existing.status !== 'offline' && item.status === 'offline') {
        existing.status = item.status;
        existing.detail = item.detail;
      }
      existing.canStart = existing.canStart || item.canStart !== false;
      continue;
    }

    groups.set(key, {
      key,
      workerId: item.workerId,
      nodeName: item.nodeName,
      port: item.port,
      status: item.status,
      detail: item.detail,
      canStart: item.canStart !== false,
      projectKeys: [item.projectKey],
      primaryProjectKey: item.projectKey,
    });
  }

  return Array.from(groups.values());
}
