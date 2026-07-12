// ============ Schema 导出 ============
export { ProfileSchema } from './schema/profile';
export { ControllerSchema } from './schema/controller';
export { NodeSchema, NodesSchema, LocalNodeSchema, SshNodeSchema } from './schema/node';
export { ProjectSchema, OpenCodeConfigSchema } from './schema/project';
export { WorkerSchema, WorkersSchema, ConnectModeSchema } from './schema/worker';
export { PromptEngineSchema, FallbackConfigSchema } from './schema/prompt-engine';
export { PromptDraftVersionSchema } from './schema/prompt-draft';
export { MemorySchema } from './schema/memory';
export { ManifestSchema, OpenClawSchema, NotifySchema, DeploySchema } from './schema/manifest';
export { SimpleManifestSchema, EditableSimpleManifestSchema, convertSimpleToFullManifest } from './schema/manifest-simple';
export type { SimpleManifest, EditableSimpleManifest, SimpleProject } from './schema/manifest-simple';

// ============ 配置工具导出 ============
export { getEnvString, getEnvNumber, getEnvBoolean, getEnvArray, validateConfig } from './config';
export type { ConfigSource, ConfigLoadResult } from './config';

// ============ 日志工具导出 ============
export { Logger, LogLevel, createLogger } from './logger';
export type { LoggerConfig } from './logger';

// ============ Manifest 加载工具导出 ============
export { loadManifest, loadEditableSimpleManifest, detectManifestType, validateSimpleManifest, validateEditableSimpleManifest } from './utils/manifest-loader';

// ============ Git 工具导出 ============
export {
  checkGitInstalled,
  isGitRepository,
  getGitRepoInfo,
  getGitRepoSummary,
  cloneRepository,
  validateRemoteUrl,
  resolveUserPath,
  extractRepoName
} from './utils/git-utils';
export type { GitRepoInfo, GitRepoSummary, CloneOptions } from './utils/git-utils';

// ============ 服务导出 ============
export { getApprovalPolicyService } from './services/approval-policy-service';
export type { ApprovalPolicyService, ApprovalDecision } from './services/approval-policy-service';

// ============ 工具函数导出 ============
export { getErrorMessage } from './i18n/error-messages';

// ============ 类型导出 ============
export type * from './types/manifest';
export type * from './types/render';
export type { PromptDraftVersion } from './schema/prompt-draft';
export type * from './types/worker-record';
export type * from './types/dispatch-record';
export type * from './types/worker-api';
export { WorkerStatus } from './types/worker-record';
export { DispatchStatus } from './types/dispatch-record';

// ============ V2 Manifest Schema 导出 ============
export {
  ExecutorTypeEnum,
  ExecutorInstanceSchema,
  ExecutorOverrideSchema,
  ExecutorsSchema,
  TriggerTypeEnum,
  TriggerInstanceSchema,
  TriggersSchema,
  ProjectV2Schema,
  WorkerV2Schema,
  WorkersV2Schema,
} from './schema/manifest-v2';
export type {
  ExecutorType,
  ExecutorInstance,
  ExecutorOverride,
  Executors,
  TriggerType,
  TriggerInstance,
  Triggers,
  ProjectV2,
  WorkerV2,
  WorkersV2,
} from './schema/manifest-v2';
export { convertV1ToV2, detectManifestVersion } from './schema/manifest-v2-compatibility';
export type { V1ToV2Options, V1ToV2Result, ConversionWarning } from './schema/manifest-v2-compatibility';
export type { V1SimpleManifest, V1FullManifest } from './schema/manifest-v2-compatibility.types';

// ============ 执行器和触发器接口导出 ============
export type {
  ExecutorMeta,
  ExecutorCapability,
  ExecutorFactoryConfig,
  ExecutorFactory,
  ExecutorRegistry,
  ValidationResult,
} from './interfaces/executor-registry';
export type {
  TriggerMeta,
  TriggerAdapter,
  TriggerAdapterRegistry,
  ProtocolAdapter,
  ProtocolRegistry,
  ParsedTriggerRequest,
  TriggerAction,
  TaskProtocol,
  TaskProtocolCommandType,
  TaskProtocolResult,
  CreateTaskProtocol,
  ConfirmDispatchProtocol,
  ReviseDraftProtocol,
  CancelTaskProtocol,
  QueryStatusProtocol,
} from './interfaces/trigger-adapter';

// ============ 接口导出 ============
export type { ManifestLoader } from './interfaces/loader';
export type { ManifestValidator, ValidationError } from './interfaces/validator';
export type { TemplateRenderer } from './interfaces/renderer';
export { formatValidationIssue } from './utils/validation';
export type {
  Executor,
  LocalExecutor,
  SshExecutor,
  ExecutionResult,
  ExecutionOptions,
} from './interfaces/executor';
export type {
  TaskExecutor,
  TaskExecutionBoundary,
  TaskExecutionContext,
  TaskExecutionParseStatus,
  TaskExecutionResult,
  TaskExecutionStage,
  TaskExecutionStructuredError,
  TaskProjectConfigSnapshot,
  ExecutorConfig,
  OpenCodeConfig,
} from './interfaces/task-executor';
export type { DoctorService, DoctorReport, CheckResult } from './interfaces/doctor';
export { CheckStatus } from './interfaces/doctor';
export type { PlanService, ExecutionPlan, ExecutionStep } from './interfaces/plan';
export { StepType } from './interfaces/plan';
export { TaskStatus, ApprovalAction, TaskPriority } from './interfaces/task';
export { ControllerErrorCode } from './types/errors';
