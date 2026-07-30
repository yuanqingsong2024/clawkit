/**
 * 通知服务类型定义
 */

/**
 * 通知渠道类型
 */
export type NotificationChannelType = 'dingtalk' | 'feishu' | 'slack' | 'wecom' | 'email' | 'webhook';

/**
 * 通知优先级
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * 通知消息类型
 */
export type NotificationMessageType = 'text' | 'markdown' | 'link' | 'action_card';

/**
 * 通知目标
 */
export interface NotificationTarget {
  /** 渠道类型 */
  type: NotificationChannelType;
  /** Webhook URL 或配置 */
  url?: string;
  /** 关键字（用于钉钉签名验证） */
  secret?: string;
  /** 额外配置 */
  config?: Record<string, unknown>;
}

/**
 * 通知消息
 */
export interface NotificationMessage {
  /** 消息标题 */
  title: string;
  /** 消息内容 */
  content: string;
  /** 消息类型 */
  messageType: NotificationMessageType;
  /** 通知优先级 */
  priority?: NotificationPriority;
  /** 链接（可选） */
  link?: {
    text: string;
    url: string;
  };
  /** 按钮（用于 action_card 类型） */
  buttons?: Array<{
    text: string;
    actionUrl: string;
  }>;
}

/**
 * 通知上下文
 */
export interface NotificationContext {
  /** 任务 ID */
  taskId?: string;
  /** 项目 key */
  projectKey?: string;
  /** 任务状态 */
  taskStatus?: string;
  /** 操作人 */
  operator?: string;
  /** 执行结果（如果有） */
  result?: {
    success: boolean;
    message?: string;
    error?: string;
  };
  /** 额外数据 */
  extra?: Record<string, unknown>;
}

/**
 * 通知结果
 */
export interface NotificationResult {
  /** 是否成功 */
  success: boolean;
  /** 渠道类型 */
  channel: NotificationChannelType;
  /** 错误信息（如果有） */
  error?: string;
  /** 响应数据 */
  response?: unknown;
  /** 发送时间 */
  timestamp: Date;
}

/**
 * 通知器配置
 */
export interface NotifierConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 渠道类型 */
  channel: NotificationChannelType;
  /** Webhook URL */
  webhookUrl: string;
  /** 签名密钥（可选） */
  secret?: string;
  /** 重试次数 */
  maxRetries?: number;
  /** 重试间隔（毫秒） */
  retryIntervalMs?: number;
  /** 超时时间（毫秒） */
  timeoutMs?: number;
  /** 是否在测试环境也发送通知 */
  sendInTest?: boolean;
}

/**
 * 通知服务配置
 */
export interface NotificationServiceConfig {
  /** 是否启用通知 */
  enabled: boolean;
  /** 默认通知器列表 */
  notifiers: NotifierConfig[];
  /** 失败时是否记录日志 */
  logOnFailure?: boolean;
}

/**
 * 通知事件类型
 */
export type NotificationEventType = 
  | 'task.created'
  | 'task.approved'
  | 'task.revised'
  | 'task.cancelled'
  | 'task.dispatched'
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'worker.registered'
  | 'worker.offline'
  | 'system.error'
  | 'system.warning';

/**
 * 通知事件
 */
export interface NotificationEvent {
  /** 事件类型 */
  type: NotificationEventType;
  /** 事件时间 */
  timestamp: Date;
  /** 通知上下文 */
  context: NotificationContext;
}
