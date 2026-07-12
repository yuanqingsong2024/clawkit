/**
 * 任务执行接口定义
 * 支持多种执行器的通用执行上下文和结果
 */

import type { TaskStatus } from './task';

/**
 * 执行边界定义
 * 用于控制执行器可以执行和禁止的操作
 */
export interface TaskExecutionBoundary {
  allowedActions: string[];
  forbiddenActions: string[];
  highRiskHandling: string;
}

/**
 * 执行输出契约
 * 定义执行器需要满足的输出规范
 */
export interface TaskOutputContract {
  completionChecklist: string[];
  modifiedFiles: string[];
  executionCommands: string[];
  testResults: string[];
  risksAndConfirmations: string[];
}

/**
 * 任务执行阶段枚举
 */
export type TaskExecutionStage =
  | 'project_check'
  | 'server_check'
  | 'context_build'
  | 'prompt_compile'
  | 'execute'
  | 'result_parse'
  | 'submit_result';

/**
 * 执行结果解析状态
 */
export type TaskExecutionParseStatus = 'structured' | 'text_only' | 'parse_failed';

/**
 * 结构化错误信息
 */
export interface TaskExecutionStructuredError {
  errorCode: string;
  message: string;
  stage: TaskExecutionStage;
  rawErrorSummary: string;
  /** 故障排查提示 */
  troubleshootingHint?: string;
}

/**
 * 任务执行上下文（V2 通用版本）
 * 支持多种执行器类型，通过 executorType 和 executorConfig 实现解耦
 */
export interface TaskExecutionContext {
  // ========== 任务基本信息 ==========
  taskId: string;
  projectKey: string;
  repoPath: string;
  branchBase: string;
  intent: string;
  constraints: string[];
  acceptanceCriteria: string[];
  sourceText: string;
  status: TaskStatus;
  executionPrompt: string;

  // ========== 执行器相关（V2 通用字段） ==========
  /** 执行器类型：如 'opencode', 'claude-code', 'codex', 'gemini' */
  executorType: string;
  /** 执行器特定配置（替代原来的 openCode 字段） */
  executorConfig: ExecutorConfig;
  /** 输出契约 */
  outputContract: TaskOutputContract;
  /** 执行边界 */
  executionBoundary: TaskExecutionBoundary;
}

/**
 * 执行器配置（通用配置对象）
 * 替代原来的 OpenCodeConfig，提供灵活的 Key-Value 配置能力
 */
export interface ExecutorConfig {
  /** 执行器服务地址 */
  baseUrl?: string;
  /** 执行器端口 */
  port?: number;
  /** 认证密码环境变量名 */
  passwordEnv?: string;
  /** 代理类型 */
  agent?: string;
  /** 运行模式 */
  mode?: string;
  /** 执行超时（毫秒） */
  timeoutMs?: number;
  /** 二进制路径（如 Claude Code CLI） */
  binaryPath?: string;
  /** 工作空间路径 */
  workspace?: string;
  /** 额外配置 */
  [key: string]: unknown;
}

/**
 * 任务执行结果
 */
export interface TaskExecutionResult {
  taskId: string;
  workerId: string;
  projectKey: string;
  status: 'done' | 'failed';
  summary: string;
  /** 是否为占位执行（用于链路验证） */
  placeholderExecution: boolean;
  logs: string[];
  changedFiles: string[];
  commands: string[];
  testResult: string;
  rawOutputSummary: string;
  parseStatus: TaskExecutionParseStatus;
  structuredError?: TaskExecutionStructuredError;
  /** 会话 ID（用于会话追踪） */
  sessionId?: string;
  /** 识别的风险项 */
  risks?: string[];
  /** 下一阶段提示 */
  nextStageHint?: string;
  updatedAt: string;
}

/**
 * 执行器接口
 * 所有执行器必须实现此接口
 */
export interface TaskExecutor {
  /** 执行器名称 */
  readonly name: string;
  /** 执行任务 */
  execute(context: TaskExecutionContext): Promise<TaskExecutionResult>;
  /** 健康检查（可选） */
  healthCheck?(): Promise<boolean>;
}

/**
 * OpenCode 特定配置（保持向后兼容）
 * @deprecated 请使用通用 ExecutorConfig，通过 executorType 区分执行器
 */
export interface OpenCodeConfig {
  port: number;
  agent: string;
  mode: string;
}

/**
 * 项目配置快照（保持向后兼容）
 * @deprecated 请使用通用配置
 */
export interface TaskProjectConfigSnapshot {
  repoPath: string;
  branchBase: string;
  openCode: OpenCodeConfig;
}

/**
 * 辅助函数：从 TaskExecutionContext 提取 OpenCode 兼容配置
 * 用于在迁移期间保持与旧版 OpenCodeExecutor 的兼容
 */
export function extractOpenCodeConfig(context: TaskExecutionContext): OpenCodeConfig | undefined {
  if (context.executorType !== 'opencode') {
    return undefined;
  }

  return {
    port: context.executorConfig.port ?? 4096,
    agent: context.executorConfig.agent ?? 'build',
    mode: context.executorConfig.mode ?? 'default',
  };
}
