/**
 * 插件服务
 * 提供插件市场的管理功能
 */

import { HttpClient } from '../utils/http';
import { Plugin, PluginType, PluginLifecycleState } from '../types';

/**
 * 插件服务类
 */
export class PluginService {
  private readonly http: HttpClient;
  private readonly resource = 'plugins';

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * 获取插件列表
   */
  async list(options?: {
    type?: PluginType;
    search?: string;
  }): Promise<Plugin[]> {
    const params: Record<string, unknown> = {};
    
    if (options?.type) params.type = options.type;
    if (options?.search) params.search = options.search;

    const response = await this.http.get<Plugin[]>(`/api/${this.resource}`, params);
    return Array.isArray(response) ? response : [];
  }

  /**
   * 搜索插件
   */
  async search(query: string): Promise<Plugin[]> {
    return this.http.get<Plugin[]>(`/api/${this.resource}/search`, { q: query });
  }

  /**
   * 获取插件详情
   */
  async get(pluginName: string): Promise<Plugin> {
    return this.http.get<Plugin>(`/api/${this.resource}/${pluginName}`);
  }

  /**
   * 获取已安装插件
   */
  async getInstalled(): Promise<Plugin[]> {
    return this.http.get<Plugin[]>(`/api/${this.resource}/installed`);
  }

  /**
   * 安装插件
   */
  async install(pluginName: string, version?: string): Promise<void> {
    await this.http.post(`/api/${this.resource}/install`, {
      name: pluginName,
      version,
    });
  }

  /**
   * 卸载插件
   */
  async uninstall(pluginName: string): Promise<void> {
    await this.http.post(`/api/${this.resource}/uninstall`, {
      name: pluginName,
    });
  }

  /**
   * 评分插件
   */
  async rate(pluginName: string, rating: number, comment?: string): Promise<void> {
    await this.http.post(`/api/${this.resource}/rate`, {
      name: pluginName,
      rating,
      comment,
    });
  }

  /**
   * 获取执行器插件
   */
  async getExecutors(): Promise<Plugin[]> {
    return this.list({ type: PluginType.EXECUTOR });
  }

  /**
   * 获取触发器插件
   */
  async getTriggers(): Promise<Plugin[]> {
    return this.list({ type: PluginType.TRIGGER });
  }

  /**
   * 获取通知器插件
   */
  async getNotifiers(): Promise<Plugin[]> {
    return this.list({ type: PluginType.NOTIFIER });
  }

  /**
   * 获取活跃插件
   */
  async getActive(): Promise<Plugin[]> {
    const plugins = await this.getInstalled();
    return plugins.filter((p) => p.state === PluginLifecycleState.ACTIVE);
  }
}
