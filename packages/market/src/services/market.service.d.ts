/**
 * 插件市场服务
 * 负责与远程插件市场 API 交互
 */
import type { MarketEntry, SearchResult, SearchFilters, MarketConfig, MarketStats, PluginCategory, PluginType } from '../types/market.types';
/**
 * 插件市场 API 错误
 */
export declare class MarketApiError extends Error {
    readonly code: string;
    readonly statusCode?: number | undefined;
    readonly details?: unknown | undefined;
    constructor(message: string, code: string, statusCode?: number | undefined, details?: unknown | undefined);
}
/**
 * 插件市场服务
 */
export declare class MarketService {
    private readonly client;
    private readonly config;
    constructor(config: MarketConfig);
    /**
     * 获取插件市场统计信息
     */
    getStats(): Promise<MarketStats>;
    /**
     * 获取所有分类
     */
    getCategories(): Promise<PluginCategory[]>;
    /**
     * 搜索插件
     */
    search(filters: SearchFilters, page?: number, pageSize?: number): Promise<SearchResult>;
    /**
     * 获取插件详情
     */
    getPlugin(id: string): Promise<MarketEntry>;
    /**
     * 获取插件版本列表
     */
    getVersions(id: string): Promise<MarketEntry['versions']>;
    /**
     * 获取热门插件
     */
    getPopular(type?: PluginType, limit?: number): Promise<MarketEntry[]>;
    /**
     * 获取最新插件
     */
    getLatest(type?: PluginType, limit?: number): Promise<MarketEntry[]>;
    /**
     * 获取推荐插件
     */
    getRecommended(limit?: number): Promise<MarketEntry[]>;
    /**
     * 检查更新
     */
    checkUpdate(id: string, currentVersion: string): Promise<{
        hasUpdate: boolean;
        latestVersion?: string;
        changelog?: string;
    }>;
    /**
     * 批量获取插件信息
     */
    getPlugins(ids: string[]): Promise<MarketEntry[]>;
    /**
     * 获取插件下载链接
     */
    getDownloadUrl(id: string, version?: string): Promise<string>;
    /**
     * 处理 API 错误
     */
    private handleError;
}
/**
 * 创建市场服务实例
 */
export declare function createMarketService(config?: Partial<MarketConfig>): MarketService;
//# sourceMappingURL=market.service.d.ts.map