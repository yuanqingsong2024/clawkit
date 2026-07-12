/**
 * 插件市场 API 路由
 * 提供插件搜索、安装、管理等 API 接口
 */

// 暂时注释掉 express 相关导入，稍后添加可选依赖
// import { Router, Request, Response } from 'express';
import { MarketService, MarketApiError } from '../services/market.service';
import { PluginInstaller } from '../services/plugin-installer.service';
import { getPluginRegistry } from '../services/plugin-registry.service';
import { MarketEntryStatus } from '../types/market.types';

/**
 * 创建插件市场路由
 * 注意：需要外部传入 Router 实例以避免强制依赖 express
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMarketRoutes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router: any,
  marketService: MarketService,
  installer: PluginInstaller
): void {
  // 类型别名简化
  type RequestHandler = (req: { query?: Record<string, unknown>; params: Record<string, string>; body: Record<string, unknown> }, res: { status: (code: number) => { json: (data: unknown) => void }; json: (data: unknown) => void }) => void;
  type AsyncRequestHandler = (req: { query?: Record<string, unknown>; params: Record<string, string>; body: Record<string, unknown> }, res: { status: (code: number) => { json: (data: unknown) => void }; json: (data: unknown) => void }) => Promise<void>;

  const pluginRegistry = getPluginRegistry();

  /**
   * 错误处理辅助函数
   */
  const handleError = (res: { status: (code: number) => { json: (data: unknown) => void }; json: (data: unknown) => void }, error: unknown): void => {
    if (error instanceof MarketApiError) {
      res.status(error.statusCode || 500).json({
        ok: false,
        error: { code: error.code, message: error.message },
      });
    } else {
      res.status(500).json({
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: String(error) },
      });
    }
  };

  /**
   * 获取市场统计
   */
  router.get('/stats', (async (_req, res) => {
    try {
      const stats = await marketService.getStats();
      res.json({ ok: true, data: stats });
    } catch (error) {
      handleError(res, error);
    }
  }) as AsyncRequestHandler);

  /**
   * 获取分类列表
   */
  router.get('/categories', (async (_req, res) => {
    try {
      const categories = await marketService.getCategories();
      res.json({ ok: true, data: categories });
    } catch (error) {
      handleError(res, error);
    }
  }) as AsyncRequestHandler);

  /**
   * 搜索插件
   */
  router.get('/search', (async (req, res) => {
    try {
      const { q, type, categories, tags, author, minRating, sortBy, sortOrder, page, pageSize } = req.query || {};

      const result = await marketService.search(
        {
          query: q as string | undefined,
          type: type as 'executor' | 'trigger' | 'notifier' | undefined,
          categories: categories ? (categories as string).split(',') : undefined,
          tags: tags ? (tags as string).split(',') : undefined,
          author: author as string | undefined,
          minRating: minRating ? Number(minRating) : undefined,
          sortBy: sortBy as 'downloads' | 'rating' | 'updated' | 'name' | 'published' | undefined,
          sortOrder: sortOrder as 'asc' | 'desc' | undefined,
        },
        Number(page) || 1,
        Number(pageSize) || 20
      );

      res.json({ ok: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  }) as AsyncRequestHandler);

  /**
   * 获取热门插件
   */
  router.get('/popular', (async (req, res) => {
    try {
      const { type, limit } = req.query || {};
      const entries = await marketService.getPopular(
        type as 'executor' | 'trigger' | 'notifier' | undefined,
        Number(limit) || 10
      );
      res.json({ ok: true, data: entries });
    } catch (error) {
      handleError(res, error);
    }
  }) as AsyncRequestHandler);

  /**
   * 获取最新插件
   */
  router.get('/latest', (async (req, res) => {
    try {
      const { type, limit } = req.query || {};
      const entries = await marketService.getLatest(
        type as 'executor' | 'trigger' | 'notifier' | undefined,
        Number(limit) || 10
      );
      res.json({ ok: true, data: entries });
    } catch (error) {
      handleError(res, error);
    }
  }) as AsyncRequestHandler);

  /**
   * 获取推荐插件
   */
  router.get('/recommended', (async (req, res) => {
    try {
      const { limit } = req.query || {};
      const entries = await marketService.getRecommended(Number(limit) || 10);
      res.json({ ok: true, data: entries });
    } catch (error) {
      handleError(res, error);
    }
  }) as AsyncRequestHandler);

  /**
   * 获取插件详情
   */
  router.get('/plugins/:id', (async (req, res) => {
    try {
      const { id } = req.params;
      const entry = await marketService.getPlugin(decodeURIComponent(id));
      res.json({ ok: true, data: entry });
    } catch (error) {
      handleError(res, error);
    }
  }) as AsyncRequestHandler);

  /**
   * 获取插件版本列表
   */
  router.get('/plugins/:id/versions', (async (req, res) => {
    try {
      const { id } = req.params;
      const versions = await marketService.getVersions(decodeURIComponent(id));
      res.json({ ok: true, data: versions });
    } catch (error) {
      handleError(res, error);
    }
  }) as AsyncRequestHandler);

  /**
   * 检查插件更新
   */
  router.get('/plugins/:id/check-update', (async (req, res) => {
    try {
      const { id } = req.params;
      const { currentVersion } = req.query || {};

      if (!currentVersion || typeof currentVersion !== 'string') {
        res.status(400).json({
          ok: false,
          error: { code: 'INVALID_PARAMS', message: '缺少 currentVersion 参数' },
        });
        return;
      }

      const updateInfo = await marketService.checkUpdate(
        decodeURIComponent(id),
        currentVersion
      );
      res.json({ ok: true, data: updateInfo });
    } catch (error) {
      handleError(res, error);
    }
  }) as AsyncRequestHandler);

  /**
   * 批量获取插件信息
   */
  router.post('/plugins/batch', (async (req, res) => {
    try {
      const { ids } = req.body || {};

      if (!Array.isArray(ids)) {
        res.status(400).json({
          ok: false,
          error: { code: 'INVALID_PARAMS', message: 'ids 必须是数组' },
        });
        return;
      }

      const entries = await marketService.getPlugins(ids);
      res.json({ ok: true, data: entries });
    } catch (error) {
      handleError(res, error);
    }
  }) as AsyncRequestHandler);

  /**
   * 获取已安装插件列表
   */
  router.get('/installed', ((_req, res) => {
    try {
      const registry = getPluginRegistry();
      const plugins = registry.getAll();
      res.json({ ok: true, data: plugins });
    } catch (error) {
      handleError(res, error);
    }
  }) as RequestHandler);

  /**
   * 获取指定已安装插件
   */
  router.get('/installed/:id', ((req, res) => {
    try {
      const { id } = req.params;
      const registry = getPluginRegistry();
      const plugin = registry.get(decodeURIComponent(id));

      if (!plugin) {
        res.status(404).json({
          ok: false,
          error: { code: 'NOT_FOUND', message: `插件 ${id} 未安装` },
        });
        return;
      }

      res.json({ ok: true, data: plugin });
    } catch (error) {
      handleError(res, error);
    }
  }) as RequestHandler);

  /**
   * 安装插件
   */
  router.post('/install', (async (req, res) => {
    try {
      const body = req.body || {};
      const pluginId = body.pluginId as string | undefined;
      const version = body.version as string | undefined;
      const autoEnable = body.autoEnable !== undefined ? Boolean(body.autoEnable) : true;

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
      } else {
        res.status(400).json({ ok: false, error: { code: 'INSTALL_FAILED', message: result.error } });
      }
    } catch (error) {
      handleError(res, error);
    }
  }) as AsyncRequestHandler);

  /**
   * 卸载插件
   */
  router.delete('/uninstall/:id', (async (req, res) => {
    try {
      const { id } = req.params;
      const { removeFiles } = req.query || {};

      const result = await installer.uninstall(decodeURIComponent(id), {
        removeFiles: removeFiles !== 'false',
      });

      if (result.success) {
        res.json({ ok: true });
      } else {
        res.status(400).json({ ok: false, error: { code: 'UNINSTALL_FAILED', message: result.error } });
      }
    } catch (error) {
      handleError(res, error);
    }
  }) as AsyncRequestHandler);

  /**
   * 更新插件
   */
  router.post('/update/:id', (async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body || {};
      const version = body.version as string | undefined;

      const result = await installer.update(decodeURIComponent(id), version);

      if (result.success) {
        res.json({ ok: true, data: result });
      } else {
        res.status(400).json({ ok: false, error: { code: 'UPDATE_FAILED', message: result.error } });
      }
    } catch (error) {
      handleError(res, error);
    }
  }) as AsyncRequestHandler);

  /**
   * 检查所有更新
   */
  router.get('/check-updates', (async (_req, res) => {
    try {
      const results = await installer.checkAllUpdates();
      res.json({ ok: true, data: Object.fromEntries(results) });
    } catch (error) {
      handleError(res, error);
    }
  }) as AsyncRequestHandler);

  /**
   * 启用插件
   */
  router.post('/enable/:id', ((req, res) => {
    try {
      const { id } = req.params;
      const registry = getPluginRegistry();
      const success = registry.enable(decodeURIComponent(id));

      if (success) {
        res.json({ ok: true });
      } else {
        res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: `插件 ${id} 未安装` } });
      }
    } catch (error) {
      handleError(res, error);
    }
  }) as RequestHandler);

  /**
   * 禁用插件
   */
  router.post('/disable/:id', ((req, res) => {
    try {
      const { id } = req.params;
      const registry = getPluginRegistry();
      const success = registry.disable(decodeURIComponent(id));

      if (success) {
        res.json({ ok: true });
      } else {
        res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: `插件 ${id} 未安装` } });
      }
    } catch (error) {
      handleError(res, error);
    }
  }) as RequestHandler);
}

/**
 * 处理错误响应 - 使用内联版本
 */
// 注意：此文件中的错误处理已在 createMarketRoutes 函数内部定义
