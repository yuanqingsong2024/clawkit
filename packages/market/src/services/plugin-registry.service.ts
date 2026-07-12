/**
 * 插件注册表服务
 * 负责管理本地已安装插件的注册和查询
 */

import type {
  PluginConfig,
  PluginType,
  InstalledPlugin as InstalledPluginType,
  PluginStatus,
  MarketEntry,
} from '../types/market.types';

// 重新导出类型以保持向后兼容
export type { InstalledPlugin } from '../types/market.types';
export { PluginStatus } from '../types/market.types';
export type { PluginType };

/**
 * 插件注册表
 */
export interface PluginRegistry {
  /** 注册插件 */
  register(plugin: InstalledPluginType): void;
  /** 注销插件 */
  unregister(id: string): boolean;
  /** 获取插件 */
  get(id: string): InstalledPluginType | undefined;
  /** 检查插件是否已注册 */
  has(id: string): boolean;
  /** 获取所有已注册的插件 */
  getAll(): InstalledPluginType[];
  /** 按类型获取插件 */
  getByType(type: PluginType): InstalledPluginType[];
  /** 获取已启用的插件 */
  getEnabled(): InstalledPluginType[];
  /** 更新插件状态 */
  updateStatus(id: string, status: PluginStatus): void;
  /** 启用插件 */
  enable(id: string): boolean;
  /** 禁用插件 */
  disable(id: string): boolean;
  /** 更新插件配置 */
  updateConfig(id: string, config: PluginConfig[]): void;
  /** 获取插件数量 */
  size(): number;
}

/**
 * 默认插件注册表实现
 */
export class DefaultPluginRegistry implements PluginRegistry {
  private readonly plugins = new Map<string, InstalledPluginType>();

  register(plugin: InstalledPluginType): void {
    this.plugins.set(plugin.id, { ...plugin });
  }

  unregister(id: string): boolean {
    return this.plugins.delete(id);
  }

  get(id: string): InstalledPluginType | undefined {
    return this.plugins.get(id);
  }

  has(id: string): boolean {
    return this.plugins.has(id);
  }

  getAll(): InstalledPluginType[] {
    return Array.from(this.plugins.values());
  }

  getByType(type: PluginType): InstalledPluginType[] {
    return this.getAll().filter(p => p.type === type);
  }

  getEnabled(): InstalledPluginType[] {
    return this.getAll().filter(p => p.enabled);
  }

  updateStatus(id: string, status: PluginStatus): void {
    const plugin = this.plugins.get(id);
    if (plugin) {
      plugin.status = status;
    }
  }

  enable(id: string): boolean {
    const plugin = this.plugins.get(id);
    if (plugin) {
      plugin.enabled = true;
      return true;
    }
    return false;
  }

  disable(id: string): boolean {
    const plugin = this.plugins.get(id);
    if (plugin) {
      plugin.enabled = false;
      return true;
    }
    return false;
  }

  updateConfig(id: string, config: PluginConfig[]): void {
    const plugin = this.plugins.get(id);
    if (plugin) {
      plugin.config = config;
    }
  }

  size(): number {
    return this.plugins.size;
  }
}

// 全局注册表实例
let globalRegistry: DefaultPluginRegistry | undefined;

/**
 * 获取全局插件注册表
 */
export function getPluginRegistry(): DefaultPluginRegistry {
  if (!globalRegistry) {
    globalRegistry = new DefaultPluginRegistry();
  }
  return globalRegistry;
}

/**
 * 设置全局插件注册表
 */
export function setPluginRegistry(registry: DefaultPluginRegistry): void {
  globalRegistry = registry;
}
