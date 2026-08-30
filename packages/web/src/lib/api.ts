export interface ApiSuccessResponse<T> {
  success: true;
  code: string;
  message: string;
  data: T;
}

export interface ApiFailureResponse {
  success: false;
  code: string;
  message: string;
  details: unknown;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiFailureResponse;

export class ApiError extends Error {
  public readonly code: string;
  public readonly details?: unknown;
  public readonly statusCode?: number;

  constructor(options: { code: string; message: string; details?: unknown; statusCode?: number }) {
    super(options.message);
    this.code = options.code;
    this.details = options.details;
    this.statusCode = options.statusCode;
  }
}

// Controller API 基础 URL
// 在 Vite 开发环境下使用代理，相对路径
// 在生产环境或 Tauri 桌面端使用绝对路径
const controllerBaseUrl = import.meta.env.VITE_CONTROLLER_URL || '';

// 如果配置了绝对路径，添加 trailing slash
const baseURL = controllerBaseUrl ? 
  (controllerBaseUrl.endsWith('/') ? controllerBaseUrl + 'api' : controllerBaseUrl + '/api') : 
  '/api';

function normalizePath(path: string): string {
  if (!path) {
    throw new Error('接口路径不能为空');
  }

  return path.startsWith('/') ? path : `/${path}`;
}
export async function apiRequest<T>(
  path: string,
  init?: RequestInit
): Promise<ApiSuccessResponse<T>> {
  const url = `${baseURL}${normalizePath(path)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`网络请求失败：${message}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    if (isJson) {
      const body = (await res.json().catch(() => null)) as Partial<ApiFailureResponse> | null;
      throw new ApiError({
        code: body?.code ? String(body.code) : 'http.request_failed',
        message: body?.message ? String(body.message) : `接口请求失败：${res.status} ${res.statusText}`,
        details: body?.details,
        statusCode: res.status,
      });
    }
    throw new ApiError({
      code: 'http.request_failed',
      message: `接口请求失败：${res.status} ${res.statusText}`,
      statusCode: res.status,
    });
  }

  if (!isJson) {
    throw new ApiError({ code: 'http.invalid_response', message: '接口返回格式不正确：期望 application/json' });
  }

  const body = (await res.json()) as ApiResponse<T>;
  if (!body.success) {
    throw new ApiError({ code: body.code, message: body.message, details: body.details, statusCode: res.status });
  }

  return body;
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiRequest<T>(path, { ...init, method: 'GET' });
  return res.data;
}

