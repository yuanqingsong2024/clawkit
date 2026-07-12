import { EventEmitter } from 'node:events';
import type { FastifyInstance } from 'fastify';

import { MembershipService, type MembershipConfig, type ControllerInstance, InstanceStatus } from './membership';
import { SharedStateService, type StateStorageOptions } from './shared-state';
import { HealthCheckService, type HealthCheckConfig, type SystemHealth } from './health-check';

/**
 * 高可用集群配置
 */
export interface HighAvailabilityConfig {
  /** 是否启用高可用模式 */
  enabled: boolean;
  /** 实例 ID */
  instanceId: string;
  /** 实例端口 */
  instancePort: number;
  /** 成员配置 */
  membership?: Partial<MembershipConfig>;
  /** 状态存储配置 */
  stateStorage?: Partial<StateStorageOptions>;
  /** 健康检查配置 */
  healthCheck?: Partial<HealthCheckConfig>;
  /** 是否启用 leader 选举 */
  enableLeaderElection?: boolean;
  /** 负载均衡策略 */
  loadBalanceStrategy?: 'leader-first' | 'random' | 'round-robin' | 'least-load';
}

/**
 * 集群节点事件
 */
export interface ClusterNodeEvent {
  type: 'node_joined' | 'node_left' | 'leader_changed' | 'state_changed' | 'health_changed';
  nodeId: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

/**
 * Leader 变化事件
 */
export interface LeaderChangeEvent {
  previousLeaderId: string | null;
  newLeaderId: string | null;
  timestamp: Date;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Omit<HighAvailabilityConfig, 'instanceId' | 'instancePort'> = {
  enabled: true,
  enableLeaderElection: true,
  loadBalanceStrategy: 'leader-first',
};

/**
 * 集群管理器
 * 整合成员管理、共享状态、健康检查，提供完整的高可用能力
 */
export class ClusterManager extends EventEmitter {
  private readonly config: HighAvailabilityConfig;
  private membershipService: MembershipService;
  private sharedStateService: SharedStateService;
  private healthCheckService: HealthCheckService;
  private app: FastifyInstance | null = null;

  constructor(config: HighAvailabilityConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 初始化服务
    this.membershipService = new MembershipService({
      instanceId: this.config.instanceId,
      port: this.config.instancePort,
      enableLeaderElection: this.config.enableLeaderElection,
      ...this.config.membership,
    });

    this.sharedStateService = new SharedStateService(
      this.config.instanceId,
      this.config.stateStorage,
    );

    this.healthCheckService = new HealthCheckService(this.config.healthCheck);

    // 监听成员变化
    this.setupMembershipListeners();
  }

  /**
   * 初始化集群管理器
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('高可用模式未启用，使用单实例模式');
      return;
    }

    // 注册自身
    this.membershipService.register();

    // 启动健康检查
    this.healthCheckService.startPeriodicCheck(this.config.instanceId);

    console.log(`集群管理器已初始化，实例ID: ${this.config.instanceId}`);
  }

  /**
   * 关联 Fastify 应用
   */
  attachApp(app: FastifyInstance): void {
    this.app = app;
    this.healthCheckService.registerRoutes(app, this.config.instanceId);
  }

  /**
   * 获取成员服务
   */
  getMembershipService(): MembershipService {
    return this.membershipService;
  }

  /**
   * 获取共享状态服务
   */
  getSharedStateService(): SharedStateService {
    return this.sharedStateService;
  }

  /**
   * 获取健康检查服务
   */
  getHealthCheckService(): HealthCheckService {
    return this.healthCheckService;
  }

  /**
   * 检查是否启用高可用模式
   */
  isHighAvailabilityEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 检查当前实例是否是 leader
   */
  isLeader(): boolean {
    if (!this.config.enableLeaderElection) {
      return true; // 非 HA 模式下，当前实例就是 leader
    }
    return this.membershipService.isLeader();
  }

  /**
   * 获取当前 leader
   */
  getLeader(): ControllerInstance | null {
    return this.membershipService.getLeader();
  }

  /**
   * 获取所有健康实例
   */
  getHealthyInstances(): ControllerInstance[] {
    return this.membershipService.getHealthyInstances();
  }

  /**
   * 执行健康检查
   */
  async checkHealth(): Promise<SystemHealth> {
    return this.healthCheckService.checkHealth(this.config.instanceId);
  }

  /**
   * 选择处理请求的实例（用于负载均衡）
   */
  selectInstanceForRequest(): ControllerInstance | null {
    const healthyInstances = this.getHealthyInstances();

    if (healthyInstances.length === 0) {
      return null;
    }

    switch (this.config.loadBalanceStrategy) {
      case 'leader-first': {
        const leader = this.membershipService.getLeader();
        if (leader && leader.status === InstanceStatus.HEALTHY) {
          return leader;
        }
        return healthyInstances[0];
      }

      case 'random': {
        const index = Math.floor(Math.random() * healthyInstances.length);
        return healthyInstances[index];
      }

      case 'round-robin': {
        // 简单的 round-robin 实现
        const index = Date.now() % healthyInstances.length;
        return healthyInstances[index];
      }

      case 'least-load':
      default: {
        // 目前按实例 ID 哈希简单分配
        const hash = this.hashString(this.config.instanceId);
        const index = hash % healthyInstances.length;
        return healthyInstances[index];
      }
    }
  }

