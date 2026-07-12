/**
 * 插件安装服务
 * 负责插件的安装、卸载、更新操作
 */
import type { InstallConfig, InstallResult } from '../types/market.types';
import type { PluginRegistry } from './plugin-registry.service';
import { MarketService } from './market.service';
/**
 * 插件安装器错误
 */
export declare class PluginInstallerError extends Error {
    readonly code: string;
    readonly details?: unknown | undefined;
    constructor(message: string, code: string, details?: unknown | undefined);
}
/**
 * 插件安装器
 */
export declare class PluginInstaller {
    private readonly marketService;
    private readonly registry;
    private readonly baseDir;
    constructor(registry: PluginRegistry, options?: {
        marketService?: MarketService;
        baseDir?: string;
    });
    /**
     * 安装插件
     */
    install(config: InstallConfig): Promise<InstallResult>;
    /**
     * 卸载插件
     */
    uninstall(pluginId: string, options?: {
        removeFiles?: boolean;
    }): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * 更新插件
     */
    update(pluginId: string, targetVersion?: string): Promise<InstallResult>;
    /**
     * 检查所有已安装插件的更新
     */
    checkAllUpdates(): Promise<Map<string, {
        hasUpdate: boolean;
        latestVersion?: string;
        currentVersion: string;
    }>>;
    /**
     * 批量安装插件
     */
    installBatch(configs: InstallConfig[]): Promise<InstallResult[]>;
    /**
     * 下载插件到目标路径
     */
    private downloadPlugin;
    /**
     * 从市场条目提取依赖
     */
    private extractDependencies;
    /**
     * 保存安装配置到本地
     */
    private saveInstallConfig;
    /**
     * 删除本地安装配置
     */
    private removeInstallConfig;
}
/**
 * 创建插件安装器实例
 */
export declare function createPluginInstaller(registry: PluginRegistry): PluginInstaller;
//# sourceMappingURL=plugin-installer.service.d.ts.map