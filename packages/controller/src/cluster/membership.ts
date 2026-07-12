import { EventEmitter } from 'node:events';

/**
 * Controller 实例信息
 */
export interface ControllerInstance {
  instanceId: string;
  host: string;
  port: number;
  startTime: Date;
  lastHeartbeat: Date;
  status: InstanceStatus;
  priority: number; // 用于 leader 选举
  metadata?: Record<string, string>;
}

/**
 * 实例状态
 */
export enum InstanceStatus {
  /** 启动中 */
  STARTING = 'starting',
  /** 运行正常 */
  HEALTHY = 'healthy',
  /** 不健康 */
  UNHEALTHY = 'unhealthy',
  /** 正在关闭 */
  SHUTTING_DOWN = 'shutting_down',
  /** 已关闭 */
  STOPPED = 'stopped',
}

/**
 * 实例成员变化事件
 */
export interface InstanceEvent {
  type: 'registered' | 'heartbeat' | 'unhealthy' | 'removed' | 'leader_changed';
  instance: ControllerInstance;
  timestamp: Date;
  details?: Record<string, unknown>;
}

/**
 * 实例成员配置
 */
export interface MembershipConfig {
  /** 实例 ID（唯一标识） */
  instanceId: string;
  /** 实例端口 */
  port: number;
  /** 心跳间隔（毫秒） */
  heartbeatIntervalMs?: number;
  /** 心跳超时（毫秒） */
  heartbeatTimeoutMs?: number;
  /** 实例优先级（用于 leader 选举） */
  priority?: number;
  /** 是否参与 leader 选举 */
  enableLeaderElection?: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<Omit<MembershipConfig, 'instanceId' | 'port'>> = {
  heartbeatIntervalMs: 5000,
  heartbeatTimeoutMs: 15000,
  priority: 100,
  enableLeaderElection: true,
};

/**
 * 实例成员服务
 * 管理集群中的所有 Controller 实例，支持注册、心跳、故障检测、leader 选举
 */
export class MembershipService extends EventEmitter {
  private readonly config: Required<MembershipConfig>;
  private readonly instances: Map<string, ControllerInstance> = new Map();
  private heartbeatTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private currentLeaderId: string | null = null;

  constructor(config: MembershipConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取当前实例 ID
   */
  getInstanceId(): string {
    return this.config.instanceId;
  }

  /**
   * 获取当前实例信息
   */
  getCurrentInstance(): ControllerInstance {
    return this.getInstance(this.config.instanceId) ?? this.createLocalInstance();
  }

  /**
   * 创建本地实例信息
   */
  private createLocalInstance(): ControllerInstance {
    return {
      instanceId: this.config.instanceId,
      host: 'localhost',
      port: this.config.port,
      startTime: new Date(),
      lastHeartbeat: new Date(),
      status: InstanceStatus.STARTING,
      priority: this.config.priority,
    };
  }

  /**
   * 注册当前实例
   */
  register(): void {
    const instance = this.createLocalInstance();
    instance.status = InstanceStatus.HEALTHY;
    this.instances.set(this.config.instanceId, instance);

    this.emit('event', {
      type: 'registered',
      instance,
      timestamp: new Date(),
    } as InstanceEvent);

    // 启动心跳
    this.startHeartbeat();

    // 启动清理定时器
    this.startCleanup();

    // 如果启用 leader 选举，检查是否应该成为 leader
    if (this.config.enableLeaderElection) {
      this.checkLeaderElection();
    }
  }

  /**
   * 更新本地实例的心跳
   */
  heartbeat(): void {
    const instance = this.instances.get(this.config.instanceId);
    if (instance) {
      instance.lastHeartbeat = new Date();
      instance.status = InstanceStatus.HEALTHY;

      this.emit('event', {
        type: 'heartbeat',
        instance,
        timestamp: new Date(),
      } as InstanceEvent);
    }
  }

  /**
   * 获取指定实例
   */
  getInstance(instanceId: string): ControllerInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * 获取所有健康实例
   */
  getHealthyInstances(): ControllerInstance[] {
    return Array.from(this.instances.values()).filter(
      (inst) => inst.status === InstanceStatus.HEALTHY,
    );
  }

  /**
   * 获取所有实例
   */
  getAllInstances(): ControllerInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * 获取当前 leader
   */
  getLeader(): ControllerInstance | null {
    if (!this.config.enableLeaderElection || !this.currentLeaderId) {
      return null;
    }
    return this.instances.get(this.currentLeaderId) ?? null;
  }

  /**
   * 判断当前实例是否是 leader
   */
  isLeader(): boolean {
    if (!this.config.enableLeaderElection) {
      return false;
    }
    return this.currentLeaderId === this.config.instanceId;
  }

  /**
   * 更新实例状态（由外部调用，如健康检查失败）
   */
  updateInstanceStatus(instanceId: string, status: InstanceStatus): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return false;
    }

