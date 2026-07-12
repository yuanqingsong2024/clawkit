/**
 * 负载均衡策略接口
 * 定义不同的负载均衡选择算法
 */
export interface LoadBalancerStrategy {
  /**
   * 选择最优 worker
   * @param taskId 任务 ID
   * @param projectKey 项目 key
   * @param workers 可选的 worker 列表
   * @returns 选中的 worker ID 或 null（无可用 worker）
   */
  selectWorker(
    taskId: string,
    projectKey: string,
    workers: WorkerSelectionCandidate[],
  ): string | null;
}

/**
 * Worker 选择候选项
 */
export interface WorkerSelectionCandidate {
  workerId: string;
  status: string;
  currentLoad: number;
  maxConcurrency: number;
  supportedProjects: string[];
  labels: Record<string, string | boolean>;
  capabilities: string[];
  lastHeartbeatAt: Date;
}

/**
 * 负载均衡配置
 */
export interface LoadBalancerConfig {
  /** 策略类型：least-load | round-robin | random | project-affinity */
  strategy: 'least-load' | 'round-robin' | 'random' | 'project-affinity';
  /** 权重配置（可选） */
  weights?: Record<string, number>;
  /** 是否启用项目亲和性 */
  enableProjectAffinity?: boolean;
  /** 最大重试次数（选择失败时） */
  maxRetries?: number;
  /** 心跳超时阈值（毫秒） */
  heartbeatTimeoutMs?: number;
}

/**
 * 负载均衡结果
 */
export interface LoadBalanceResult {
  success: boolean;
  selectedWorkerId?: string;
  reason?: string;
  candidates?: string[];
}

/**
 * 默认负载均衡配置
 */
export const DEFAULT_LOAD_BALANCER_CONFIG: Required<LoadBalancerConfig> = {
  strategy: 'least-load',
  weights: {},
  enableProjectAffinity: true,
  maxRetries: 3,
  heartbeatTimeoutMs: 30000,
};
