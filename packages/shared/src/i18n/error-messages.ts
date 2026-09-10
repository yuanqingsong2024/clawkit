/**
 * 错误信息国际化映射
 * 将技术错误码转换为用户友好的中文提示
 */

import { ControllerErrorCode } from '../types/errors';

/**
 * 错误文档基础 URL
 */
const ERROR_DOCS_BASE = 'https://github.com/yuanqingsong2024/clawkit/blob/main/docs/error-codes.md#';

/**
 * 获取错误文档链接
 */
function getDocLink(errorCode: string): string {
  return `${ERROR_DOCS_BASE}${errorCode.replace('.', '_')}`;
}

/**
 * 错误信息映射表
 * 格式：{ 错误码: { title: 简短标题, message: 详细说明, suggestion?: 操作建议, docUrl?: 文档链接 } }
 */
export const ERROR_MESSAGES: Record<
  ControllerErrorCode,
  { title: string; message: string; suggestion?: string; docUrl?: string }
> = {
  // ============ 任务相关 ============
  [ControllerErrorCode.TASK_DRAFT_NOT_FOUND]: {
    title: '任务草稿不存在',
    message: '找不到指定的任务草稿，可能已被删除或 ID 错误',
    suggestion: '请检查任务 ID 是否正确，或刷新任务列表',
    docUrl: getDocLink(ControllerErrorCode.TASK_DRAFT_NOT_FOUND),
  },
  [ControllerErrorCode.TASK_MEMORY_NOT_FOUND]: {
    title: '任务记忆不存在',
    message: '找不到任务的历史记忆数据',
    suggestion: '该任务可能是首次创建，无历史记录',
    docUrl: getDocLink(ControllerErrorCode.TASK_MEMORY_NOT_FOUND),
  },
  [ControllerErrorCode.TASK_NOT_FOUND]: {
    title: '任务不存在',
    message: '找不到指定的任务',
    suggestion: '请检查任务 ID 是否正确，或任务可能已被删除',
    docUrl: getDocLink(ControllerErrorCode.TASK_NOT_FOUND),
  },
  [ControllerErrorCode.INVALID_TASK_STATUS_TRANSITION]: {
    title: '任务状态转换非法',
    message: '当前任务状态不允许执行此操作',
    suggestion: '请检查任务当前状态，某些操作仅在特定状态下可用',
    docUrl: getDocLink(ControllerErrorCode.INVALID_TASK_STATUS_TRANSITION),
  },
  [ControllerErrorCode.CANCEL_UNSUPPORTED]: {
    title: '不支持取消',
    message: '当前操作不支持取消',
    suggestion: '请等待操作完成',
    docUrl: getDocLink(ControllerErrorCode.CANCEL_UNSUPPORTED),
  },
  [ControllerErrorCode.TASK_TIMEOUT]: {
    title: '任务执行超时',
    message: '任务执行时间超过了配置的超时限制',
    suggestion: '请检查任务是否卡住，或联系管理员增加超时时间',
    docUrl: getDocLink(ControllerErrorCode.TASK_TIMEOUT),
  },
  [ControllerErrorCode.TASK_EXECUTION_FAILED]: {
    title: '任务执行失败',
    message: '任务在执行过程中发生了错误',
    suggestion: '请查看任务详情中的错误信息，或检查 OpenCode 服务状态',
    docUrl: getDocLink(ControllerErrorCode.TASK_EXECUTION_FAILED),
  },

  // ============ 协议相关 ============
  [ControllerErrorCode.INVALID_TASK_PROTOCOL]: {
    title: '任务协议格式错误',
    message: '接收到的任务协议格式不符合规范',
    suggestion: '请检查 Claude Code webhook 配置是否正确',
    docUrl: getDocLink(ControllerErrorCode.INVALID_TASK_PROTOCOL),
  },
  [ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING]: {
    title: '任务协议缺少必填字段',
    message: '任务协议中缺少必需的字段',
    suggestion: '请检查 webhook 请求体是否包含所有必填字段（projectKey, taskType 等）',
    docUrl: getDocLink(ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING),
  },
  [ControllerErrorCode.TASK_PROTOCOL_FIELD_INVALID]: {
    title: '任务协议字段值无效',
    message: '任务协议中某个字段的值不符合要求',
    suggestion: '请检查字段值的类型和格式是否正确',
    docUrl: getDocLink(ControllerErrorCode.TASK_PROTOCOL_FIELD_INVALID),
  },

  // ============ 草稿相关 ============
  [ControllerErrorCode.PROMPT_DRAFT_NOT_FOUND]: {
    title: '提示词草稿不存在',
    message: '找不到指定的提示词草稿',
    suggestion: '请确认任务已生成提示词草稿',
    docUrl: getDocLink(ControllerErrorCode.PROMPT_DRAFT_NOT_FOUND),
  },
  [ControllerErrorCode.PROMPT_DRAFT_VERSION_CONFLICT]: {
    title: '提示词版本冲突',
    message: '提示词草稿已被其他操作修改',
    suggestion: '请刷新页面后重试',
    docUrl: getDocLink(ControllerErrorCode.PROMPT_DRAFT_VERSION_CONFLICT),
  },
  [ControllerErrorCode.PROMPT_GENERATION_FAILED]: {
    title: '提示词生成失败',
    message: '无法生成任务提示词',
    suggestion: '请检查提示词引擎配置是否正确',
    docUrl: getDocLink(ControllerErrorCode.PROMPT_GENERATION_FAILED),
  },

  // ============ Worker 相关 ============
  [ControllerErrorCode.WORKER_NOT_FOUND]: {
    title: 'Worker 不存在',
    message: '找不到指定的 Worker 节点',
    suggestion: '请检查 Worker ID 是否正确，或 Worker 可能已离线',
    docUrl: getDocLink(ControllerErrorCode.WORKER_NOT_FOUND),
  },
  [ControllerErrorCode.NO_AVAILABLE_WORKER]: {
    title: '无可用 Worker',
    message: '当前没有在线的 Worker 可以执行此任务',
    suggestion: '请确保至少有一个 Worker 节点在线并支持该项目',
    docUrl: getDocLink(ControllerErrorCode.NO_AVAILABLE_WORKER),
  },
  [ControllerErrorCode.WORKER_OFFLINE]: {
    title: 'Worker 已离线',
    message: '指定的 Worker 节点当前不在线',
    suggestion: '请检查 Worker 服务是否正常运行',
    docUrl: getDocLink(ControllerErrorCode.WORKER_OFFLINE),
  },
  [ControllerErrorCode.WORKER_CAPACITY_FULL]: {
    title: 'Worker 容量已满',
    message: 'Worker 当前的处理容量已满',
    suggestion: '请等待其他任务完成，或配置更多 Worker 节点',
    docUrl: getDocLink(ControllerErrorCode.WORKER_CAPACITY_FULL),
  },

  // ============ 项目相关 ============
  [ControllerErrorCode.PROJECT_CONFIG_NOT_FOUND]: {
    title: '项目配置不存在',
    message: '找不到指定项目的配置信息',
    suggestion: '请在 manifest.yaml 中添加该项目的配置',
    docUrl: getDocLink(ControllerErrorCode.PROJECT_CONFIG_NOT_FOUND),
  },
  [ControllerErrorCode.PROJECT_NOT_INITIALIZED]: {
    title: '项目未初始化',
    message: '项目尚未完成初始化',
    suggestion: '请先完成项目初始化流程',
    docUrl: getDocLink(ControllerErrorCode.PROJECT_NOT_INITIALIZED),
  },

  // ============ 审批相关 ============
  [ControllerErrorCode.INVALID_APPROVAL_ACTION]: {
    title: '审批操作无效',
    message: '执行了不支持的审批操作',
    suggestion: '仅支持以下操作：确认派发、修改草案、取消任务',
    docUrl: getDocLink(ControllerErrorCode.INVALID_APPROVAL_ACTION),
  },
  [ControllerErrorCode.APPROVAL_REQUIRED]: {
    title: '需要审批',
    message: '当前任务需要审批才能继续',
    suggestion: '请在任务详情页确认或修改草稿',
    docUrl: getDocLink(ControllerErrorCode.APPROVAL_REQUIRED),
  },

  // ============ 认证相关 ============
  [ControllerErrorCode.AUTH_UNAUTHORIZED]: {
    title: '未授权',
    message: '请求未提供有效的身份验证凭据',
    suggestion: '请检查 API Token 或 Webhook Token 是否正确',
    docUrl: getDocLink(ControllerErrorCode.AUTH_UNAUTHORIZED),
  },
  [ControllerErrorCode.AUTH_FORBIDDEN]: {
    title: '禁止访问',
    message: '您没有权限执行此操作',
    suggestion: '请联系管理员获取相应权限',
    docUrl: getDocLink(ControllerErrorCode.AUTH_FORBIDDEN),
  },
  [ControllerErrorCode.AUTH_TOKEN_EXPIRED]: {
    title: '认证令牌已过期',
    message: '您的认证令牌已过期，需要重新登录',
    suggestion: '请重新获取认证令牌',
    docUrl: getDocLink(ControllerErrorCode.AUTH_TOKEN_EXPIRED),
  },

  // ============ 请求相关 ============
  [ControllerErrorCode.INVALID_REQUEST]: {
    title: '请求无效',
    message: '请求参数格式错误或缺少必填字段',
    suggestion: '请检查请求参数是否符合 API 规范',
    docUrl: getDocLink(ControllerErrorCode.INVALID_REQUEST),
  },
  [ControllerErrorCode.DUPLICATE_REQUEST]: {
    title: '重复请求',
    message: '该请求已经被处理过',
    suggestion: '请勿重复提交相同的请求',
    docUrl: getDocLink(ControllerErrorCode.DUPLICATE_REQUEST),
  },
  [ControllerErrorCode.DRY_RUN_UNSUPPORTED]: {
    title: '不支持试运行',
    message: '当前操作不支持试运行模式',
    suggestion: '请使用正常模式执行操作',
    docUrl: getDocLink(ControllerErrorCode.DRY_RUN_UNSUPPORTED),
  },
  [ControllerErrorCode.RESULT_PENDING]: {
    title: '结果待定',
    message: '操作正在执行中，结果尚未就绪',
    suggestion: '请稍后再查询结果',
    docUrl: getDocLink(ControllerErrorCode.RESULT_PENDING),
  },
  [ControllerErrorCode.RATE_LIMIT_EXCEEDED]: {
    title: '请求频率超限',
    message: '您的请求频率超过了限制',
    suggestion: '请稍后再试，或联系管理员调整限制',
    docUrl: getDocLink(ControllerErrorCode.RATE_LIMIT_EXCEEDED),
  },

  // ============ 系统相关 ============
  [ControllerErrorCode.PROMPT_ENGINE_NOT_CONFIGURED]: {
    title: '提示词引擎未配置',
    message: '系统未配置提示词生成引擎',
    suggestion: '请在 Setup 向导中配置 OpenCode 或其他提示词引擎',
    docUrl: getDocLink(ControllerErrorCode.PROMPT_ENGINE_NOT_CONFIGURED),
  },
  [ControllerErrorCode.PERSISTENCE_INIT_FAILED]: {
    title: '数据库初始化失败',
    message: '无法初始化持久化存储',
    suggestion: '请检查数据库文件权限和磁盘空间',
    docUrl: getDocLink(ControllerErrorCode.PERSISTENCE_INIT_FAILED),
  },
  [ControllerErrorCode.MANIFEST_NOT_FOUND]: {
    title: '配置文件不存在',
    message: '找不到 manifest 配置文件',
    suggestion: '请确认配置文件路径正确，或使用 clawkit init 初始化',
    docUrl: getDocLink(ControllerErrorCode.MANIFEST_NOT_FOUND),
  },
  [ControllerErrorCode.MANIFEST_INVALID]: {
    title: '配置文件无效',
    message: 'manifest 配置文件格式错误或包含无效配置',
    suggestion: '请检查配置文件是否符合 schema 规范',
    docUrl: getDocLink(ControllerErrorCode.MANIFEST_INVALID),
  },
  [ControllerErrorCode.INTERNAL_ERROR]: {
    title: '内部错误',
    message: '服务器内部发生了未预期的错误',
    suggestion: '请查看服务器日志，或联系技术支持',
    docUrl: getDocLink(ControllerErrorCode.INTERNAL_ERROR),
  },
};

