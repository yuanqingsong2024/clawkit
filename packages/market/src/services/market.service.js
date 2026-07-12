/**
 * 插件市场服务
 * 负责与远程插件市场 API 交互
 */
import axios from 'axios';
/**
 * 插件市场 API 错误
 */
export class MarketApiError extends Error {
    code;
    statusCode;
    details;
    constructor(message, code, statusCode, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'MarketApiError';
    }
}
/**
 * 插件市场服务
 */
export class MarketService {
    client;
    config;
    constructor(config) {
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
    async getStats() {
        try {
            const response = await this.client.get('/api/market/stats');
            return response.data;
        }
        catch (error) {
            throw this.handleError(error, '获取市场统计失败');
        }
    }
    /**
     * 获取所有分类
     */
    async getCategories() {
        try {
            const response = await this.client.get('/api/market/categories');
            return response.data.categories;
        }
        catch (error) {
            throw this.handleError(error, '获取分类失败');
        }
    }
    /**
     * 搜索插件
     */
    async search(filters, page = 1, pageSize = 20) {
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
            const response = await this.client.get(`/api/market/search?${params}`);
            return response.data;
        }
        catch (error) {
            throw this.handleError(error, '搜索插件失败');
        }
    }
    /**
     * 获取插件详情
     */
    async getPlugin(id) {
        try {
            const response = await this.client.get(`/api/market/plugins/${encodeURIComponent(id)}`);
            return response.data;
        }
        catch (error) {
            throw this.handleError(error, `获取插件 ${id} 详情失败`);
        }
    }
    /**
     * 获取插件版本列表
     */
    async getVersions(id) {
        try {
            const response = await this.client.get(`/api/market/plugins/${encodeURIComponent(id)}/versions`);
            return response.data.versions;
        }
        catch (error) {
            throw this.handleError(error, `获取插件 ${id} 版本失败`);
        }
    }
    /**
     * 获取热门插件
     */
    async getPopular(type, limit = 10) {
        try {
            const params = new URLSearchParams({ limit: String(limit) });
            if (type) {
                params.set('type', type);
            }
            const response = await this.client.get(`/api/market/popular?${params}`);
            return response.data.entries;
        }
        catch (error) {
            throw this.handleError(error, '获取热门插件失败');
        }
    }
    /**
     * 获取最新插件
     */
    async getLatest(type, limit = 10) {
        try {
            const params = new URLSearchParams({ limit: String(limit) });
            if (type) {
                params.set('type', type);
            }
            const response = await this.client.get(`/api/market/latest?${params}`);
            return response.data.entries;
        }
        catch (error) {
            throw this.handleError(error, '获取最新插件失败');
        }
    }
    /**
     * 获取推荐插件
     */
    async getRecommended(limit = 10) {
        try {
            const response = await this.client.get(`/api/market/recommended?limit=${limit}`);
            return response.data.entries;
        }
        catch (error) {
            throw this.handleError(error, '获取推荐插件失败');
        }
    }
    /**
     * 检查更新
     */
    async checkUpdate(id, currentVersion) {
        try {
            const response = await this.client.get(`/api/market/plugins/${encodeURIComponent(id)}/check-update`, {
                params: { currentVersion },
            });
            return response.data;
        }
        catch (error) {
            throw this.handleError(error, `检查插件 ${id} 更新失败`);
        }
    }
    /**
     * 批量获取插件信息
     */
    async getPlugins(ids) {
        try {
            const response = await this.client.post('/api/market/plugins/batch', {
                ids,
            });
            return response.data.entries;
        }
        catch (error) {
            throw this.handleError(error, '批量获取插件失败');
        }
    }
    /**
     * 获取插件下载链接
     */
    async getDownloadUrl(id, version) {
        try {
            const params = version ? { version } : {};
            const response = await this.client.get(`/api/market/plugins/${encodeURIComponent(id)}/download`, { params });
            return response.data.url;
        }
        catch (error) {
            throw this.handleError(error, `获取插件 ${id} 下载链接失败`);
        }
    }
    /**
     * 处理 API 错误
     */
    handleError(error, fallbackMessage) {
        if (axios.isAxiosError(error)) {
            const statusCode = error.response?.status;
            const code = error.response?.data?.code || 'UNKNOWN_ERROR';
            const message = error.response?.data?.message || error.message || fallbackMessage;
            return new MarketApiError(message, code, statusCode, error.response?.data);
        }
        return new MarketApiError(fallbackMessage, 'INTERNAL_ERROR', undefined, error);
    }
}
// 默认市场配置
const DEFAULT_MARKET_CONFIG = {
    serverUrl: process.env.CLAWKIT_MARKET_URL || 'https://market.clawkit.dev',
};
/**
 * 创建市场服务实例
 */
export function createMarketService(config) {
    return new MarketService({
        ...DEFAULT_MARKET_CONFIG,
        ...config,
    });
}
//# sourceMappingURL=market.service.js.map