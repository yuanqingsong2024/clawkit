/**
 * 插件安装服务
 * 负责插件的安装、卸载、更新操作
 */
import { mkdir, rm, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { execSync } from 'child_process';
import { createMarketService } from './market.service';
/**
 * 插件安装器错误
 */
export class PluginInstallerError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'PluginInstallerError';
    }
}
/**
 * 插件安装器
 */
export class PluginInstaller {
    marketService;
    registry;
    baseDir;
    constructor(registry, options) {
        this.registry = registry;
        this.marketService = options?.marketService || createMarketService();
        this.baseDir = options?.baseDir || join(process.cwd(), '.clawkit', 'plugins');
    }
    /**
     * 安装插件
     */
    async install(config) {
        const { pluginId, version, installPath, autoEnable = true } = config;
        try {
            // 获取插件信息
            const marketEntry = await this.marketService.getPlugin(pluginId);
            // 检查是否已安装
            if (this.registry.has(pluginId)) {
                return {
                    success: false,
                    error: `插件 ${pluginId} 已安装`,
                    plugin: marketEntry,
                };
            }
            // 确定安装路径
            const targetPath = installPath || join(this.baseDir, pluginId.replace('/', '-'));
            // 更新注册表状态
            this.registry.updateStatus(pluginId, 'installed');
            // 下载插件
            const downloadUrl = await this.marketService.getDownloadUrl(pluginId, version);
            await this.downloadPlugin(downloadUrl, targetPath);
            // 创建已安装插件信息
            const installedPlugin = {
                id: pluginId,
                name: marketEntry.name,
                type: marketEntry.type,
                version: version || marketEntry.version,
                description: marketEntry.description,
                installPath: targetPath,
                status: 'installed',
                enabled: autoEnable,
                installedAt: Date.now(),
                updatedAt: Date.now(),
                dependencies: this.extractDependencies(marketEntry),
                marketEntry,
            };
            // 注册插件
            this.registry.register(installedPlugin);
            // 保存安装信息到本地配置
            await this.saveInstallConfig(installedPlugin);
            return {
                success: true,
                plugin: marketEntry,
                installPath: targetPath,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '安装失败';
            return {
                success: false,
                error: `安装插件 ${pluginId} 失败：${message}`,
            };
        }
    }
    /**
     * 卸载插件
     */
    async uninstall(pluginId, options) {
        const { removeFiles = true } = options || {};
        try {
            const plugin = this.registry.get(pluginId);
            if (!plugin) {
                return {
                    success: false,
                    error: `插件 ${pluginId} 未安装`,
                };
            }
            // 更新注册表状态
            this.registry.updateStatus(pluginId, 'uninstalling');
            // 删除插件文件
            if (removeFiles) {
                await rm(plugin.installPath, { recursive: true, force: true });
            }
            // 从注册表移除
            this.registry.unregister(pluginId);
            // 删除本地配置
            await this.removeInstallConfig(pluginId);
            return { success: true };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '卸载失败';
            this.registry.updateStatus(pluginId, 'error');
            return {
                success: false,
                error: `卸载插件 ${pluginId} 失败：${message}`,
            };
        }
    }
    /**
     * 更新插件
     */
    async update(pluginId, targetVersion) {
        try {
            const plugin = this.registry.get(pluginId);
            if (!plugin) {
                return {
                    success: false,
                    error: `插件 ${pluginId} 未安装`,
                };
            }
            // 检查更新
            const updateInfo = await this.marketService.checkUpdate(pluginId, plugin.version);
            if (!updateInfo.hasUpdate) {
                return {
                    success: false,
                    error: `插件 ${pluginId} 已是最新版本 ${plugin.version}`,
                };
            }
            const versionToInstall = targetVersion || updateInfo.latestVersion;
            const marketEntry = await this.marketService.getPlugin(pluginId);
            // 更新注册表状态
            this.registry.updateStatus(pluginId, 'updating');
            // 下载新版本
            const downloadUrl = await this.marketService.getDownloadUrl(pluginId, versionToInstall);
            await this.downloadPlugin(downloadUrl, plugin.installPath);
            // 更新插件信息
            plugin.version = versionToInstall;
            plugin.updatedAt = Date.now();
            plugin.status = 'installed';
            this.registry.register(plugin);
            // 更新本地配置
            await this.saveInstallConfig(plugin);
            return {
                success: true,
                plugin: marketEntry,
                installPath: plugin.installPath,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '更新失败';
            this.registry.updateStatus(pluginId, 'error');
            return {
                success: false,
                error: `更新插件 ${pluginId} 失败：${message}`,
            };
        }
    }
    /**
     * 检查所有已安装插件的更新
     */
    async checkAllUpdates() {
        const results = new Map();
        const plugins = this.registry.getAll();
        for (const plugin of plugins) {
            try {
                const updateInfo = await this.marketService.checkUpdate(plugin.id, plugin.version);
                results.set(plugin.id, {
                    hasUpdate: updateInfo.hasUpdate,
                    latestVersion: updateInfo.latestVersion,
                    currentVersion: plugin.version,
                });
            }
            catch {
                // 忽略单个插件检查失败
                results.set(plugin.id, {
                    hasUpdate: false,
                    currentVersion: plugin.version,
                });
            }
        }
        return results;
    }
    /**
     * 批量安装插件
     */
    async installBatch(configs) {
        const results = [];
        for (const config of configs) {
            const result = await this.install(config);
            results.push(result);
        }
        return results;
    }
    /**
     * 下载插件到目标路径
     */
    async downloadPlugin(url, targetPath) {
        try {
            // 确保目标目录存在
            await mkdir(targetPath, { recursive: true });
            // 使用 curl 下载并解压
            // 假设市场返回的是 tar.gz 或 zip 格式
            execSync(`curl -L "${url}" | tar -xz -C "${targetPath}"`, {
                stdio: 'pipe',
                timeout: 300000, // 5分钟超时
            });
        }
        catch (error) {
            throw new PluginInstallerError(`下载插件失败：${error instanceof Error ? error.message : '未知错误'}`, 'DOWNLOAD_FAILED');
        }
    }
    /**
     * 从市场条目提取依赖
     */
    extractDependencies(marketEntry) {
        // 从 marketEntry 中提取依赖信息
        // 假设市场条目包含 dependencies 字段
        return marketEntry.dependencies || [];
    }
    /**
     * 保存安装配置到本地
     */
    async saveInstallConfig(plugin) {
        const configPath = join(this.baseDir, 'installs.json');
        try {
            let installs = {};
            try {
                const content = await readFile(configPath, 'utf-8');
                installs = JSON.parse(content);
            }
            catch {
                // 文件不存在，忽略
            }
            installs[plugin.id] = {
                installPath: plugin.installPath,
                version: plugin.version,
                enabled: plugin.enabled,
                installedAt: plugin.installedAt,
            };
            await mkdir(dirname(configPath), { recursive: true });
            await writeFile(configPath, JSON.stringify(installs, null, 2));
        }
        catch (error) {
            console.warn(`保存安装配置失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    }
    /**
     * 删除本地安装配置
     */
    async removeInstallConfig(pluginId) {
        const configPath = join(this.baseDir, 'installs.json');
        try {
            const content = await readFile(configPath, 'utf-8');
            const installs = JSON.parse(content);
            delete installs[pluginId];
            await writeFile(configPath, JSON.stringify(installs, null, 2));
        }
        catch {
            // 文件不存在或读取失败，忽略
        }
    }
}
/**
 * 创建插件安装器实例
 */
export function createPluginInstaller(registry) {
    return new PluginInstaller(registry);
}
//# sourceMappingURL=plugin-installer.service.js.map