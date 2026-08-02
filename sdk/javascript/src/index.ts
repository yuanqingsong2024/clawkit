/**
 * ClawKit SDK 入口文件
 * 
 * @packageDocumentation
 * 
 * @example
 * ```typescript
 * // 使用命名导入
 * import { ClawKit } from '@clawkit/sdk';
 * 
 * // 或使用默认导入
 * import ClawKit from '@clawkit/sdk';
 * ```
 */

// 重新导出所有公共 API
export {
  ClawKit,
  fromEnv,
  TaskService,
  PipelineService,
  WorkerService,
  SystemService,
  PluginService,
  HttpClient,
} from './client';

// 导出类型
export type {
  // 客户端配置
  ClawKitClientOptions,
  
  // 通用类型
  ApiResponse,
  PaginationInfo,
  PaginatedResponse,
  
  // 任务类型
  Task,
  TaskResult,
  TaskStatus,
  TaskPriority,
  CreateTaskOptions,
  ListTasksOptions,
  ApproveTaskOptions,
  RejectTaskOptions,
  
  // 流水线类型
  Pipeline,
  PipelineMeta,
  PipelineStage,
  PipelineStageType,
  PipelineExecution,
  PipelineExecutionStatus,
  PipelineExecutionResult,
  StageExecutionResult,
  PipelineStats,
  CreatePipelineOptions,
  UpdatePipelineOptions,
  
  // Worker 类型
  Worker,
  WorkerStatus,
  
  // 系统类型
  HealthStatus,
  SystemInfo,
  MetricPoint,
  MetricSeries,
  
  // 插件类型
  Plugin,
  PluginType,
  PluginLifecycleState,
  
  // 错误类型
  ClawKitError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
} from './types';

// SDK 版本
export const VERSION = '0.1.0';
