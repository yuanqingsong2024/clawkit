/**
 * 插件生命周期服务
 * 管理插件的初始化、启动、停止等生命周期状态
 */

import { EventEmitter } from 'events';
import type {
  PluginLifecycleState,
  PluginMeta,
  PluginContext,
  PluginEvent,
  PluginStats,
} from '../types/plugin.types';

/**
 * 生命周期状态转换事件
 */
export interface LifecycleTransitionEvent {
  pluginId: string;
  from: PluginLifecycleState;
  to: PluginLifecycleState;
  timestamp: number;
}

/**
 * 生命周期钩子接口
 */
export interface LifecycleHooks {
  onBeforeInitialize?: () => Promise<void>;
  onAfterInitialize?: () => Promise<void>;
  onBeforeStart?: () => Promise<void>;
  onAfterStart?: () => Promise<void>;
  onBeforeStop?: () => Promise<void>;
  onAfterStop?: () => Promise<void>;
  onError?: (error: Error) => Promise<void>;
  onStateChange?: (from: PluginLifecycleState, to: PluginLifecycleState) => Promise<void>;
}

/**
 * 插件生命周期服务
 * 负责管理单个插件的生命周期状态转换
 */
export class PluginLifecycleService extends EventEmitter {
  private state: PluginLifecycleState = 'registered';
  private hooks: LifecycleHooks = {};
  private stateHistory: Array<{ state: PluginLifecycleState; timestamp: number }> = [];
  private error: Error | undefined;

  constructor(
    private readonly pluginId: string,
    private readonly pluginMeta: PluginMeta,
    private readonly pluginContext: PluginContext,
  ) {
    super();
    this.stateHistory.push({ state: 'registered', timestamp: Date.now() });
  }

  /**
   * 获取当前状态
   */
  getState(): PluginLifecycleState {
    return this.state;
  }

  /**
   * 获取插件 ID
   */
  getPluginId(): string {
    return this.pluginId;
  }

  /**
   * 获取插件元信息
   */
  getMeta(): PluginMeta {
    return this.pluginMeta;
  }

  /**
   * 获取插件上下文
   */
  getContext(): PluginContext {
    return this.pluginContext;
  }

  /**
   * 获取插件统计信息
   */
  getStats(): PluginStats {
    return {
      pluginId: this.pluginId,
      name: this.pluginMeta.name,
      version: this.pluginMeta.version,
      type: this.pluginMeta.type,
      state: this.state,
      loadTime: this.stateHistory[0]?.timestamp || Date.now(),
      uptime: this.state === 'running' ? Date.now() - this.getStartTime() : 0,
      errorCount: this.error ? 1 : 0,
      lastError: this.error?.message,
    };
  }

  /**
   * 获取启动时间
   */
  private getStartTime(): number {
    const startEvent = this.stateHistory.find(h => h.state === 'running');
    return startEvent?.timestamp || Date.now();
  }

  /**
   * 获取状态历史
   */
  getStateHistory(): Array<{ state: PluginLifecycleState; timestamp: number }> {
    return [...this.stateHistory];
  }

  /**
   * 获取错误
   */
  getError(): Error | undefined {
    return this.error;
  }

  /**
   * 设置生命周期钩子
   */
  setHooks(hooks: LifecycleHooks): void {
    this.hooks = { ...this.hooks, ...hooks };
  }

  /**
   * 状态转换验证
   */
  private canTransitionTo(targetState: PluginLifecycleState): boolean {
    const validTransitions: Record<PluginLifecycleState, PluginLifecycleState[]> = {
      registered: ['initializing', 'unloaded'],
      initializing: ['ready', 'error', 'unloaded'],
      ready: ['starting', 'unloaded'],
      starting: ['running', 'error', 'stopped'],
      running: ['stopping', 'error'],
      stopping: ['stopped', 'error'],
      stopped: ['starting', 'unloaded'],
      error: ['stopping', 'unloaded'],
      unloaded: [], // 终态
    };

    return validTransitions[this.state]?.includes(targetState) ?? false;
  }

  /**
   * 执行状态转换
   */
  private async transitionTo(targetState: PluginLifecycleState): Promise<void> {
    if (!this.canTransitionTo(targetState)) {
      throw new Error(
        `插件 ${this.pluginId} 无法从状态 ${this.state} 转换到 ${targetState}`,
      );
    }

    const fromState = this.state;
    this.state = targetState;
    this.stateHistory.push({ state: targetState, timestamp: Date.now() });

    // 触发状态变化事件
    this.emit('stateChange', {
      pluginId: this.pluginId,
      from: fromState,
      to: targetState,
      timestamp: Date.now(),
    });

    // 调用钩子
    if (this.hooks.onStateChange) {
      try {
        await this.hooks.onStateChange(fromState, targetState);
      } catch (hookError) {
        console.error(`插件 ${this.pluginId} 状态变化钩子执行失败:`, hookError);
      }
    }
  }

