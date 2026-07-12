/**
 * 插件市场 API 路由
 * 提供插件浏览、搜索、安装、卸载功能
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { PluginMarketplaceService } from '../../services/plugin-marketplace.service';
import { sendSuccess, sendFailure } from '../types/api-response';
import type { PluginSearchOptions } from '../../services/plugin-marketplace.service';
import type { PluginType } from '@clawkit/plugin-core';

/**
 * 搜索插件请求参数
 */
interface SearchPluginsQuery {
  keyword?: string;
  type?: PluginType;
  installedOnly?: string;
  sortBy?: 'name' | 'downloads' | 'rating' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: string;
  pageSize?: string;
}

/**
 * 安装插件请求参数
 */
interface InstallPluginBody {
  source: string;
}

/**
 * 卸载插件请求参数
 */
interface UninstallPluginBody {
  name: string;
}

/**
 * 评分请求参数
 */
interface RatePluginBody {
  name: string;
  rating: number;
}

/**
 * 创建插件市场路由
 */
export function createPluginMarketplaceRoutes(
  marketplaceService: PluginMarketplaceService,
): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    /**
     * 获取插件列表
     * GET /api/plugins
     */
    app.get('/', async (_request, reply) => {
      try {
        const plugins = marketplaceService.getAllPlugins();
        sendSuccess(reply, {
          code: 'plugins.list.fetched',
          message: '插件列表获取成功',
          data: plugins,
        });
      } catch (error) {
        sendFailure(reply, {
          code: 'plugins.list.error',
          message: '获取插件列表失败',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    /**
     * 搜索插件
     * GET /api/plugins/search
     */
    app.get<{ Querystring: SearchPluginsQuery }>('/search', async (request, reply) => {
      try {
        const { keyword, type, installedOnly, sortBy, sortOrder, page, pageSize } = request.query;

        const options: PluginSearchOptions = {
          keyword,
          type,
          installedOnly: installedOnly === 'true',
          sortBy: sortBy || 'downloads',
          sortOrder: sortOrder || 'desc',
          page: page ? parseInt(page, 10) : 1,
          pageSize: pageSize ? parseInt(pageSize, 10) : 20,
        };

        const result = marketplaceService.searchPlugins(options);
        sendSuccess(reply, {
          code: 'plugins.search.success',
          message: '插件搜索成功',
          data: result,
        });
      } catch (error) {
        sendFailure(reply, {
          code: 'plugins.search.error',
          message: '插件搜索失败',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    /**
     * 获取插件详情
     * GET /api/plugins/:name
     */
    app.get<{ Params: { name: string } }>('/:name', async (request, reply) => {
      try {
        const { name } = request.params;
        const plugin = marketplaceService.getPlugin(name);

        if (!plugin) {
          sendFailure(reply, {
            statusCode: 404,
            code: 'plugins.not_found',
            message: `插件 ${name} 不存在`,
            details: null,
          });
          return;
        }

        // 增加下载次数
        marketplaceService.incrementDownloads(name);

        sendSuccess(reply, {
          code: 'plugins.detail.fetched',
          message: '插件详情获取成功',
          data: plugin,
        });
      } catch (error) {
        sendFailure(reply, {
          code: 'plugins.detail.error',
          message: '获取插件详情失败',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    /**
     * 获取已安装插件
     * GET /api/plugins/installed
     */
    app.get('/installed', async (_request, reply) => {
      try {
        const installed = marketplaceService.getInstalledPlugins();
        sendSuccess(reply, {
          code: 'plugins.installed.fetched',
          message: '已安装插件获取成功',
          data: installed,
        });
      } catch (error) {
        sendFailure(reply, {
          code: 'plugins.installed.error',
          message: '获取已安装插件失败',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    /**
     * 安装插件
     * POST /api/plugins/install
     */
    app.post<{ Body: InstallPluginBody }>('/install', async (request, reply) => {
      try {
        const { source } = request.body;

        if (!source) {
          sendFailure(reply, {
            statusCode: 400,
            code: 'plugins.install.invalid_params',
            message: '缺少插件来源',
            details: null,
          });
          return;
        }

        const result = await marketplaceService.installPlugin(source);

        if (result.success) {
          sendSuccess(reply, {
            code: 'plugins.install.success',
            message: `插件 ${result.name} 安装成功`,
            data: result,
          });
        } else {
          sendFailure(reply, {
            statusCode: 400,
            code: 'plugins.install.failed',
            message: result.error || '插件安装失败',
            details: null,
          });
        }
      } catch (error) {
        sendFailure(reply, {
          code: 'plugins.install.error',
          message: '插件安装失败',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    /**
     * 卸载插件
     * POST /api/plugins/uninstall
     */
    app.post<{ Body: UninstallPluginBody }>('/uninstall', async (request, reply) => {
      try {
        const { name } = request.body;

        if (!name) {
          sendFailure(reply, {
            statusCode: 400,
            code: 'plugins.uninstall.invalid_params',
            message: '缺少插件名称',
            details: null,
          });
          return;
        }

        const result = await marketplaceService.uninstallPlugin(name);

        if (result.success) {
          sendSuccess(reply, {
            code: 'plugins.uninstall.success',
            message: `插件 ${name} 卸载成功`,
            data: result,
          });
        } else {
          sendFailure(reply, {
            statusCode: 400,
            code: 'plugins.uninstall.failed',
            message: result.error || '插件卸载失败',
            details: null,
          });
        }
      } catch (error) {
        sendFailure(reply, {
          code: 'plugins.uninstall.error',
          message: '插件卸载失败',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    /**
     * 评分插件
     * POST /api/plugins/rate
     */
    app.post<{ Body: RatePluginBody }>('/rate', async (request, reply) => {
      try {
        const { name, rating } = request.body;

        if (!name || rating === undefined) {
          sendFailure(reply, {
            statusCode: 400,
            code: 'plugins.rate.invalid_params',
            message: '缺少参数',
            details: null,
          });
          return;
        }

        if (rating < 1 || rating > 5) {
          sendFailure(reply, {
            statusCode: 400,
            code: 'plugins.rate.invalid_rating',
            message: '评分必须在 1-5 之间',
            details: null,
          });
          return;
        }

        marketplaceService.updateRating(name, rating);
        sendSuccess(reply, {
          code: 'plugins.rate.success',
          message: `插件 ${name} 评分更新成功`,
          data: { name, rating },
        });
      } catch (error) {
        sendFailure(reply, {
          code: 'plugins.rate.error',
          message: '评分更新失败',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });
  };
}
