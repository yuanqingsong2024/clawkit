/**
 * 插件市场 API 路由
 * 提供插件搜索、安装、管理等 API 接口
 */
import { Router } from 'express';
import type { MarketService } from '../services/market.service';
import { PluginInstaller } from '../services/plugin-installer.service';
/**
 * 创建插件市场路由
 */
export declare function createMarketRoutes(marketService: MarketService, installer: PluginInstaller): Router;
//# sourceMappingURL=market-routes.d.ts.map