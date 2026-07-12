/**
 * 插件管理器
 * 统一管理所有类型插件的注册、加载和生命周期
 */

import { EventEmitter } from 'events';
import { createLifecycleService, PluginLifecycleService, type LifecycleHooks } from './plugin-lifecycle.service';
import type {
  PluginType,
  PluginLifecycleState,
  PluginMeta,
  PluginContext,
  PluginConfig,
  PluginStats,
  PluginEvent,
  PluginLoadResult,
  PluginSandboxConfig,
} from '../types/plugin.types';
import type { ExecutorPlugin, ExecutorPluginRegistry } from '../interfaces/executor-plugin.interface';
import type { TriggerPlugin, TriggerPluginRegistry } from '../interfaces/trigger-plugin.interface';
import type { NotifierPlugin, NotifierPluginRegistry } from '../interfaces/notifier-plugin.interface';

/**
 * 插件注册信息
 */
export interface PluginRegistration {
  pluginId: string;
  type: PluginType;
  name: string;
  version: string;
  meta: PluginMeta;
  instance?: ExecutorPlugin | TriggerPlugin | NotifierPlugin;
  lifecycle: PluginLifecycleService;
  config: PluginConfig;
  enabled: boolean;
}

/**
 * 插件管理器选项
 */
export interface PluginManagerOptions {
  /** 默认数据目录 */
  defaultDataDir?: string;
  /** 默认日志目录 */
  defaultLogDir?: string;
  /** 插件沙箱配置 */
  sandbox?: PluginSandboxConfig;
  /** 生命周期钩子 */
  hooks?: Record<string, LifecycleHooks>;
}

/**
 * 插件管理器
 * 管理所有插件的注册、加载、卸载和生命周期
 */
export class PluginManager extends EventEmitter {
  private plugins = new Map<string, PluginRegistration>();
  private options: Required<PluginManagerOptions>;
  private executorRegistry: ExecutorPluginRegistry;
  private triggerRegistry: TriggerPluginRegistry;
  private notifierRegistry: NotifierPluginRegistry;

  constructor(options: PluginManagerOptions = {}) {
    super();
    this.options = {
      defaultDataDir: options.defaultDataDir || './data/plugins',
      defaultLogDir: options.defaultLogDir || './logs/plugins',
      sandbox: options.sandbox || this.getDefaultSandboxConfig(),
      hooks: options.hooks || {},
    };
    this.executorRegistry = this.createExecutorRegistry();
    this.triggerRegistry = this.createTriggerRegistry();
    this.notifierRegistry = this.createNotifierRegistry();
  }

  /**
   * 获取默认沙箱配置
   */
  private getDefaultSandboxConfig(): PluginSandboxConfig {
    return {
      enabled: false,
      allowedModules: [],
      allowedGlobals: ['console', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Math', 'JSON', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Promise', 'Map', 'Set', 'Error'],
      maxMemory: 256 * 1024 * 1024, // 256MB
      maxCpuTime: 30000, // 30秒
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedPaths: [],
      deniedPaths: [],
      networkEnabled: true,
      fileSystemEnabled: true,
    };
  }

  /**
   * 创建执行器注册表
   */
  private createExecutorRegistry(): ExecutorPluginRegistry {
    const factories = new Map<string, { create: (config: PluginConfig) => Promise<ExecutorPlugin>; getMeta: () => ExecutorPlugin['meta'] }>();
    return {
      register(plugin: ExecutorPlugin) {
        factories.set(plugin.meta.name, {
          create: async () => plugin,
          getMeta: () => plugin.meta,
        });
      },
      registerFactory(factory) {
        factories.set(factory.getMeta().name, {
          create: async () => factory.create({} as any, {} as any),
          getMeta: factory.getMeta,
        });
      },
      get(name: string) {
        const entry = factories.get(name);
        if (!entry) return undefined;
        return {
          meta: entry.getMeta(),
          create: async () => entry.create({}),
        } as unknown as ExecutorPlugin;
      },
      has(name: string) {
        return factories.has(name);
      },
      getRegisteredNames() {
        return Array.from(factories.keys());
      },
      getAll() {
        return Array.from(factories.values()).map(e => ({ meta: e.getMeta() }) as ExecutorPlugin);
      },
      setDefault() {},
      getDefault() {
        return undefined;
      },
      getFactory() {
        return undefined;
      },
    };
  }

  /**
   * 创建触发器注册表
   */
  private createTriggerRegistry(): TriggerPluginRegistry {
    const adapters = new Map<string, TriggerPlugin>();
    return {
      register(adapter: TriggerPlugin) {
        adapters.set(adapter.meta.name, adapter);
      },
      registerFactory(factory) {
        // 延迟创建
        adapters.set(factory.getMeta().name, {} as TriggerPlugin);
      },
      get(name: string) {
        return adapters.get(name);
      },
      has(name: string) {
        return adapters.has(name);
      },
      getRegisteredNames() {
        return Array.from(adapters.keys());
      },
      getAll() {
        return Array.from(adapters.values());
      },
      getAdapter(name: string) {
        const adapter = adapters.get(name);
        return adapter?.getAdapter();
      },
    };
  }

