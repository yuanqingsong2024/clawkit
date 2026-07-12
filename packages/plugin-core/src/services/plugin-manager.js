/**
 * 插件管理器
 * 统一管理所有类型插件的注册、加载和生命周期
 */
import { EventEmitter } from 'events';
import { createLifecycleService } from './plugin-lifecycle.service';
/**
 * 插件管理器
 * 管理所有插件的注册、加载、卸载和生命周期
 */
export class PluginManager extends EventEmitter {
    plugins = new Map();
    options;
    executorRegistry;
    triggerRegistry;
    notifierRegistry;
    constructor(options = {}) {
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
    getDefaultSandboxConfig() {
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
    createExecutorRegistry() {
        const factories = new Map();
        return {
            register(plugin) {
                factories.set(plugin.meta.name, {
                    create: async () => plugin,
                    getMeta: () => plugin.meta,
                });
            },
            registerFactory(factory) {
                factories.set(factory.getMeta().name, {
                    create: async () => factory.create({}, {}),
                    getMeta: factory.getMeta,
                });
            },
            get(name) {
                const entry = factories.get(name);
                if (!entry)
                    return undefined;
                return {
                    meta: entry.getMeta(),
                    create: async () => entry.create({}),
                };
            },
            has(name) {
                return factories.has(name);
            },
            getRegisteredNames() {
                return Array.from(factories.keys());
            },
            getAll() {
                return Array.from(factories.values()).map(e => ({ meta: e.getMeta() }));
            },
            setDefault() { },
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
    createTriggerRegistry() {
        const adapters = new Map();
        return {
            register(adapter) {
                adapters.set(adapter.meta.name, adapter);
            },
            registerFactory(factory) {
                // 延迟创建
                adapters.set(factory.getMeta().name, {});
            },
            get(name) {
                return adapters.get(name);
            },
            has(name) {
                return adapters.has(name);
            },
            getRegisteredNames() {
                return Array.from(adapters.keys());
            },
            getAll() {
                return Array.from(adapters.values());
            },
            getAdapter(name) {
                const adapter = adapters.get(name);
                return adapter?.getAdapter();
            },
        };
    }
    /**
     * 创建通知器注册表
     */
    createNotifierRegistry() {
        const notifiers = new Map();
        return {
            register(plugin) {
                notifiers.set(plugin.meta.name, plugin);
            },
            registerFactory(factory) {
                notifiers.set(factory.getMeta().name, {});
            },
            get(name) {
                return notifiers.get(name);
            },
            has(name) {
                return notifiers.has(name);
            },
            getRegisteredNames() {
                return Array.from(notifiers.keys());
            },
            getAll() {
                return Array.from(notifiers.values());
            },
            setDefault() { },
            getDefault() {
                return notifiers.values().next().value;
            },
            send(name, notification) {
                const notifier = notifiers.get(name);
                if (!notifier)
                    return Promise.resolve({ success: false, error: '插件未找到' });
                return notifier.send(notification);
            },
            broadcast(notification) {
                const results = new Map();
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
    register(type, name, version, config, context) {
        const pluginId = `${type}:${name}@${version}`;
        if (this.plugins.has(pluginId)) {
            return {
                success: false,
                pluginId,
                error: `插件 ${pluginId} 已注册`,
            };
        }
        // 构建完整上下文
        const fullContext = {
            dataDir: context?.dataDir || `${this.options.defaultDataDir}/${name}`,
            logDir: context?.logDir || `${this.options.defaultLogDir}/${name}`,
            tempDir: context?.tempDir || `${this.options.defaultDataDir}/${name}/temp`,
            configDir: context?.configDir || `${this.options.defaultDataDir}/${name}/config`,
            env: context?.env || process.env,
            workDir: context?.workDir || process.cwd(),
        };
        // 转换依赖格式
        const rawDeps = config.dependencies;
        let dependencies = {};
        if (Array.isArray(rawDeps)) {
            dependencies = {};
        }
        else if (rawDeps && typeof rawDeps === 'object') {
            dependencies = rawDeps;
        }
        // 构建元信息
        const meta = {
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
        });
        return {
            success: true,
            pluginId,
            meta,
        };
    }
    /**
     * 加载插件
     */
    async load(pluginId) {
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
            });
            return {
                success: true,
                pluginId,
                meta: registration.meta,
            };
        }
        catch (error) {
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
    async start(pluginId) {
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
            });
            return {
                success: true,
                pluginId,
                meta: registration.meta,
            };
        }
        catch (error) {
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
    async stop(pluginId) {
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
            });
            return {
                success: true,
                pluginId,
                meta: registration.meta,
            };
        }
        catch (error) {
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
    async unload(pluginId) {
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
            });
            return {
                success: true,
                pluginId,
            };
        }
        catch (error) {
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
    get(pluginId) {
        return this.plugins.get(pluginId);
    }
    /**
     * 获取插件元信息
     */
    getMeta(pluginId) {
        return this.plugins.get(pluginId)?.meta;
    }
    /**
     * 获取插件生命周期服务
     */
    getLifecycle(pluginId) {
        return this.plugins.get(pluginId)?.lifecycle;
    }
    /**
     * 获取插件状态
     */
    getState(pluginId) {
        return this.plugins.get(pluginId)?.lifecycle.getState();
    }
    /**
     * 获取插件统计信息
     */
    getStats(pluginId) {
        return this.plugins.get(pluginId)?.lifecycle.getStats();
    }
    /**
     * 获取所有已注册的插件
     */
    getAllPlugins() {
        return Array.from(this.plugins.values()).map(p => p.meta);
    }
    /**
     * 按类型获取插件
     */
    getPluginsByType(type) {
        return Array.from(this.plugins.values())
            .filter(p => p.type === type)
            .map(p => p.meta);
    }
    /**
     * 获取所有插件的统计信息
     */
    getAllStats() {
        return Array.from(this.plugins.values()).map(p => p.lifecycle.getStats());
    }
    /**
     * 获取执行器注册表
     */
    getExecutorRegistry() {
        return this.executorRegistry;
    }
    /**
     * 获取触发器注册表
     */
    getTriggerRegistry() {
        return this.triggerRegistry;
    }
    /**
     * 获取通知器注册表
     */
    getNotifierRegistry() {
        return this.notifierRegistry;
    }
    /**
     * 检查插件是否存在
     */
    has(pluginId) {
        return this.plugins.has(pluginId);
    }
    /**
     * 批量加载插件
     */
    async loadAll() {
        const results = [];
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
    async startAll() {
        const results = [];
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
    async stopAll() {
        const results = [];
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
    getRunningCount() {
        return Array.from(this.plugins.values()).filter(p => p.lifecycle.getState() === 'running').length;
    }
    /**
     * 获取错误状态的插件
     */
    getErrorPlugins() {
        return Array.from(this.plugins.values())
            .filter(p => p.lifecycle.hasError())
            .map(p => p.lifecycle.getStats());
    }
    /**
     * 设置生命周期钩子
     */
    setHooks(pluginId, hooks) {
        const lifecycle = this.getLifecycle(pluginId);
        if (lifecycle) {
            lifecycle.setHooks(hooks);
        }
    }
    /**
     * 清理所有插件
     */
    async clear() {
        await this.stopAll();
        for (const pluginId of Array.from(this.plugins.keys())) {
            await this.unload(pluginId);
        }
    }
}
// 全局插件管理器实例
let globalPluginManager;
/**
 * 获取全局插件管理器
 */
export function getPluginManager() {
    if (!globalPluginManager) {
        globalPluginManager = new PluginManager();
    }
    return globalPluginManager;
}
/**
 * 设置全局插件管理器
 */
export function setPluginManager(manager) {
    globalPluginManager = manager;
}
/**
 * 创建新的插件管理器
 */
export function createPluginManager(options) {
    return new PluginManager(options);
}
//# sourceMappingURL=plugin-manager.js.map