export async function apiPost<T, B>(path: string, body?: B, init?: RequestInit): Promise<T> {
  const res = await apiRequest<T>(path, {
    ...init,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.data;
}

export async function apiPut<T, B>(path: string, body: B, init?: RequestInit): Promise<T> {
  const res = await apiRequest<T>(path, {
    ...init,
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function apiDelete<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiRequest<T>(path, { ...init, method: 'DELETE' });
  return res.data;
}

// ========== Pipeline API ==========

export interface PipelineNode {
  id: string;
  type: string;
  name: string;
  config?: Record<string, unknown>;
  dependsOn?: string[];
}

export interface PipelineDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  projectKey: string;
  executionMode: string;
  nodes: PipelineNode[];
  variables?: Record<string, unknown>;
  status: 'draft' | 'active' | 'paused' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export type PipelineDetail = PipelineDefinition;

export interface PipelineExecution {
  id: string;
  pipelineId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  triggeredBy?: string;
  triggerType?: string;
  variables?: Record<string, unknown>;
  stageStatuses?: Record<string, {
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt?: string;
    completedAt?: string;
    error?: string;
  }>;
  startedAt: string;
  completedAt?: string;
  duration?: number;
}

/**
 * 获取流水线列表
 */
export async function getPipelines(): Promise<PipelineDefinition[]> {
  return apiGet<PipelineDefinition[]>('/pipelines');
}

/**
 * 获取单个流水线
 */
export async function getPipeline(id: string): Promise<PipelineDefinition> {
  return apiGet<PipelineDefinition>(`/pipelines/${id}`);
}

/**
 * 创建流水线
 */
export async function createPipeline(data: {
  name: string;
  description?: string;
  nodes: PipelineNode[];
  variables?: Record<string, unknown>;
}): Promise<PipelineDefinition> {
  return apiPost<PipelineDefinition, typeof data>('/pipelines', data);
}

/**
 * 更新流水线
 */
export async function updatePipeline(id: string, data: Partial<PipelineDefinition>): Promise<PipelineDefinition> {
  return apiPut<PipelineDefinition, Partial<PipelineDefinition>>(`/pipelines/${id}`, data);
}

/**
 * 删除流水线
 */
export async function deletePipeline(id: string): Promise<void> {
  return apiDelete<void>(`/pipelines/${id}`);
}

/**
 * 执行流水线
 */
export async function executePipeline(id: string, variables?: Record<string, unknown>): Promise<PipelineExecution> {
  return apiPost<PipelineExecution, { variables?: Record<string, unknown> }>(`/pipelines/${id}/execute`, { variables });
}

/**
 * 获取流水线执行历史
 */
export async function getPipelineExecutions(id: string): Promise<PipelineExecution[]> {
  return apiGet<PipelineExecution[]>(`/pipelines/${id}/executions`);
}

/**
 * 获取单个执行记录
 */
export async function getPipelineExecution(pipelineId: string, executionId: string): Promise<PipelineExecution> {
  return apiGet<PipelineExecution>(`/pipelines/${pipelineId}/executions/${executionId}`);
}

// ========== Plugin Market API ==========

/**
 * 插件市场原始数据结构（匹配后端返回）
 */
export interface PluginMarketRawData {
  meta: {
    name: string;
    version: string;
    type: 'executor' | 'trigger' | 'notifier';
    description: string;
    author: string;
  };
  source: string;
  installed: boolean;
  downloads: number;
  rating: number;
  publishedAt: number;
  updatedAt: number;
  keywords: string[];
}

/**
 * 转换后的插件数据结构（前端使用）
 */
export interface PluginEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: 'executor' | 'trigger' | 'notifier';
  tags: string[];
  downloads: number;
  rating: number;
  readme?: string;
  manifest?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InstalledPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: 'executor' | 'trigger' | 'notifier';
  enabled: boolean;
  config?: Record<string, unknown>;
  installedAt: string;
}

/**
 * 将插件市场原始数据转换为前端格式
 */
export function transformPluginEntry(raw: PluginMarketRawData): PluginEntry {
  return {
    id: raw.source,
    name: raw.meta.name,
    version: raw.meta.version,
    description: raw.meta.description,
    author: raw.meta.author,
    type: raw.meta.type,
    tags: raw.keywords,
    downloads: raw.downloads,
    rating: raw.rating,
    createdAt: new Date(raw.publishedAt).toISOString(),
    updatedAt: new Date(raw.updatedAt).toISOString(),
  };
}

/**
 * 搜索插件
 */
export async function searchPlugins(params: {
  keyword?: string;
  type?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
}): Promise<{ items: PluginEntry[]; total: number; page: number; pageSize: number }> {
  const searchParams = new URLSearchParams();
  if (params.keyword) searchParams.set('keyword', params.keyword);
  if (params.type) searchParams.set('type', params.type);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const result = await apiGet<{ entries: PluginMarketRawData[]; total: number; page: number; pageSize: number }>(
    `/plugins/search?${searchParams.toString()}`
  );

  return {
    items: result.entries.map(transformPluginEntry),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  };
}

/**
 * 获取热门插件
 * 使用搜索 API 获取按下载量排序的插件
 */
export async function getTrendingPlugins(limit = 10): Promise<PluginEntry[]> {
  const result = await searchPlugins({
    sortBy: 'downloads',
    sortOrder: 'desc',
    pageSize: limit,
  });
  return result.items;
}

/**
 * 获取单个插件详情
 */
export async function getPluginDetail(id: string): Promise<PluginEntry> {
  return apiGet<PluginEntry>(`/plugins/${id}`);
}

/**
 * 安装插件
 */
export async function installPlugin(id: string): Promise<{ success: boolean; plugin: InstalledPlugin }> {
  return apiPost<{ success: boolean; plugin: InstalledPlugin }, undefined>(`/plugins/${id}/install`);
}

/**
 * 获取已安装插件列表
 */
export async function getInstalledPlugins(): Promise<InstalledPlugin[]> {
  return apiGet<InstalledPlugin[]>('/plugins/installed');
}

/**
 * 卸载插件
 */
export async function uninstallPlugin(id: string): Promise<void> {
  return apiDelete<void>(`/plugins/${id}/uninstall`);
}

/**
 * 更新插件配置
 */
export async function updatePluginConfig(id: string, config: Record<string, unknown>): Promise<InstalledPlugin> {
  return apiPut<InstalledPlugin, Record<string, unknown>>(`/plugins/${id}/config`, config);
}

/**
 * 启用/禁用插件
 */
export async function togglePlugin(id: string, enabled: boolean): Promise<InstalledPlugin> {
  return apiPost<InstalledPlugin, { enabled: boolean }>(`/plugins/${id}/toggle`, { enabled });
}