  /**
   * 创建通知器注册表
   */
  private createNotifierRegistry(): NotifierPluginRegistry {
    const notifiers = new Map<string, NotifierPlugin>();
    return {
      register(plugin: NotifierPlugin) {
        notifiers.set(plugin.meta.name, plugin);
      },
      registerFactory(factory) {
        notifiers.set(factory.getMeta().name, {} as NotifierPlugin);
      },
      get(name: string) {
        return notifiers.get(name);
      },
      has(name: string) {
        return notifiers.has(name);
      },
      getRegisteredNames() {
        return Array.from(notifiers.keys());
      },
      getAll() {
        return Array.from(notifiers.values());
      },
      setDefault() {},
      getDefault() {
        return notifiers.values().next().value;
      },
      send(name: string, notification) {
        const notifier = notifiers.get(name);
        if (!notifier) return Promise.resolve({ success: false, error: '插件未找到' });
        return notifier.send(notification);
      },
      broadcast(notification) {
        const results = new Map<string, { success: boolean; error?: string }>();
        for (const [name] of notifiers) {
          results.set(name, { success: false, error: '未实现' });
        }
        return Promise.resolve(results);
      },
    };
  }

  /**
   * 注册插件
   */
  register(
    type: PluginType,
    name: string,
    version: string,
    config: PluginConfig,
    context?: Partial<PluginContext>,
  ): PluginLoadResult {
    const pluginId = `${type}:${name}@${version}`;

    if (this.plugins.has(pluginId)) {
      return {
        success: false,
        pluginId,
        error: `插件 ${pluginId} 已注册`,
      };
    }

    // 构建完整上下文
    const fullContext: PluginContext = {
      dataDir: context?.dataDir || `${this.options.defaultDataDir}/${name}`,
      logDir: context?.logDir || `${this.options.defaultLogDir}/${name}`,
      tempDir: context?.tempDir || `${this.options.defaultDataDir}/${name}/temp`,
      configDir: context?.configDir || `${this.options.defaultDataDir}/${name}/config`,
      env: context?.env || process.env as Record<string, string>,
      workDir: context?.workDir || process.cwd(),
    };

    // 转换依赖格式
    const rawDeps = config.dependencies;
    let dependencies: Record<string, string> = {};
    if (Array.isArray(rawDeps)) {
      dependencies = {};
    } else if (rawDeps && typeof rawDeps === 'object') {
      dependencies = rawDeps as Record<string, string>;
    }

    // 构建元信息
    const meta: PluginMeta = {
      name,
      version,
      type,
      description: config.description,
      author: config.author,
      homepage: config.homepage,
      dependencies,
      sandbox: config.sandbox || this.options.sandbox,
    };

    // 创建生命周期服务
    const lifecycle = createLifecycleService(pluginId, meta, fullContext);

    // 设置钩子
    const hooks = this.options.hooks[pluginId];
    if (hooks) {
      lifecycle.setHooks(hooks);
    }

    // 保存注册信息
    this.plugins.set(pluginId, {
      pluginId,
      type,
      name,
      version,
      meta,
      lifecycle,
      config,
      enabled: config.enabled ?? true,
    });

    this.emit('registered', {
      pluginId,
      name: name,
      type: 'plugin:loaded',
      timestamp: Date.now(),
    } as PluginEvent);

    return {
      success: true,
      pluginId,
      meta,
    };
  }