/**
 * 获取用户友好的错误信息
 * @param errorCode 错误码
 * @param technicalMessage 技术错误信息（可选，用于补充详情）
 * @returns 格式化的错误信息对象
 */
export function getErrorMessage(
  errorCode: ControllerErrorCode,
  technicalMessage?: string
): { title: string; message: string; suggestion?: string; docUrl?: string; technical?: string } {
  const errorInfo = ERROR_MESSAGES[errorCode];

  if (!errorInfo) {
    return {
      title: '未知错误',
      message: '发生了未知错误',
      technical: technicalMessage,
    };
  }

  return {
    ...errorInfo,
    technical: technicalMessage,
  };
}

/**
 * 获取错误的文档链接
 */
export function getErrorDocUrl(errorCode: ControllerErrorCode): string | undefined {
  return ERROR_MESSAGES[errorCode]?.docUrl;
}

/**
 * 格式化错误信息为单行文本（用于日志）
 * @param errorCode 错误码
 * @param technicalMessage 技术错误信息
 * @returns 格式化的错误文本
 */
export function formatErrorMessage(
  errorCode: ControllerErrorCode,
  technicalMessage?: string
): string {
  const { title, message, suggestion } = getErrorMessage(errorCode, technicalMessage);
  
  let result = `${title}：${message}`;
  if (suggestion) {
    result += ` | 建议：${suggestion}`;
  }
  if (technicalMessage) {
    result += ` | 技术详情：${technicalMessage}`;
  }
  
  return result;
}