  /**
   * 检查是否可以处理请求
   */
  canHandleRequest(): boolean {
    // 如果未启用 HA，任何实例都可以处理
    if (!this.config.enabled) {
      return true;
    }

    // 如果启用了 leader 选举，只有 leader 可以处理写请求
    // 读请求可以由任何健康实例处理
    if (this.config.enableLeaderElection && !this.isLeader()) {
      // 这里需要外部判断是读还是写请求
      return false;
    }

    // 检查当前实例是否健康
    const health = this.healthCheckService.getLastCheckResult();
    if (!health || health.status === 'unhealthy') {
      return false;
    }

    return true;
  }

  /**
   * 执行需要 leader 权限的操作
   */
  async executeAsLeader<T>(operation: () => Promise<T>): Promise<T | null> {
    if (!this.isLeader()) {
      return null;
    }

    // 获取分布式锁
    const lockAcquired = await this.sharedStateService.tryAcquireLock(
      'leader_operation',
      this.config.instanceId,
      { timeout: 60000 },
    );

    if (!lockAcquired) {
      // 另一个实例可能正在执行 leader 操作
      return null;
    }

    try {
      return await operation();
    } finally {
      this.sharedStateService.releaseLock('leader_operation', this.config.instanceId);
    }
  }

  /**
   * 设置成员变化监听
   */
  private setupMembershipListeners(): void {
    this.membershipService.on('event', (event) => {
      switch (event.type) {
        case 'registered':
          this.emit('node_joined', {
            type: 'node_joined',
            nodeId: event.instance.instanceId,
            timestamp: event.timestamp,
          } as ClusterNodeEvent);
          break;

        case 'removed':
          this.emit('node_left', {
            type: 'node_left',
            nodeId: event.instance.instanceId,
            timestamp: event.timestamp,
            details: { previousStatus: event.instance.status },
          } as ClusterNodeEvent);
          break;

        case 'leader_changed':
          this.emit('leader_changed', {
            previousLeaderId: event.details?.previousLeaderId as string | null,
            newLeaderId: event.instance.instanceId,
            timestamp: event.timestamp,
          } as LeaderChangeEvent);
          break;

        case 'unhealthy':
          this.emit('health_changed', {
            type: 'health_changed',
            nodeId: event.instance.instanceId,
            timestamp: event.timestamp,
            details: { healthy: false, status: event.instance.status },
          } as ClusterNodeEvent);
          break;
      }
    });

    // 监听健康检查变化
    this.healthCheckService.on('unhealthy', (data) => {
      if (data.status === 'unhealthy') {
        this.membershipService.updateInstanceStatus(
          this.config.instanceId,
          InstanceStatus.UNHEALTHY,
        );
      }
    });
  }

  /**
   * 获取集群统计信息
   */
  getClusterStats(): {
    enabled: boolean;
    instanceId: string;
    isLeader: boolean;
    leaderId: string | null;
    totalInstances: number;
    healthyInstances: number;
    stateStorageStats: ReturnType<SharedStateService['getStats']>;
    healthStatus: SystemHealth | null;
  } {
    const health = this.healthCheckService.getLastCheckResult();

    return {
      enabled: this.config.enabled,
      instanceId: this.config.instanceId,
      isLeader: this.isLeader(),
      leaderId: this.membershipService.getLeader()?.instanceId ?? null,
      totalInstances: this.membershipService.getAllInstances().length,
      healthyInstances: this.membershipService.getHealthyInstances().length,
      stateStorageStats: this.sharedStateService.getStats(),
      healthStatus: health ?? null,
    };
  }

  /**
   * 准备关闭
   */
  prepareShutdown(): void {
    this.membershipService.prepareShutdown();
    this.healthCheckService.stopPeriodicCheck();
  }

  /**
   * 关闭集群管理器
   */
  async shutdown(): Promise<void> {
    console.log(`正在关闭集群管理器，实例ID: ${this.config.instanceId}`);

    this.prepareShutdown();
    this.membershipService.unregister();

    await this.healthCheckService.stopPeriodicCheck();

    this.membershipService.destroy();
    this.sharedStateService.destroy();
    this.healthCheckService.stopPeriodicCheck();
    this.healthCheckService.removeAllListeners();

    console.log('集群管理器已关闭');
  }

  /**
   * 字符串哈希（简单的 DJB2）
   */
  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return hash >>> 0;
  }
}