    const previousStatus = instance.status;
    instance.status = status;

    if (status === InstanceStatus.UNHEALTHY) {
      this.emit('event', {
        type: 'unhealthy',
        instance,
        timestamp: new Date(),
        details: { previousStatus },
      } as InstanceEvent);

      // 如果当前实例不健康且是 leader，重新选举
      if (instanceId === this.currentLeaderId) {
        this.currentLeaderId = null;
        this.checkLeaderElection();
      }
    }

    return true;
  }

  /**
   * 同步实例列表（用于分布式场景，从外部状态源获取）
   */
  syncInstances(instances: ControllerInstance[]): void {
    const previousIds = new Set(this.instances.keys());
    const newIds = new Set<string>();

    for (const instance of instances) {
      newIds.add(instance.instanceId);

      const existing = this.instances.get(instance.instanceId);
      if (existing) {
        // 更新现有实例
        existing.host = instance.host;
        existing.port = instance.port;
        existing.lastHeartbeat = instance.lastHeartbeat;
        existing.status = instance.status;
        existing.priority = instance.priority;
        existing.metadata = instance.metadata;
      } else {
        // 添加新实例
        this.instances.set(instance.instanceId, { ...instance });

        this.emit('event', {
          type: 'registered',
          instance,
          timestamp: new Date(),
        } as InstanceEvent);
      }
    }

    // 移除不再存在的实例
    for (const id of previousIds) {
      if (!newIds.has(id)) {
        const removed = this.instances.get(id);
        this.instances.delete(id);

        if (removed) {
          this.emit('event', {
            type: 'removed',
            instance: removed,
            timestamp: new Date(),
          } as InstanceEvent);

          // 如果移除的是 leader，重新选举
          if (id === this.currentLeaderId) {
            this.currentLeaderId = null;
            this.checkLeaderElection();
          }
        }
      }
    }
  }

  /**
   * 标记当前实例正在关闭
   */
  prepareShutdown(): void {
    const instance = this.instances.get(this.config.instanceId);
    if (instance) {
      instance.status = InstanceStatus.SHUTTING_DOWN;
    }

    // 如果当前是 leader，重新选举
    if (this.currentLeaderId === this.config.instanceId) {
      this.currentLeaderId = null;
      this.checkLeaderElection();
    }
  }

  /**
   * 注销当前实例
   */
  unregister(): void {
    const instance = this.instances.get(this.config.instanceId);
    if (instance) {
      instance.status = InstanceStatus.STOPPED;

      this.emit('event', {
        type: 'removed',
        instance,
        timestamp: new Date(),
      } as InstanceEvent);
    }

    this.stopTimers();
    this.instances.delete(this.config.instanceId);
  }

  /**
   * 启动心跳定时器
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.heartbeat();
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * 启动清理定时器（检查超时实例）
   */
  private startCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.checkTimeouts();
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * 检查实例超时
   */
  private checkTimeouts(): void {
    const now = Date.now();
    const timeout = this.config.heartbeatTimeoutMs;

    for (const [instanceId, instance] of this.instances) {
      if (instanceId === this.config.instanceId) {
        continue; // 跳过自身
      }

      const elapsed = now - instance.lastHeartbeat.getTime();
      if (elapsed > timeout && instance.status === InstanceStatus.HEALTHY) {
        this.updateInstanceStatus(instanceId, InstanceStatus.UNHEALTHY);
      }
    }
  }

  /**
   * 检查 leader 选举
   */
  private checkLeaderElection(): void {
    if (!this.config.enableLeaderElection) {
      return;
    }

    const healthyInstances = this.getHealthyInstances();
    if (healthyInstances.length === 0) {
      this.currentLeaderId = null;
      return;
    }

    // 按优先级排序（优先级高的优先）
    healthyInstances.sort((a, b) => b.priority - a.priority);

    const newLeader = healthyInstances[0];
    if (newLeader.instanceId !== this.currentLeaderId) {
      const previousLeaderId = this.currentLeaderId;
      this.currentLeaderId = newLeader.instanceId;

      this.emit('event', {
        type: 'leader_changed',
        instance: newLeader,
        timestamp: new Date(),
        details: { previousLeaderId },
      } as InstanceEvent);
    }
  }

  /**
   * 停止定时器
   */
  private stopTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * 获取集群统计信息
   */
  getStats(): {
    totalInstances: number;
    healthyInstances: number;
    unhealthyInstances: number;
    currentLeader: string | null;
    isLeader: boolean;
  } {
    const instances = this.getAllInstances();
    return {
      totalInstances: instances.length,
      healthyInstances: instances.filter((i) => i.status === InstanceStatus.HEALTHY).length,
      unhealthyInstances: instances.filter((i) => i.status === InstanceStatus.UNHEALTHY).length,
      currentLeader: this.currentLeaderId,
      isLeader: this.isLeader(),
    };
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.stopTimers();
    this.instances.clear();
    this.removeAllListeners();
  }
}
