/**
 * 插件市场服务
 * 负责与远程插件市场 API 交互
 */

import axios, { type AxiosInstance } from 'axios';
import type {
  MarketEntry,
  SearchResult,
  SearchFilters,
  MarketConfig,
  MarketStats,
  PluginCategory,
  InstallConfig,
  InstallResult,
  PluginType,
} from '../types/market.types';

/**
 * 插件市场 API 错误
 */
export class MarketApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'MarketApiError';
  }
}

/**
 * 插件市场服务
 */
export class MarketService {
  private readonly client: AxiosInstance;
  private readonly config: Required<MarketConfig>;

  constructor(config: MarketConfig) {
    this.config = {
      serverUrl: config.serverUrl.replace(/\/$/, ''),
      apiKey: config.apiKey || '',
      cacheDir: config.cacheDir || '.clawkit/cache',
      cacheTtl: config.cacheTtl || 5 * 60 * 1000, // 5分钟
      useProxy: config.useProxy || false,
      proxyUrl: config.proxyUrl || '',
      downloadTimeout: config.downloadTimeout || 300000, // 5分钟
    };

    this.client = axios.create({
      baseURL: this.config.serverUrl,
      timeout: this.config.downloadTimeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
      },
    });
  }

  /**
   * 获取插件市场统计信息
   */
  async getStats(): Promise<MarketStats> {
    try {
      const response = await this.client.get<MarketStats>('/api/market/stats');
      return response.data;
    } catch (error) {
      throw this.handleError(error, '获取市场统计失败');
    }
  }

  /**
   * 获取所有分类
   */
  async getCategories(): Promise<PluginCategory[]> {
    try {
      const response = await this.client.get<{ categories: PluginCategory[] }>('/api/market/categories');
      return response.data.categories;
    } catch (error) {
      throw this.handleError(error, '获取分类失败');
    }
  }

  /**
   * 搜索插件
   */
  async search(filters: SearchFilters, page = 1, pageSize = 20): Promise<SearchResult> {
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(filters.type && { type: filters.type }),
        ...(filters.query && { q: filters.query }),
        ...(filters.sortBy && { sortBy: filters.sortBy }),
        ...(filters.sortOrder && { sortOrder: filters.sortOrder }),
      });

      if (filters.categories?.length) {
        params.set('categories', filters.categories.join(','));
      }
      if (filters.tags?.length) {
        params.set('tags', filters.tags.join(','));
      }
      if (filters.author) {
        params.set('author', filters.author);
      }
      if (filters.minRating !== undefined) {
        params.set('minRating', String(filters.minRating));
      }

      const response = await this.client.get<SearchResult>(`/api/market/search?${params}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, '搜索插件失败');
    }
  }

  /**
   * 获取插件详情
   */
  async getPlugin(id: string): Promise<MarketEntry> {
    try {
      const response = await this.client.get<MarketEntry>(`/api/market/plugins/${encodeURIComponent(id)}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, `获取插件 ${id} 详情失败`);
    }
  }

  /**
   * 获取插件版本列表
   */
  async getVersions(id: string): Promise<MarketEntry['versions']> {
    try {
      const response = await this.client.get<{ versions: MarketEntry['versions'] }>(
        `/api/market/plugins/${encodeURIComponent(id)}/versions`
      );
      return response.data.versions;
    } catch (error) {
      throw this.handleError(error, `获取插件 ${id} 版本失败`);
    }
  }

  /**
   * 获取热门插件
   */
  async getPopular(type?: PluginType, limit = 10): Promise<MarketEntry[]> {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (type) {
        params.set('type', type);
      }
      const response = await this.client.get<{ entries: MarketEntry[] }>(`/api/market/popular?${params}`);
      return response.data.entries;
    } catch (error) {
      throw this.handleError(error, '获取热门插件失败');
    }
  }

  /**
   * 获取最新插件
   */
  async getLatest(type?: PluginType, limit = 10): Promise<MarketEntry[]> {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (type) {
        params.set('type', type);
      }
      const response = await this.client.get<{ entries: MarketEntry[] }>(`/api/market/latest?${params}`);
      return response.data.entries;
    } catch (error) {
      throw this.handleError(error, '获取最新插件失败');
    }
  }

  /**
   * 获取推荐插件
   */
  async getRecommended(limit = 10): Promise<MarketEntry[]> {
    try {
      const response = await this.client.get<{ entries: MarketEntry[] }>(
        `/api/market/recommended?limit=${limit}`
      );
      return response.data.entries;
    } catch (error) {
      throw this.handleError(error, '获取推荐插件失败');
    }
  }

  /**
   * 检查更新
   */
  async checkUpdate(id: string, currentVersion: string): Promise<{
    hasUpdate: boolean;
    latestVersion?: string;
    changelog?: string;
  }> {
    try {
      const response = await this.client.get<{
        hasUpdate: boolean;
        latestVersion?: string;
        changelog?: string;
      }>(`/api/market/plugins/${encodeURIComponent(id)}/check-update`, {
        params: { currentVersion },
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, `检查插件 ${id} 更新失败`);
    }
  }

  /**
   * 批量获取插件信息
   */
  async getPlugins(ids: string[]): Promise<MarketEntry[]> {
    try {
      const response = await this.client.post<{ entries: MarketEntry[] }>('/api/market/plugins/batch', {
        ids,
      });
      return response.data.entries;
    } catch (error) {
      throw this.handleError(error, '批量获取插件失败');
    }
  }

  /**
   * 获取插件下载链接
   */
  async getDownloadUrl(id: string, version?: string): Promise<string> {
    try {
      const params = version ? { version } : {};
      const response = await this.client.get<{ url: string }>(
        `/api/market/plugins/${encodeURIComponent(id)}/download`,
        { params }
      );
      return response.data.url;
    } catch (error) {
      throw this.handleError(error, `获取插件 ${id} 下载链接失败`);
    }
  }

  /**
   * 处理 API 错误
   */
  private handleError(error: unknown, fallbackMessage: string): MarketApiError {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const code = (error.response?.data as { code?: string })?.code || 'UNKNOWN_ERROR';
      const message = (error.response?.data as { message?: string })?.message || error.message || fallbackMessage;
      return new MarketApiError(message, code, statusCode, error.response?.data);
    }
    return new MarketApiError(fallbackMessage, 'INTERNAL_ERROR', undefined, error);
  }
}

// 默认市场配置
const DEFAULT_MARKET_CONFIG: MarketConfig = {
  serverUrl: process.env.CLAWKIT_MARKET_URL || 'https://market.clawkit.dev',
};

/**
 * 创建市场服务实例
 */
export function createMarketService(config?: Partial<MarketConfig>): MarketService {
  return new MarketService({
    ...DEFAULT_MARKET_CONFIG,
    ...config,
  });
}
