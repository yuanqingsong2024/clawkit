/**
 * 配置热重载服务
 * 监听 manifest 文件变化，自动重新加载配置
 * 同时支持手动触发重载
 */

import * as chokidar from 'chokidar';
import * as fs from 'fs';
import { EventEmitter } from 'events';

export interface ConfigHotReloadOptions {
  manifestPath: string;
  /** 文件变化后延迟重载时间（毫秒），避免频繁重载 */
  debounceMs?: number;
  /** 是否启用自动重载 */
  autoReload?: boolean;
}

export interface ConfigChangeEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
  timestamp: Date;
}

/**
 * 配置热重载服务
 * 使用 chokidar 监听 manifest 文件变化
 */
export class ConfigHotReloadService extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null;
  private manifestPath: string;
  private debounceMs: number;
  private autoReload: boolean;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isReloading = false;
  private lastReloadTime: Date | null = null;

  constructor(options: ConfigHotReloadOptions) {
    super();
    this.manifestPath = options.manifestPath;
    this.debounceMs = options.debounceMs ?? 500;
    this.autoReload = options.autoReload ?? true;

    // 监听配置变更事件
    this.on('change', () => {
      if (this.autoReload) {
        this.scheduleReload();
      }
    });
  }

  /**
   * 启动文件监听
   */
  start(): void {
    if (this.watcher) {
      console.log('[ConfigHotReload] 监听已启动');
      return;
    }

    // 确保 manifest 文件存在
    if (!fs.existsSync(this.manifestPath)) {
      console.warn(`[ConfigHotReload] manifest 文件不存在: ${this.manifestPath}`);
      return;
    }

    console.log(`[ConfigHotReload] 开始监听配置文件: ${this.manifestPath}`);

    this.watcher = chokidar.watch(this.manifestPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    this.watcher.on('change', (path) => {
      console.log(`[ConfigHotReload] 检测到文件变化: ${path}`);
      this.emit('change', {
        type: 'change',
        path,
        timestamp: new Date(),
      } as ConfigChangeEvent);
    });

    this.watcher.on('add', (path) => {
      console.log(`[ConfigHotReload] 检测到新文件: ${path}`);
      this.emit('change', {
        type: 'add',
        path,
        timestamp: new Date(),
      } as ConfigChangeEvent);
    });

    this.watcher.on('unlink', (path) => {
      console.warn(`[ConfigHotReload] 配置文件被删除: ${path}`);
      this.emit('change', {
        type: 'unlink',
        path,
        timestamp: new Date(),
      } as ConfigChangeEvent);
    });

    this.watcher.on('error', (error) => {
      console.error(`[ConfigHotReload] 监听错误: ${error.message}`);
      this.emit('error', error);
    });

    this.watcher.on('ready', () => {
      console.log('[ConfigHotReload] 文件监听就绪');
    });
  }

  /**
   * 停止文件监听
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('[ConfigHotReload] 文件监听已停止');
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * 手动触发重载
   * 立即执行，不使用 debounce
   */
  async triggerReload(): Promise<boolean> {
    if (this.isReloading) {
      console.log('[ConfigHotReload] 正在重载中，跳过本次触发');
      return false;
    }

    // 检查文件是否存在
    if (!fs.existsSync(this.manifestPath)) {
      console.error(`[ConfigHotReload] manifest 文件不存在: ${this.manifestPath}`);
      return false;
    }

    this.isReloading = true;
    this.emit('reload-start');

    try {
      // 读取文件验证其有效性
      const content = fs.readFileSync(this.manifestPath, 'utf-8');
      if (!content.trim()) {
        throw new Error('manifest 文件为空');
      }

      this.lastReloadTime = new Date();
      console.log(`[ConfigHotReload] 配置重载成功: ${this.lastReloadTime.toISOString()}`);
      this.emit('reload-success', this.lastReloadTime);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ConfigHotReload] 配置重载失败: ${errorMsg}`);
      this.emit('reload-error', error);
      return false;
    } finally {
      this.isReloading = false;
    }
  }

  /**
   * 调度重载（使用 debounce）
   */
  private scheduleReload(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      await this.triggerReload();
      this.debounceTimer = null;
    }, this.debounceMs);
  }

  /**
   * 获取上次重载时间
   */
  getLastReloadTime(): Date | null {
    return this.lastReloadTime;
  }

  /**
   * 检查是否正在重载
   */
  isReloadInProgress(): boolean {
    return this.isReloading;
  }

  /**
   * 获取监听状态
   */
  isWatching(): boolean {
    return this.watcher !== null;
  }

  /**
   * 获取配置信息
   */
  getStatus(): ConfigHotReloadStatus {
    return {
      isWatching: this.isWatching(),
      isReloading: this.isReloading,
      manifestPath: this.manifestPath,
      lastReloadTime: this.lastReloadTime,
      debounceMs: this.debounceMs,
      autoReload: this.autoReload,
    };
  }
}

export interface ConfigHotReloadStatus {
  isWatching: boolean;
  isReloading: boolean;
  manifestPath: string;
  lastReloadTime: Date | null;
  debounceMs: number;
  autoReload: boolean;
}

// 导出单例获取函数
let hotReloadService: ConfigHotReloadService | null = null;

export function getConfigHotReloadService(options: ConfigHotReloadOptions): ConfigHotReloadService {
  if (!hotReloadService) {
    hotReloadService = new ConfigHotReloadService(options);
  }
  return hotReloadService;
}

export function resetConfigHotReloadService(): void {
  if (hotReloadService) {
    hotReloadService.stop();
    hotReloadService = null;
  }
}