  /**
   * 加载插件
   */
  async load(pluginId: string): Promise<PluginLoadResult> {
    const registration = this.plugins.get(pluginId);
    if (!registration) {
      return {
        success: false,
        pluginId,
        error: `插件 ${pluginId} 未注册`,
      };
    }

    try {
      // 初始化生命周期
      await registration.lifecycle.initialize();

      this.emit('loaded', {
        pluginId,
        name: registration.meta.name,
        type: 'plugin:loaded',
        timestamp: Date.now(),
      } as PluginEvent);

      return {
        success: true,
        pluginId,
        meta: registration.meta,
      };
    } catch (error) {
      return {
        success: false,
        pluginId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 启动插件
   */
  async start(pluginId: string): Promise<PluginLoadResult> {
    const registration = this.plugins.get(pluginId);
    if (!registration) {
      return {
        success: false,
        pluginId,
        error: `插件 ${pluginId} 未注册`,
      };
    }

    try {
      await registration.lifecycle.start();

      this.emit('started', {
        pluginId,
        name: registration.meta.name,
        type: 'plugin:started',
        timestamp: Date.now(),
      } as PluginEvent);

      return {
        success: true,
        pluginId,
        meta: registration.meta,
      };
    } catch (error) {
      return {
        success: false,
        pluginId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 停止插件
   */
  async stop(pluginId: string): Promise<PluginLoadResult> {
    const registration = this.plugins.get(pluginId);
    if (!registration) {
      return {
        success: false,
        pluginId,
        error: `插件 ${pluginId} 未注册`,
      };
    }

    try {
      await registration.lifecycle.stop();

      this.emit('stopped', {
        pluginId,
        name: registration.meta.name,
        type: 'plugin:stopped',
        timestamp: Date.now(),
      } as PluginEvent);

      return {
        success: true,
        pluginId,
        meta: registration.meta,
      };
    } catch (error) {
      return {
        success: false,
        pluginId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 卸载插件
   */
  async unload(pluginId: string): Promise<PluginLoadResult> {
    const registration = this.plugins.get(pluginId);
    if (!registration) {
      return {
        success: false,
        pluginId,
        error: `插件 ${pluginId} 未注册`,
      };
    }

    try {
      await registration.lifecycle.unload();
      this.plugins.delete(pluginId);

      this.emit('unloaded', {
        pluginId,
        name: registration.meta.name,
        type: 'plugin:stopped',
        timestamp: Date.now(),
      } as PluginEvent);

      return {
        success: true,
        pluginId,
      };
    } catch (error) {
      return {
        success: false,
        pluginId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取插件
   */
  get(pluginId: string): PluginRegistration | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * 获取插件元信息
   */
  getMeta(pluginId: string): PluginMeta | undefined {
    return this.plugins.get(pluginId)?.meta;
  }

  /**
   * 获取插件生命周期服务
   */
  getLifecycle(pluginId: string): PluginLifecycleService | undefined {
    return this.plugins.get(pluginId)?.lifecycle;
  }

  /**
   * 获取插件状态
   */
  getState(pluginId: string): PluginLifecycleState | undefined {
    return this.plugins.get(pluginId)?.lifecycle.getState();
  }

  /**
   * 获取插件统计信息
   */
  getStats(pluginId: string): PluginStats | undefined {
    return this.plugins.get(pluginId)?.lifecycle.getStats();
  }

  /**
   * 获取所有已注册的插件
   */
  getAllPlugins(): PluginMeta[] {
    return Array.from(this.plugins.values()).map(p => p.meta);
  }

  /**
   * 按类型获取插件
   */
  getPluginsByType(type: PluginType): PluginMeta[] {
    return Array.from(this.plugins.values())
      .filter(p => p.type === type)
      .map(p => p.meta);
  }

  /**
   * 获取所有插件的统计信息
   */
  getAllStats(): PluginStats[] {
    return Array.from(this.plugins.values()).map(p => p.lifecycle.getStats());
  }

  /**
   * 获取执行器注册表
   */
  getExecutorRegistry(): ExecutorPluginRegistry {
    return this.executorRegistry;
  }

  /**
   * 获取触发器注册表
   */
  getTriggerRegistry(): TriggerPluginRegistry {
    return this.triggerRegistry;
  }

  /**
   * 获取通知器注册表
   */
  getNotifierRegistry(): NotifierPluginRegistry {
    return this.notifierRegistry;
  }

  /**
   * 检查插件是否存在
   */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * 批量加载插件
   */
  async loadAll(): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = [];
    for (const [pluginId, registration] of this.plugins) {
      if (registration.enabled) {
        const result = await this.load(pluginId);
        results.push(result);
      }
    }
    return results;
  }

  /**
   * 批量启动插件
   */
  async startAll(): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = [];
    for (const [pluginId] of this.plugins) {
      const state = this.getState(pluginId);
      if (state === 'ready') {
        const result = await this.start(pluginId);
        results.push(result);
      }
    }
    return results;
  }

  /**
   * 批量停止插件
   */
  async stopAll(): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = [];
    for (const [pluginId] of this.plugins) {
      const state = this.getState(pluginId);
      if (state === 'running') {
        const result = await this.stop(pluginId);
        results.push(result);
      }
    }
    return results;
  }

  /**
   * 获取运行中的插件数量
   */
  getRunningCount(): number {
    return Array.from(this.plugins.values()).filter(
      p => p.lifecycle.getState() === 'running',
    ).length;
  }

  /**
   * 获取错误状态的插件
   */
  getErrorPlugins(): PluginStats[] {
    return Array.from(this.plugins.values())
      .filter(p => p.lifecycle.hasError())
      .map(p => p.lifecycle.getStats());
  }

  /**
   * 设置生命周期钩子
   */
  setHooks(pluginId: string, hooks: LifecycleHooks): void {
    const lifecycle = this.getLifecycle(pluginId);
    if (lifecycle) {
      lifecycle.setHooks(hooks);
    }
  }

  /**
   * 清理所有插件
   */
  async clear(): Promise<void> {
    await this.stopAll();
    for (const pluginId of Array.from(this.plugins.keys())) {
      await this.unload(pluginId);
    }
  }
}

// 全局插件管理器实例
let globalPluginManager: PluginManager | undefined;

/**
 * 获取全局插件管理器
 */
export function getPluginManager(): PluginManager {
  if (!globalPluginManager) {
    globalPluginManager = new PluginManager();
  }
  return globalPluginManager;
}

/**
 * 设置全局插件管理器
 */
export function setPluginManager(manager: PluginManager): void {
  globalPluginManager = manager;
}

/**
 * 创建新的插件管理器
 */
export function createPluginManager(options?: PluginManagerOptions): PluginManager {
  return new PluginManager(options);
}
