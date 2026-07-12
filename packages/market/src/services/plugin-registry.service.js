/**
 * 插件注册表服务
 * 负责管理本地已安装插件的注册和查询
 */
/**
 * 默认插件注册表实现
 */
export class DefaultPluginRegistry {
    plugins = new Map();
    register(plugin) {
        this.plugins.set(plugin.id, { ...plugin });
    }
    unregister(id) {
        return this.plugins.delete(id);
    }
    get(id) {
        return this.plugins.get(id);
    }
    has(id) {
        return this.plugins.has(id);
    }
    getAll() {
        return Array.from(this.plugins.values());
    }
    getByType(type) {
        return this.getAll().filter(p => p.type === type);
    }
    getEnabled() {
        return this.getAll().filter(p => p.enabled);
    }
    updateStatus(id, status) {
        const plugin = this.plugins.get(id);
        if (plugin) {
            plugin.status = status;
        }
    }
    enable(id) {
        const plugin = this.plugins.get(id);
        if (plugin) {
            plugin.enabled = true;
            return true;
        }
        return false;
    }
    disable(id) {
        const plugin = this.plugins.get(id);
        if (plugin) {
            plugin.enabled = false;
            return true;
        }
        return false;
    }
    updateConfig(id, config) {
        const plugin = this.plugins.get(id);
        if (plugin) {
            plugin.config = config;
        }
    }
    size() {
        return this.plugins.size;
    }
}
// 全局注册表实例
let globalRegistry;
/**
 * 获取全局插件注册表
 */
export function getPluginRegistry() {
    if (!globalRegistry) {
        globalRegistry = new DefaultPluginRegistry();
    }
    return globalRegistry;
}
/**
 * 设置全局插件注册表
 */
export function setPluginRegistry(registry) {
    globalRegistry = registry;
}
//# sourceMappingURL=plugin-registry.service.js.map