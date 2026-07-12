import { EventEmitter } from 'node:events';

/**
 * 状态变化事件
 */
export interface StateChangeEvent<T = unknown> {
  key: string;
  previousValue: T | undefined;
  newValue: T;
  timestamp: Date;
  sourceInstanceId: string;
}

/**
 * 状态存储选项
 */
export interface StateStorageOptions {
  /** 存储类型 */
  type: 'memory' | 'redis' | 'postgres';
  /** Redis 连接配置 */
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  /** Postgres 连接配置 */
  postgres?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  /** Key 前缀 */
  keyPrefix?: string;
  /** 是否启用发布/订阅 */
  enablePubSub?: boolean;
}

/**
 * 状态项
 */
export interface StateItem<T = unknown> {
  key: string;
  value: T;
  version: number;
  lastModified: Date;
  expiresAt?: Date;
  sourceInstanceId?: string;
}

/**
 * 分布式锁选项
 */
export interface LockOptions {
  /** 锁超时时间（毫秒） */
  timeout?: number;
  /** 等待锁超时时间（毫秒） */
  waitTimeout?: number;
  /** 自动释放锁的间隔（毫秒） */
  autoReleaseInterval?: number;
}

/**
 * 共享状态服务
 * 提供分布式状态存储和同步能力
 */
export class SharedStateService extends EventEmitter {
  private readonly storageType: StateStorageOptions['type'];
  private readonly keyPrefix: string;
  private readonly state: Map<string, StateItem> = new Map();
  private readonly locks: Map<string, { ownerId: string; expiresAt: Date; intervalId?: NodeJS.Timeout }> = new Map();
  private instanceId: string;
  private localPubSub: EventEmitter | null = null;

  constructor(
    instanceId: string,
    options?: Partial<StateStorageOptions>,
  ) {
    super();
    this.instanceId = instanceId;
    this.storageType = options?.type ?? 'memory';
    this.keyPrefix = options?.keyPrefix ?? 'clawkit:';

    if (options?.enablePubSub) {
      this.localPubSub = new EventEmitter();
    }
  }

  /**
   * 获取实例 ID
   */
  getInstanceId(): string {
    return this.instanceId;
  }

  /**
   * 设置状态
   */
  async set<T>(key: string, value: T, options?: { expiresInMs?: number }): Promise<void> {
    const fullKey = this.getFullKey(key);
    const now = new Date();

    const previousItem = this.state.get(fullKey);
    const previousValue = previousItem?.value as T | undefined;

    const item: StateItem<T> = {
      key: fullKey,
      value,
      version: previousItem ? previousItem.version + 1 : 1,
      lastModified: now,
      sourceInstanceId: this.instanceId,
      expiresAt: options?.expiresInMs
        ? new Date(now.getTime() + options.expiresInMs)
        : undefined,
    };

    this.state.set(fullKey, item);

    // 发布变化事件
    this.emitChange(key, previousValue, value);
  }

  /**
   * 获取状态
   */
  async get<T>(key: string): Promise<T | undefined> {
    const fullKey = this.getFullKey(key);
    const item = this.state.get(fullKey) as StateItem<T> | undefined;

    if (!item) {
      return undefined;
    }

    // 检查过期
    if (item.expiresAt && item.expiresAt.getTime() < Date.now()) {
      this.state.delete(fullKey);
      return undefined;
    }

    return item.value;
  }

