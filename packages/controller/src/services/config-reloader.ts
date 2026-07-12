/**
 * 配置热重载服务
 * 使用 chokidar 监听 manifest 文件变化，自动重新加载配置
 */

import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { createLogger } from '@clawkit/shared';
import { ManifestManager } from './manifest-manager';
import { ProjectRegistry } from './project-registry';
import { WorkerRegistry } from './worker-registry';

const logger = createLogger('config-reloader');

export interface ConfigReloaderOptions {
  manifestPath: string;
  manifestManager: ManifestManager;
  projectRegistry: ProjectRegistry;
  workerRegistry: WorkerRegistry;
}

export interface ConfigChangeListener {
  onConfigChange(manifestPath: string): void;
}

export class ConfigReloader {
  private manifestPath: string;
  private manifestManager: ManifestManager;
  private projectRegistry: ProjectRegistry;
  private workerRegistry: WorkerRegistry;
  private watcher: chokidar.FSWatcher | null = null;
  private listeners: ConfigChangeListener[] = [];
  private reloadInProgress: boolean = false;
  private reloadDebounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 500; // 防抖延迟

  constructor(options: ConfigReloaderOptions) {
    this.manifestPath = options.manifestPath;
    this.manifestManager = options.manifestManager;
    this.projectRegistry = options.projectRegistry;
    this.workerRegistry = options.workerRegistry;
  }

  /**
   * 启动文件监听
   */
  start(): void {
    if (this.watcher) {
      logger.warn('文件监听已启动，忽略重复调用');
      return;
    }

    // 确保文件存在
    if (!fs.existsSync(this.manifestPath)) {
      logger.warn('manifest 文件不存在，跳过监听', { path: this.manifestPath });
      return;
    }

    const dir = path.dirname(this.manifestPath);
    const fileName = path.basename(this.manifestPath);

    logger.info('启动 manifest 文件监听', { path: this.manifestPath });

    this.watcher = chokidar.watch(fileName, {
      cwd: dir,
      persistent: true,
      ignoreInitial: true, // 忽略初始扫描
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    this.watcher.on('change', (changedPath: string) => {
      const fullPath = path.join(dir, changedPath);
      logger.info('检测到 manifest 文件变化', { path: fullPath });
      this.scheduleReload(fullPath);
    });

    this.watcher.on('unlink', (unlinkedPath: string) => {
      const fullPath = path.join(dir, unlinkedPath);
      logger.warn('manifest 文件被删除', { path: fullPath });
      this.notifyListeners('manifest-deleted', unlinkedPath);
    });

    this.watcher.on('error', (error: Error) => {
      logger.error('文件监听错误', error);
    });
  }

  /**
   * 停止文件监听
   */
  stop(): void {
    if (this.watcher) {
      logger.info('停止 manifest 文件监听');
      this.watcher.close();
      this.watcher = null;
    }

    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer);
      this.reloadDebounceTimer = null;
    }
  }

  /**
   * 添加配置变更监听器
   */
  addListener(listener: ConfigChangeListener): void {
    this.listeners.push(listener);
  }

  /**
   * 移除配置变更监听器
   */
  removeListener(listener: ConfigChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 手动触发重载
   */
  async reload(): Promise<void> {
    if (this.reloadInProgress) {
      logger.info('重载正在进行中，跳过本次请求');
      return;
    }

    this.reloadInProgress = true;

    try {
      logger.info('开始手动重载配置...');

      // 重新加载 manifest
      this.manifestManager.reload();

      // 更新项目注册表
      const projects = this.manifestManager.getAllProjects();
      this.projectRegistry.reloadFromProjects(projects);

      // 通知所有监听器
      this.notifyListeners('config-reloaded', this.manifestPath);

      logger.info('配置重载完成', { projectCount: projects.length });
    } catch (error) {
      logger.error('配置重载失败', error);
      throw error;
    } finally {
      this.reloadInProgress = false;
    }
  }

  /**
   * 调度重载（带防抖）
   */
  private scheduleReload(filePath: string): void {
    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer);
    }

    this.reloadDebounceTimer = setTimeout(async () => {
      try {
        await this.reload();
      } catch (error) {
        logger.error('自动重载失败', error);
      }
    }, this.DEBOUNCE_MS);
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(event: string, filePath: string): void {
    for (const listener of this.listeners) {
      try {
        listener.onConfigChange(filePath);
      } catch (error) {
        logger.error('通知监听器失败', error);
      }
    }
  }

  /**
   * 获取监听状态
   */
  isWatching(): boolean {
    return this.watcher !== null;
  }
}

/**
 * 创建配置热重载服务
 */
export function createConfigReloader(
  manifestPath: string,
  manifestManager: ManifestManager,
  projectRegistry: ProjectRegistry,
  workerRegistry: WorkerRegistry
): ConfigReloader {
  return new ConfigReloader({
    manifestPath,
    manifestManager,
    projectRegistry,
    workerRegistry,
  });
}
