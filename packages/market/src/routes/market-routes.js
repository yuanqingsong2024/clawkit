/**
 * 插件市场 API 路由
 * 提供插件搜索、安装、管理等 API 接口
 */
import { Router } from 'express';
import { getPluginRegistry } from '../services/plugin-registry.service';
/**
 * 创建插件市场路由
 */
export function createMarketRoutes(marketService, installer) {
    const router = Router();
    /**
     * 获取市场统计
     */
    router.get('/stats', async (_req, res) => {
        try {
            const stats = await marketService.getStats();
            res.json({ ok: true, data: stats });
        }
        catch (error) {
            handleError(res, error);
        }
    });
    /**
     * 获取分类列表
     */
    router.get('/categories', async (_req, res) => {
        try {
            const categories = await marketService.getCategories();
            res.json({ ok: true, data: categories });
        }
        catch (error) {
            handleError(res, error);
        }
    });
    /**
     * 搜索插件
     */
    router.get('/search', async (req, res) => {
        try {
            const { q, type, categories, tags, author, minRating, sortBy, sortOrder, page = '1', pageSize = '20', } = req.query;
            const result = await marketService.search({
                query: q,
                type: type,
                categories: categories ? categories.split(',') : undefined,
                tags: tags ? tags.split(',') : undefined,
                author: author,
                minRating: minRating ? Number(minRating) : undefined,
                sortBy: sortBy,
                sortOrder: sortOrder,
            }, Number(page), Number(pageSize));
            res.json({ ok: true, data: result });
        }
        catch (error) {
            handleError(res, error);
        }
    });
    /**
     * 获取热门插件
     */
    router.get('/popular', async (req, res) => {
        try {
            const { type, limit = '10' } = req.query;
            const entries = await marketService.getPopular(type, Number(limit));
            res.json({ ok: true, data: entries });
        }
        catch (error) {
            handleError(res, error);
        }
    });
    /**
     * 获取最新插件
     */
    router.get('/latest', async (req, res) => {
        try {
            const { type, limit = '10' } = req.query;
            const entries = await marketService.getLatest(type, Number(limit));
            res.json({ ok: true, data: entries });
        }
        catch (error) {
            handleError(res, error);
        }
    });
    /**
     * 获取推荐插件
     */
    router.get('/recommended', async (req, res) => {
        try {
            const { limit = '10' } = req.query;
            const entries = await marketService.getRecommended(Number(limit));
            res.json({ ok: true, data: entries });
        }
        catch (error) {
            handleError(res, error);
        }
    });
    /**
     * 获取插件详情
     */
    router.get('/plugins/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const entry = await marketService.getPlugin(decodeURIComponent(id));
            res.json({ ok: true, data: entry });
        }
        catch (error) {
            handleError(res, error);
        }
    });
    /**
     * 获取插件版本列表
     */
    router.get('/plugins/:id/versions', async (req, res) => {
        try {
            const { id } = req.params;
            const versions = await marketService.getVersions(decodeURIComponent(id));
            res.json({ ok: true, data: versions });
        }
        catch (error) {
            handleError(res, error);
        }
    });
    /**
     * 检查插件更新
     */
    router.get('/plugins/:id/check-update', async (req, res) => {
        try {
            const { id } = req.params;
            const { currentVersion } = req.query;
            if (!currentVersion || typeof currentVersion !== 'string') {
                res.status(400).json({
                    ok: false,
                    error: { code: 'INVALID_PARAMS', message: '缺少 currentVersion 参数' },
                });
                return;
            }
            const updateInfo = await marketService.checkUpdate(decodeURIComponent(id), currentVersion);
            res.json({ ok: true, data: updateInfo });
        }
        catch (error) {
            handleError(res, error);
        }
    });
    /**
     * 批量获取插件信息
     */
    router.post('/plugins/batch', async (req, res) => {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids)) {
                res.status(400).json({
                    ok: false,
                    error: { code: 'INVALID_PARAMS', message: 'ids 必须是数组' },
                });
                return;
            }
            const entries = await marketService.getPlugins(ids);
            res.json({ ok: true, data: entries });
        }
        catch (error) {
            handleError(res, error);
        }
    });
    /**
     * 获取已安装插件列表
     */
    router.get('/installed', (_req, res) => {
        try {
            const registry = getPluginRegistry();
            const plugins = registry.getAll();
            res.json({ ok: true, data: plugins });
        }
        catch (error) {
            handleError(res, error);
        }
    });
    /**
     * 获取指定已安装插件
     */
    router.get('/installed/:id', (req, res) => {
        try {
            const { id } = req.params;
            const registry = getPluginRegistry();
            const plugin = registry.get(id);
            if (!plugin) {
                res.status(404).json({
                    ok: false,
                    error: { code: 'NOT_FOUND', message: `插件 ${id} 未安装` },
                });
                return;
            }
            res.json({ ok: true, data: plugin });
        }
        catch (error) {
            handleError(res, error);
        }
    });
    /**
     * 安装插件
     */
    router.post('/install', async (req, res) => {
        try {
            const { pluginId, version, autoEnable = true } = req.body;
            if (!pluginId) {
                res.status(400).json({
                    ok: false,
                    error: { code: 'INVALID_PARAMS', message: '缺少 pluginId 参数' },
                });
                return;
            }
            const result = await installer.install({
                pluginId,
                version,
                autoEnable,
            });
            if (result.success) {
                res.json({ ok: true, data: result });
            }
            else {
                res.status(400).json({ ok: false, error: { code: 'INSTALL_FAILED', message: result.error } });
            }
        }
        catch (error) {
            handleError(res, error);
        }
    });
    /**
     * 卸载插件
     */
    router.delete('/uninstall/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { removeFiles = true } = req.query;
            const result = await installer.uninstall(decodeURIComponent(id), {
                removeFiles: removeFiles !== 'false',
            });
            if (result.success) {
                res.json({ ok: true });
            }
            else {
                res.status(400).json({ ok: false, error: { code: 'UNINSTALL_FAILED', message: result.error } });
            }
        }
        catch (error) {
            handleError(res, error);
        }
    });
    /**
     * 更新插件
     */
    router.post('/update/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { version } = req.body;
            const result = await installer.update(decodeURIComponent(id), version);
            if (result.success) {
                res.json({ ok: true, data: result });
            }
            else {
                res.status(400).json({ ok: false, error: { code: 'UPDATE_FAILED', message: result.error } });
            }
        }
        catch (error) {
            handleError(res, error);
        }
    });
    /**
     * 检查所有更新
     */
    router.get('/check-updates', async (_req, res) => {
        try {
            const results = await installer.checkAllUpdates();
            res.json({ ok: true, data: Object.fromEntries(results) });
        }
        catch (error) {
            handleError(res, error);
        }
    });
    /**
     * 启用插件
     */
    router.post('/enable/:id', (req, res) => {
        try {
            const { id } = req.params;
            const registry = getPluginRegistry();
            const success = registry.enable(decodeURIComponent(id));
            if (success) {
                res.json({ ok: true });
            }
            else {
                res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: `插件 ${id} 未安装` } });
            }
        }
        catch (error) {
            handleError(res, error);
        }
    });
    /**
     * 禁用插件
     */
    router.post('/disable/:id', (req, res) => {
        try {
            const { id } = req.params;
            const registry = getPluginRegistry();
            const success = registry.disable(decodeURIComponent(id));
            if (success) {
                res.json({ ok: true });
            }
            else {
                res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: `插件 ${id} 未安装` } });
            }
        }
        catch (error) {
            handleError(res, error);
        }
    });
    return router;
}
/**
 * 处理错误响应
 */
function handleError(res, error) {
    console.error('Market API error:', error);
    if (error instanceof Error && 'code' in error) {
        const apiError = error;
        res.status(apiError.statusCode || 500).json({
            ok: false,
            error: {
                code: apiError.code,
                message: apiError.message,
            },
        });
    }
    else {
        res.status(500).json({
            ok: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: '服务器内部错误',
            },
        });
    }
}
//# sourceMappingURL=market-routes.js.map