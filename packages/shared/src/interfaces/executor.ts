/**
 * 执行结果
 */
export interface ExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 输出内容 */
  output?: string;
  /** 错误信息 */
  error?: string;
  /** 退出码 */
  exitCode?: number;
}

/**
 * 执行器接口基类
 * 负责在节点上执行命令
 */
export interface Executor {
  /**
   * 执行命令
   * @param command 命令字符串
   * @param options 执行选项
   * @returns 执行结果
   */
  execute(command: string, options?: ExecutionOptions): Promise<ExecutionResult>;

  /**
   * 检查连接状态
   * @returns 是否连接成功
   */
  checkConnection(): Promise<boolean>;
}

/**
 * 执行选项
 */
export interface ExecutionOptions {
  /** 工作目录 */
  cwd?: string;
  /** 环境变量 */
  env?: Record<string, string>;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * 本地执行器接口
 * 在本地机器上执行命令
 */
export interface LocalExecutor extends Executor {
  /** 执行器类型 */
  readonly type: 'local';
}

/**
 * SSH 执行器接口
 * 通过 SSH 在远程机器上执行命令
 */
export interface SshExecutor extends Executor {
  /** 执行器类型 */
  readonly type: 'ssh';

  /**
   * 连接到远程主机
   */
  connect(): Promise<void>;

  /**
   * 断开连接
   */
  disconnect(): Promise<void>;
}