  /**
   * 初始化插件
   */
  async initialize(): Promise<void> {
    if (this.state !== 'registered') {
      throw new Error(
        `插件 ${this.pluginId} 只能在 registered 状态下初始化，当前状态: ${this.state}`,
      );
    }

    try {
      await this.transitionTo('initializing');

      if (this.hooks.onBeforeInitialize) {
        await this.hooks.onBeforeInitialize();
      }

      await this.transitionTo('ready');

      if (this.hooks.onAfterInitialize) {
        await this.hooks.onAfterInitialize();
      }

      this.emit('initialized', { pluginId: this.pluginId, timestamp: Date.now() });
    } catch (error) {
      this.error = error instanceof Error ? error : new Error(String(error));
      await this.transitionTo('error');
      if (this.hooks.onError) {
        await this.hooks.onError(this.error);
      }
      throw this.error;
    }
  }

  /**
   * 启动插件
   */
  async start(): Promise<void> {
    if (this.state !== 'ready' && this.state !== 'stopped') {
      throw new Error(
        `插件 ${this.pluginId} 只能在 ready 或 stopped 状态下启动，当前状态: ${this.state}`,
      );
    }

    try {
      await this.transitionTo('starting');

      if (this.hooks.onBeforeStart) {
        await this.hooks.onBeforeStart();
      }

      await this.transitionTo('running');

      if (this.hooks.onAfterStart) {
        await this.hooks.onAfterStart();
      }

      this.emit('started', { pluginId: this.pluginId, timestamp: Date.now() });
    } catch (error) {
      this.error = error instanceof Error ? error : new Error(String(error));
      await this.transitionTo('error');
      if (this.hooks.onError) {
        await this.hooks.onError(this.error);
      }
      throw this.error;
    }
  }

  /**
   * 停止插件
   */
  async stop(): Promise<void> {
    if (this.state !== 'running') {
      throw new Error(
        `插件 ${this.pluginId} 只能在 running 状态下停止，当前状态: ${this.state}`,
      );
    }

    try {
      await this.transitionTo('stopping');

      if (this.hooks.onBeforeStop) {
        await this.hooks.onBeforeStop();
      }

      await this.transitionTo('stopped');

      if (this.hooks.onAfterStop) {
        await this.hooks.onAfterStop();
      }

      this.emit('stopped', { pluginId: this.pluginId, timestamp: Date.now() });
    } catch (error) {
      this.error = error instanceof Error ? error : new Error(String(error));
      await this.transitionTo('error');
      if (this.hooks.onError) {
        await this.hooks.onError(this.error);
      }
      throw this.error;
    }
  }

  /**
   * 卸载插件
   */
  async unload(): Promise<void> {
    const unloadableStates: PluginLifecycleState[] = [
      'registered',
      'ready',
      'stopped',
      'error',
    ];

    if (!unloadableStates.includes(this.state)) {
      throw new Error(
        `插件 ${this.pluginId} 无法从状态 ${this.state} 卸载`,
      );
    }

    // 如果正在运行，先停止
    if (this.state === 'running') {
      await this.stop();
    }

    await this.transitionTo('unloaded');
    this.emit('unloaded', { pluginId: this.pluginId, timestamp: Date.now() });
  }

  /**
   * 从错误状态恢复
   */
  async recover(): Promise<void> {
    if (this.state !== 'error') {
      throw new Error(`插件 ${this.pluginId} 不在错误状态，无法恢复`);
    }

    this.error = undefined;
    await this.transitionTo('ready');
  }

  /**
   * 检查插件是否可执行
   */
  isExecutable(): boolean {
    return this.state === 'running';
  }

  /**
   * 检查插件是否已加载
   */
  isLoaded(): boolean {
    return this.state !== 'registered' && this.state !== 'unloaded';
  }

  /**
   * 检查插件是否有错误
   */
  hasError(): boolean {
    return this.state === 'error' || this.error !== undefined;
  }
}

/**
 * 创建插件生命周期服务
 */
export function createLifecycleService(
  pluginId: string,
  pluginMeta: PluginMeta,
  pluginContext: PluginContext,
): PluginLifecycleService {
  return new PluginLifecycleService(pluginId, pluginMeta, pluginContext);
}
