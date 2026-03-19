/**
 * Worker 注册记录类型定义
 */

/**
 * Worker 状态枚举
 */
export enum WorkerStatus {
  /** 空闲状态，可接受新任务 */
  IDLE = 'idle',
  /** 忙碌状态，正在执行任务 */
  BUSY = 'busy',
  /** 离线状态，心跳超时 */
  OFFLINE = 'offline',
}

/**
 * Worker 注册记录
 */
export interface WorkerRecord {
  /** Worker 唯一标识 */
  workerId: string;
  /** Worker 名称 */
  name: string;
  /** Worker 所在节点名称 */
  nodeName: string;
  /** 连接模式：pull 或 push */
  connectMode: 'pull' | 'push';
  /** Worker 标签，用于任务分配 */
  tags: string[];
  /** 支持的项目 key 列表 */
  supportedProjects: string[];
  /** Worker 当前状态 */
  status: WorkerStatus;
  /** 最后心跳时间 */
  lastHeartbeatAt: Date;
  /** 当前正在执行的任务 ID（如果有） */
  currentTaskId?: string;
  /** Worker 注册时间 */
  createdAt: Date;
  /** Worker 信息最后更新时间 */
  updatedAt: Date;
}

/**
 * Worker 注册请求
 */
export interface WorkerRegisterRequest {
  /** Worker 唯一标识 */
  workerId: string;
  /** Worker 名称 */
  name: string;
  /** Worker 所在节点名称 */
  nodeName: string;
  /** 连接模式：pull 或 push */
  connectMode: 'pull' | 'push';
  /** Worker 标签 */
  tags: string[];
  /** 支持的项目 key 列表 */
  supportedProjects: string[];
}

/**
 * Worker 心跳请求
 */
export interface WorkerHeartbeatRequest {
  /** Worker 当前状态 */
  status: WorkerStatus;
  /** 当前正在执行的任务 ID（如果有） */
  currentTaskId?: string;
}

/**
 * Worker 心跳响应
 */
export interface WorkerHeartbeatResponse {
  /** 心跳是否成功 */
  success: boolean;
  /** 服务器时间 */
  serverTime: Date;
}
