/**
 * 错误信息国际化映射
 * 将技术错误码转换为用户友好的中文提示
 */

import { ControllerErrorCode } from '../types/errors';

/**
 * 错误信息映射表
 * 格式：{ 错误码: { title: 简短标题, message: 详细说明, suggestion: 操作建议 } }
 */
export const ERROR_MESSAGES: Record<
  ControllerErrorCode,
  { title: string; message: string; suggestion?: string }
> = {
  [ControllerErrorCode.TASK_DRAFT_NOT_FOUND]: {
    title: '任务草稿不存在',
    message: '找不到指定的任务草稿，可能已被删除或 ID 错误',
    suggestion: '请检查任务 ID 是否正确，或刷新任务列表',
  },
  [ControllerErrorCode.TASK_MEMORY_NOT_FOUND]: {
    title: '任务记忆不存在',
    message: '找不到任务的历史记忆数据',
    suggestion: '该任务可能是首次创建，无历史记录',
  },
  [ControllerErrorCode.PROMPT_DRAFT_NOT_FOUND]: {
    title: '提示词草稿不存在',
    message: '找不到指定的提示词草稿',
    suggestion: '请确认任务已生成提示词草稿',
  },
  [ControllerErrorCode.INVALID_TASK_PROTOCOL]: {
    title: '任务协议格式错误',
    message: '接收到的任务协议格式不符合规范',
    suggestion: '请检查 OpenClaw webhook 配置是否正确',
  },
  [ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING]: {
    title: '任务协议缺少必填字段',
    message: '任务协议中缺少必需的字段',
    suggestion: '请检查 webhook 请求体是否包含所有必填字段（projectKey, taskType 等）',
  },
  [ControllerErrorCode.TASK_PROTOCOL_FIELD_INVALID]: {
    title: '任务协议字段值无效',
    message: '任务协议中某个字段的值不符合要求',
    suggestion: '请检查字段值的类型和格式是否正确',
  },
  [ControllerErrorCode.INVALID_APPROVAL_ACTION]: {
    title: '审批操作无效',
    message: '执行了不支持的审批操作',
    suggestion: '仅支持以下操作：确认派发、修改草案、取消任务',
  },
  [ControllerErrorCode.INVALID_TASK_STATUS_TRANSITION]: {
    title: '任务状态转换非法',
    message: '当前任务状态不允许执行此操作',
    suggestion: '请检查任务当前状态，某些操作仅在特定状态下可用',
  },
  [ControllerErrorCode.PROMPT_DRAFT_VERSION_CONFLICT]: {
    title: '提示词版本冲突',
    message: '提示词草稿已被其他操作修改',
    suggestion: '请刷新页面后重试',
  },
  [ControllerErrorCode.PROMPT_ENGINE_NOT_CONFIGURED]: {
    title: '提示词引擎未配置',
    message: '系统未配置提示词生成引擎',
    suggestion: '请在 Setup 向导中配置 OpenCode 或其他提示词引擎',
  },
  [ControllerErrorCode.PERSISTENCE_INIT_FAILED]: {
    title: '数据库初始化失败',
    message: '无法初始化持久化存储',
    suggestion: '请检查数据库文件权限和磁盘空间',
  },
  [ControllerErrorCode.TASK_NOT_FOUND]: {
    title: '任务不存在',
    message: '找不到指定的任务',
    suggestion: '请检查任务 ID 是否正确，或任务可能已被删除',
  },
  [ControllerErrorCode.WORKER_NOT_FOUND]: {
    title: 'Worker 不存在',
    message: '找不到指定的 Worker 节点',
    suggestion: '请检查 Worker ID 是否正确，或 Worker 可能已离线',
  },
  [ControllerErrorCode.NO_AVAILABLE_WORKER]: {
    title: '无可用 Worker',
    message: '当前没有在线的 Worker 可以执行此任务',
    suggestion: '请确保至少有一个 Worker 节点在线并支持该项目',
  },
  [ControllerErrorCode.PROJECT_CONFIG_NOT_FOUND]: {
    title: '项目配置不存在',
    message: '找不到指定项目的配置信息',
    suggestion: '请在 manifest.yaml 中添加该项目的配置',
  },
  [ControllerErrorCode.AUTH_UNAUTHORIZED]: {
    title: '未授权',
    message: '请求未提供有效的身份验证凭据',
    suggestion: '请检查 API Token 或 Webhook Token 是否正确',
  },
  [ControllerErrorCode.AUTH_FORBIDDEN]: {
    title: '禁止访问',
    message: '您没有权限执行此操作',
    suggestion: '请联系管理员获取相应权限',
  },
  [ControllerErrorCode.INVALID_REQUEST]: {
    title: '请求无效',
    message: '请求参数格式错误或缺少必填字段',
    suggestion: '请检查请求参数是否符合 API 规范',
  },
  [ControllerErrorCode.DUPLICATE_REQUEST]: {
    title: '重复请求',
    message: '该请求已经被处理过',
    suggestion: '请勿重复提交相同的请求',
  },
  [ControllerErrorCode.DRY_RUN_UNSUPPORTED]: {
    title: '不支持试运行',
    message: '当前操作不支持试运行模式',
    suggestion: '请使用正常模式执行操作',
  },
  [ControllerErrorCode.RESULT_PENDING]: {
    title: '结果待定',
    message: '操作正在执行中，结果尚未就绪',
    suggestion: '请稍后再查询结果',
  },
  [ControllerErrorCode.CANCEL_UNSUPPORTED]: {
    title: '不支持取消',
    message: '当前操作不支持取消',
    suggestion: '请等待操作完成',
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
): { title: string; message: string; suggestion?: string; technical?: string } {
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
