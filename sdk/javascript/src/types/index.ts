/**
 * ClawKit SDK 类型定义
 * 定义任务、流水线、Worker 等核心类型
 */

// ============ 通用类型 ============

/**
 * API 响应包装器
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  code: string;
  message: string;
  data: T;
}

/**
 * 分页信息
 */
export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationInfo;
}

// ============ 任务类型 ============

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  DRAFT = 'draft',
  PROMPT_GENERATED = 'prompt_generated',
  WAITING_APPROVAL = 'waiting_approval',
  APPROVED = 'approved',
  DISPATCHED = 'dispatched',
  RUNNING = 'running',
  DONE = 'done',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * 任务优先级枚举
 */
export enum TaskPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * 任务对象
 */
export interface Task {
  id: string;
  projectKey: string;
  text: string;
  prompt?: string;
  status: TaskStatus;
  priority: TaskPriority;
  result?: TaskResult;
  createdAt: string;
  updatedAt: string;
}

/**
 * 任务结果
 */
export interface TaskResult {
  output: string;
  filesChanged?: string[];
  summary?: string;
  error?: string;
}

/**
 * 创建任务请求
 */
export interface CreateTaskOptions {
  text: string;
  projectKey?: string;
  priority?: TaskPriority;
  prompt?: string;
}

/**
 * 任务列表查询选项
 */
export interface ListTasksOptions {
  page?: number;
  pageSize?: number;
  status?: TaskStatus;
  projectKey?: string;
  priority?: TaskPriority;
}

/**
 * 审批任务选项
 */
export interface ApproveTaskOptions {
  comment?: string;
}

/**
 * 拒绝任务选项
 */
export interface RejectTaskOptions {
  reason: string;
}

// ============ 流水线类型 ============

/**
 * 流水线阶段类型
 */
export enum PipelineStageType {
  TASK = 'task',
  CONDITION = 'condition',
  PARALLEL = 'parallel',
  SERIAL = 'serial',
}

/**
 * 流水线阶段
 */
export interface PipelineStage {
  id: string;
  name: string;
  type: PipelineStageType;
  dependsOn?: string[];
  executor?: string;
  config?: Record<string, unknown>;
  condition?: string;
}

/**
 * 流水线元信息
 */
export interface PipelineMeta {
  id: string;
  name: string;
  description?: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * 流水线
 */
export interface Pipeline {
  meta: PipelineMeta;
  stages: PipelineStage[];
}

/**
 * 创建流水线请求
 */
export interface CreatePipelineOptions {
  name: string;
  stages?: PipelineStage[];
  description?: string;
}

/**
 * 更新流水线请求
 */
export interface UpdatePipelineOptions {
  name?: string;
  stages?: PipelineStage[];
  description?: string;
}

/**
 * 流水线执行状态
 */
export enum PipelineExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * 流水线执行记录
 */
export interface PipelineExecution {
  id: string;
  pipelineId: string;
  triggerType: string;
  status: PipelineExecutionStatus;
  stageExecutions: Record<string, string>;
  result?: PipelineExecutionResult;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

/**
 * 流水线执行结果
 */
export interface PipelineExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  stages?: Record<string, StageExecutionResult>;
}

/**
 * 阶段执行结果
 */
export interface StageExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  duration?: number;
}

/**
 * 流水线统计信息
 */
export interface PipelineStats {
  total: number;
  running: number;
  completed: number;
  failed: number;
}

// ============ Worker 类型 ============

/**
 * Worker 状态枚举
 */
export enum WorkerStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  BUSY = 'busy',
  ERROR = 'error',
}

/**
 * Worker 对象
 */
export interface Worker {
  id: string;
  name: string;
  status: WorkerStatus;
  tags: string[];
  supportedProjects: string[];
  currentLoad: number;
  maxLoad: number;
  lastHeartbeat: string;
  createdAt: string;
}

// ============ 系统类型 ============

/**
 * 健康检查响应
 */
export interface HealthStatus {
  success: boolean;
  code: string;
  message: string;
  data: {
    service: string;
    stage: string;
    timestamp: string;
  };
}

/**
 * 系统信息
 */
export interface SystemInfo {
  version: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}

/**
 * 指标数据点
 */
export interface MetricPoint {
  timestamp: string;
  value: number;
  labels?: Record<string, string>;
}

/**
 * 指标序列
 */
export interface MetricSeries {
  name: string;
  description: string;
  unit: string;
  type: 'gauge' | 'counter' | 'histogram' | 'summary';
  points: MetricPoint[];
}

// ============ 插件类型 ============

/**
 * 插件类型
 */
export enum PluginType {
  EXECUTOR = 'executor',
  TRIGGER = 'trigger',
  NOTIFIER = 'notifier',
}

/**
 * 插件状态
 */
export enum PluginLifecycleState {
  LOADING = 'loading',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
}

/**
 * 插件对象
 */
export interface Plugin {
  name: string;
  version: string;
  type: PluginType;
  description?: string;
  author?: string;
  state: PluginLifecycleState;
  config?: Record<string, unknown>;
  capabilities?: string[];
}

// ============ 客户端配置类型 ============

/**
 * ClawKit 客户端配置
 */
export interface ClawKitClientOptions {
  /**
   * Controller 服务地址
   */
  baseUrl: string;
  /**
   * API Key 认证（可选）
   */
  apiKey?: string;
  /**
   * 请求超时时间（毫秒）
   */
  timeout?: number;
  /**
   * 重试次数
   */
  retry?: number;
  /**
   * 自定义请求头
   */
  headers?: Record<string, string>;
}

// ============ 错误类型 ============

/**
 * SDK 错误类
 */
export class ClawKitError extends Error {
  code: string;
  statusCode?: number;
  details?: unknown;

  constructor(message: string, code: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'ClawKitError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * 验证错误
 */
export class ValidationError extends ClawKitError {
  constructor(message: string, details?: unknown) {
    super(message, 'validation.error', 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * 认证错误
 */
export class AuthenticationError extends ClawKitError {
  constructor(message: string, details?: unknown) {
    super(message, 'auth.error', 401, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * 资源未找到错误
 */
export class NotFoundError extends ClawKitError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'not.found', 404);
    this.name = 'NotFoundError';
  }
}