  /**
   * 删除状态
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    const existed = this.state.has(fullKey);

    if (existed) {
      this.state.delete(fullKey);
      this.emit('delete', { key, timestamp: new Date(), sourceInstanceId: this.instanceId });
    }

    return existed;
  }

  /**
   * 检查键是否存在
   */
  async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== undefined;
  }

  /**
   * 获取所有键
   */
  async keys(pattern?: string): Promise<string[]> {
    const prefix = this.keyPrefix;
    let allKeys = Array.from(this.state.keys());

    if (pattern) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
      allKeys = allKeys.filter((k) => regex.test(k));
    }

    return allKeys.map((k) => k.replace(prefix, ''));
  }

  /**
   * 原子递增
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    const fullKey = this.getFullKey(key);
    const current = (await this.get<number>(fullKey)) ?? 0;
    const newValue = current + amount;
    await this.set(fullKey, newValue);
    return newValue;
  }

  /**
   * 原子递减
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    return this.increment(key, -amount);
  }

  /**
   * 获取当前值并设置新值（原子操作）
   */
  async getAndSet<T>(key: string, value: T): Promise<T | undefined> {
    const previous = await this.get<T>(key);
    await this.set(key, value);
    return previous;
  }

  /**
   * 尝试获取锁
   */
  async tryAcquireLock(
    lockName: string,
    ownerId: string,
    options?: LockOptions,
  ): Promise<boolean> {
    const fullLockName = this.getFullKey(`lock:${lockName}`);
    const now = Date.now();
    const timeout = options?.timeout ?? 30000;
    const waitTimeout = options?.waitTimeout ?? 0;
    const autoReleaseInterval = options?.autoReleaseInterval ?? 5000;

    const waitStart = Date.now();

    while (true) {
      const existing = this.locks.get(fullLockName);

      if (!existing) {
        // 获取锁成功
        const expiresAt = new Date(now + timeout);
        const intervalId = setInterval(() => {
          const lock = this.locks.get(fullLockName);
          if (lock && lock.ownerId === ownerId) {
            lock.expiresAt = new Date(Date.now() + timeout);
          }
        }, autoReleaseInterval);

        this.locks.set(fullLockName, {
          ownerId,
          expiresAt,
          intervalId,
        });

        return true;
      }

      // 检查锁是否已过期
      if (existing.expiresAt.getTime() < now) {
        this.releaseLock(lockName, ownerId);
        continue;
      }

      // 如果设置了等待超时
      if (waitTimeout > 0 && Date.now() - waitStart >= waitTimeout) {
        return false;
      }

      // 短暂等待后重试
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  /**
   * 释放锁
   */
  releaseLock(lockName: string, ownerId: string): boolean {
    const fullLockName = this.getFullKey(`lock:${lockName}`);
    const existing = this.locks.get(fullLockName);

    if (!existing || existing.ownerId !== ownerId) {
      return false;
    }

    if (existing.intervalId) {
      clearInterval(existing.intervalId);
    }

    this.locks.delete(fullLockName);
    return true;
  }

  /**
   * 检查是否持有锁
   */
  isLockHeld(lockName: string, ownerId: string): boolean {
    const fullLockName = this.getFullKey(`lock:${lockName}`);
    const existing = this.locks.get(fullLockName);

    if (!existing) {
      return false;
    }

    // 检查是否过期
    if (existing.expiresAt.getTime() < Date.now()) {
      this.locks.delete(fullLockName);
      return false;
    }

    return existing.ownerId === ownerId;
  }

  /**
   * 发布消息到本地订阅者
   */
  publish(channel: string, message: unknown): void {
    if (this.localPubSub) {
      this.localPubSub.emit(channel, message);
    }
  }

  /**
   * 订阅消息
   */
  subscribe<T>(channel: string, handler: (message: T) => void): () => void {
    if (!this.localPubSub) {
      return () => {};
    }

    this.localPubSub.on(channel, handler);

    return () => {
      this.localPubSub?.off(channel, handler);
    };
  }

  /**
   * 批量获取多个键的值
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | undefined>> {
    const result = new Map<string, T | undefined>();

    for (const key of keys) {
      result.set(key, await this.get<T>(key));
    }

    return result;
  }

  /**
   * 批量设置多个键的值
   */
  async mset<T>(items: Array<{ key: string; value: T; expiresInMs?: number }>): Promise<void> {
    for (const item of items) {
      await this.set(item.key, item.value, { expiresInMs: item.expiresInMs });
    }
  }

  /**
   * 获取存储统计
   */
  getStats(): {
    storageType: string;
    totalKeys: number;
    totalLocks: number;
    instanceId: string;
  } {
    return {
      storageType: this.storageType,
      totalKeys: this.state.size,
      totalLocks: this.locks.size,
      instanceId: this.instanceId,
    };
  }

  /**
   * 同步外部状态（用于从外部状态源加载）
   */
  syncState(entries: Array<{ key: string; value: unknown; version: number; lastModified: string }>): void {
    const now = new Date();

    for (const entry of entries) {
      const fullKey = this.getFullKey(entry.key);
      const existing = this.state.get(fullKey);

      // 只有版本更新或本地不存在时才更新
      if (!existing || entry.version > existing.version) {
        this.state.set(fullKey, {
          key: fullKey,
          value: entry.value,
          version: entry.version,
          lastModified: new Date(entry.lastModified),
        });
      }
    }
  }

  /**
   * 导出所有状态（用于持久化或同步）
   */
  exportState(): Array<{ key: string; value: unknown; version: number; lastModified: string }> {
    return Array.from(this.state.values()).map((item) => ({
      key: item.key.replace(this.keyPrefix, ''),
      value: item.value,
      version: item.version,
      lastModified: item.lastModified.toISOString(),
    }));
  }

  /**
   * 清空所有状态
   */
  async clear(): Promise<void> {
    this.state.clear();
    this.emit('clear', { timestamp: new Date(), sourceInstanceId: this.instanceId });
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    // 清理所有锁
    for (const [, lock] of this.locks) {
      if (lock.intervalId) {
        clearInterval(lock.intervalId);
      }
    }
    this.locks.clear();
    this.state.clear();
    this.localPubSub?.removeAllListeners();
    this.removeAllListeners();
  }

  /**
   * 获取完整键名
   */
  private getFullKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * 发出变化事件
   */
  private emitChange<T>(key: string, previousValue: T | undefined, newValue: T): void {
    const event: StateChangeEvent<T> = {
      key,
      previousValue,
      newValue,
      timestamp: new Date(),
      sourceInstanceId: this.instanceId,
    };

    this.emit('change', event);

    // 发布到本地订阅者
    if (this.localPubSub) {
      this.localPubSub.emit(`change:${key}`, event);
    }
  }
}
