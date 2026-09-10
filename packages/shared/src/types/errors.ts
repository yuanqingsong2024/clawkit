export enum ControllerErrorCode {
  // 任务相关
  TASK_DRAFT_NOT_FOUND = 'controller.task_draft_not_found',
  TASK_MEMORY_NOT_FOUND = 'controller.task_memory_not_found',
  TASK_NOT_FOUND = 'controller.task_not_found',
  INVALID_TASK_STATUS_TRANSITION = 'controller.invalid_task_status_transition',
  CANCEL_UNSUPPORTED = 'controller.cancel_unsupported',
  TASK_TIMEOUT = 'controller.task_timeout',
  TASK_EXECUTION_FAILED = 'controller.task_execution_failed',

  // 协议相关
  INVALID_TASK_PROTOCOL = 'controller.invalid_task_protocol',
  TASK_PROTOCOL_FIELD_MISSING = 'controller.task_protocol_field_missing',
  TASK_PROTOCOL_FIELD_INVALID = 'controller.task_protocol_field_invalid',

  // 草稿相关
  PROMPT_DRAFT_NOT_FOUND = 'controller.prompt_draft_not_found',
  PROMPT_DRAFT_VERSION_CONFLICT = 'controller.prompt_draft_version_conflict',
  PROMPT_GENERATION_FAILED = 'controller.prompt_generation_failed',

  // Worker 相关
  WORKER_NOT_FOUND = 'controller.worker_not_found',
  NO_AVAILABLE_WORKER = 'controller.no_available_worker',
  WORKER_OFFLINE = 'controller.worker_offline',
  WORKER_CAPACITY_FULL = 'controller.worker_capacity_full',

  // 项目相关
  PROJECT_CONFIG_NOT_FOUND = 'controller.project_config_not_found',
  PROJECT_NOT_INITIALIZED = 'controller.project_not_initialized',

  // 审批相关
  INVALID_APPROVAL_ACTION = 'controller.invalid_approval_action',
  APPROVAL_REQUIRED = 'controller.approval_required',

  // 认证相关
  AUTH_UNAUTHORIZED = 'controller.auth_unauthorized',
  AUTH_FORBIDDEN = 'controller.auth_forbidden',
  AUTH_TOKEN_EXPIRED = 'controller.auth_token_expired',

  // 请求相关
  INVALID_REQUEST = 'controller.invalid_request',
  DUPLICATE_REQUEST = 'controller.duplicate_request',
  DRY_RUN_UNSUPPORTED = 'controller.dry_run_unsupported',
  RESULT_PENDING = 'controller.result_pending',
  RATE_LIMIT_EXCEEDED = 'controller.rate_limit_exceeded',

  // 系统相关
  PROMPT_ENGINE_NOT_CONFIGURED = 'controller.prompt_engine_not_configured',
  PERSISTENCE_INIT_FAILED = 'controller.persistence_init_failed',
  MANIFEST_NOT_FOUND = 'controller.manifest_not_found',
  MANIFEST_INVALID = 'controller.manifest_invalid',
  INTERNAL_ERROR = 'controller.internal_error',
}
