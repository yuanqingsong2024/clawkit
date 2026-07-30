/**
 * 插件市场服务
 * 管理插件的注册、搜索、安装和卸载
 */

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import type { PluginMeta, PluginType } from '@clawkit/plugin-core';

/**
 * 插件市场条目
 */
export interface MarketplaceEntry {
  /** 插件元信息 */
  meta: PluginMeta;
  /** 插件来源（本地路径或 npm 包名） */
  source: string;
  /** 安装状态 */
  installed: boolean;
  /** 安装版本 */
  installedVersion?: string;
  /** 评分（1-5） */
  rating?: number;
  /** 下载次数 */
  downloads: number;
  /** 发布时间 */
  publishedAt: number;
  /** 最后更新 */
  updatedAt: number;
  /** 插件描述详情 */
  description?: string;
  /** 截图/图片 */
  screenshots?: string[];
  /** 作者信息 */
  author?: {
    name: string;
    email?: string;
    homepage?: string;
  };
  /** 许可证 */
  license?: string;
  /** 关键词 */
  keywords?: string[];
  /** 依赖项 */
  dependencies?: string[];
}

/**
 * 插件市场配置
 */
export interface MarketplaceConfig {
  /** 市场数据目录 */
  dataDir: string;
  /** 插件安装目录 */
  pluginsDir: string;
  /** 插件注册表文件 */
  registryFile: string;
  /** 官方插件列表 */
  officialPlugins: MarketplaceEntry[];
}

/**
 * 插件搜索选项
 */
export interface PluginSearchOptions {
  /** 搜索关键词 */
  keyword?: string;
  /** 插件类型过滤 */
  type?: PluginType;
  /** 分类过滤 */
  category?: string;
  /** 是否只显示已安装 */
  installedOnly?: boolean;
  /** 排序字段 */
  sortBy?: 'name' | 'downloads' | 'rating' | 'updatedAt';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
  /** 分页 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

/**
 * 插件搜索结果
 */
export interface PluginSearchResult {
  /** 插件列表 */
  entries: MarketplaceEntry[];
  /** 总数 */
  total: number;
  /** 当前页 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
}

/**
 * 安装结果
 */
export interface InstallResult {
  success: boolean;
  name?: string;
  version?: string;
  error?: string;
}

/**
 * 插件市场服务
 */
export class PluginMarketplaceService {
  private config: Required<MarketplaceConfig>;
  private registry: Map<string, MarketplaceEntry> = new Map();
  private installedPlugins: Map<string, string> = new Map(); // name -> version

  constructor(config: MarketplaceConfig) {
    this.config = {
      dataDir: config.dataDir || path.join(process.cwd(), 'data', 'marketplace'),
      pluginsDir: config.pluginsDir || path.join(process.cwd(), 'plugins'),
      registryFile: config.registryFile || 'registry.json',
      officialPlugins: config.officialPlugins || [],
    };

    this.ensureDirectories();
    this.loadRegistry();
  }

  /**
   * 确保目录存在
   */
  private ensureDirectories(): void {
    if (!fs.existsSync(this.config.dataDir)) {
      fs.mkdirSync(this.config.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.config.pluginsDir)) {
      fs.mkdirSync(this.config.pluginsDir, { recursive: true });
    }
  }

  /**
   * 加载注册表
   */
  private loadRegistry(): void {
    const registryPath = path.join(this.config.dataDir, this.config.registryFile);
    
    // 初始化注册表
    for (const entry of this.config.officialPlugins) {
      this.registry.set(entry.meta.name, entry);
    }

    // 加载已安装插件信息
    this.loadInstalledPlugins();

    // 如果注册表文件存在，加载它
    if (fs.existsSync(registryPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
        for (const entry of data.entries || []) {
          this.registry.set(entry.meta.name, entry);
        }
      } catch (error) {
        console.error('加载插件注册表失败:', error);
      }
    }

    this.saveRegistry();
  }

  /**
   * 加载已安装插件（异步版本）
   * 使用 fs.promises 避免阻塞事件循环
   */
  async loadInstalledPluginsAsync(): Promise<void> {
    if (!fs.existsSync(this.config.pluginsDir)) {
      return;
    }

    const dirs = fs.readdirSync(this.config.pluginsDir);
    
    // 使用 Promise.all 并发处理，避免阻塞主线程
    const results = await Promise.allSettled(
      dirs.map(async (dir): Promise<{ name: string; version: string } | null> => {
        const pluginPath = path.join(this.config.pluginsDir, dir);
        const stat = await fsPromises.stat(pluginPath);
        
        if (!stat.isDirectory()) {
          return null;
        }

        const packageJsonPath = path.join(pluginPath, 'package.json');
        try {
          const content = await fsPromises.readFile(packageJsonPath, 'utf-8');
          const pkg = JSON.parse(content);
          return { name: dir, version: pkg.version };
        } catch {
          return null;
        }
      })
    );

    // 处理结果
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const { name, version } = result.value;
        this.installedPlugins.set(name, version);
        
        // 更新注册表中的安装状态
        const entry = this.registry.get(name);
        if (entry) {
          entry.installed = true;
          entry.installedVersion = version;
        }
      }
    }
  }

  /**
   * 加载已安装插件（同步版本，用于初始化）
   */
  private loadInstalledPlugins(): void {
    if (!fs.existsSync(this.config.pluginsDir)) {
      return;
    }

    const dirs = fs.readdirSync(this.config.pluginsDir);
    for (const dir of dirs) {
      const pluginPath = path.join(this.config.pluginsDir, dir);
      const stat = fs.statSync(pluginPath);
      
      if (stat.isDirectory()) {
        const packageJsonPath = path.join(pluginPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            this.installedPlugins.set(dir, pkg.version);
            
            // 更新注册表中的安装状态
            const entry = this.registry.get(dir);
            if (entry) {
              entry.installed = true;
              entry.installedVersion = pkg.version;
            }
          } catch {
            // 忽略无效的 package.json
          }
        }
      }
    }
  }

  /**
   * 保存注册表
   */
  private saveRegistry(): void {
    const registryPath = path.join(this.config.dataDir, this.config.registryFile);
    const entries = Array.from(this.registry.values());
    
    fs.writeFileSync(registryPath, JSON.stringify({ entries }, null, 2), 'utf-8');
  }

  /**
   * 获取插件列表
   */
  getAllPlugins(): MarketplaceEntry[] {
    return Array.from(this.registry.values());
  }

  /**
   * 搜索插件
   */
  searchPlugins(options: PluginSearchOptions = {}): PluginSearchResult {
    const {
      keyword,
      type,
      installedOnly,
      sortBy = 'downloads',
      sortOrder = 'desc',
      page = 1,
      pageSize = 20,
    } = options;

    let entries = Array.from(this.registry.values());

    // 过滤条件
    if (keyword) {
      const kw = keyword.toLowerCase();
      entries = entries.filter((e) => 
        e.meta.name.toLowerCase().includes(kw) ||
        e.meta.description?.toLowerCase().includes(kw) ||
        e.keywords?.some((k) => k.toLowerCase().includes(kw))
      );
    }

    if (type) {
      entries = entries.filter((e) => e.meta.type === type);
    }

    if (installedOnly) {
      entries = entries.filter((e) => e.installed);
    }

    // 排序
    entries.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = a.meta.name.localeCompare(b.meta.name);
          break;
        case 'downloads':
          cmp = a.downloads - b.downloads;
          break;
        case 'rating':
          cmp = (a.rating || 0) - (b.rating || 0);
          break;
        case 'updatedAt':
          cmp = a.updatedAt - b.updatedAt;
          break;
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    // 分页
    const total = entries.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const paginatedEntries = entries.slice(start, start + pageSize);

    return {
      entries: paginatedEntries,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * 获取插件详情
   */
  getPlugin(name: string): MarketplaceEntry | undefined {
    return this.registry.get(name);
  }

  /**
   * 获取已安装插件
   */
  getInstalledPlugins(): Array<{ name: string; version: string; meta?: PluginMeta }> {
    const installed: Array<{ name: string; version: string; meta?: PluginMeta }> = [];
    
    for (const [name, version] of this.installedPlugins) {
      const entry = this.registry.get(name);
      installed.push({
        name,
        version,
        meta: entry?.meta,
      });
    }
    
    return installed;
  }

  /**
   * 安装插件
   */
  async installPlugin(source: string): Promise<InstallResult> {
    try {
      let pluginName: string;
      let pluginVersion: string;
      let meta: PluginMeta | undefined;

      if (source.startsWith('@clawkit/') || source.startsWith('clawkit-')) {
        // npm 包
        const pkg = await import(source);
        meta = (pkg as { meta?: PluginMeta }).meta;
        pluginName = meta?.name || source;
        pluginVersion = meta?.version || '1.0.0';
      } else if (source.startsWith('http://') || source.startsWith('https://')) {
        // 远程 URL
        const response = await fetch(source);
        if (!response.ok) {
          return { success: false, error: `下载失败: ${response.status}` };
        }
        
        const content = await response.arrayBuffer();
        const pluginPath = path.join(this.config.pluginsDir, `temp-${Date.now()}`);
        fs.writeFileSync(pluginPath, Buffer.from(content));
        
        // 解压或直接使用
        // 这里简化处理，假设是单个 JS 文件
        const packageJsonPath = pluginPath.replace(/\.js$/, '/package.json');
        if (fs.existsSync(packageJsonPath)) {
          const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          pluginName = pkg.name;
          pluginVersion = pkg.version;
          meta = pkg.clawkit?.plugin;
        } else {
          return { success: false, error: '无效的插件包' };
        }
      } else {
        // 本地路径
        const packageJsonPath = path.join(source, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
          return { success: false, error: '插件 package.json 不存在' };
        }
        
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        pluginName = pkg.name;
        pluginVersion = pkg.version;
        meta = pkg.clawkit?.plugin;

        // 复制到插件目录
        const destPath = path.join(this.config.pluginsDir, pluginName);
        if (fs.existsSync(destPath)) {
          fs.rmSync(destPath, { recursive: true });
        }
        fs.cpSync(source, destPath, { recursive: true });
      }

      // 更新注册表
      const entry: MarketplaceEntry = {
        meta: meta || { name: pluginName, version: pluginVersion, type: 'executor' },
        source,
        installed: true,
        installedVersion: pluginVersion,
        downloads: 0,
        publishedAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.registry.set(pluginName, entry);
      this.installedPlugins.set(pluginName, pluginVersion);
      this.saveRegistry();

      return { success: true, name: pluginName, version: pluginVersion };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * 卸载插件
   */
  async uninstallPlugin(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.installedPlugins.has(name)) {
        return { success: false, error: '插件未安装' };
      }

      const pluginPath = path.join(this.config.pluginsDir, name);
      if (fs.existsSync(pluginPath)) {
        fs.rmSync(pluginPath, { recursive: true });
      }

      this.installedPlugins.delete(name);
      
      // 更新注册表
      const entry = this.registry.get(name);
      if (entry) {
        entry.installed = false;
        entry.installedVersion = undefined;
      }
      this.saveRegistry();

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * 添加第三方插件到注册表
   */
  addToRegistry(entry: MarketplaceEntry): void {
    this.registry.set(entry.meta.name, entry);
    this.saveRegistry();
  }

  /**
   * 从注册表移除
   */
  removeFromRegistry(name: string): void {
    this.registry.delete(name);
    this.saveRegistry();
  }

  /**
   * 更新插件评分
   */
  updateRating(name: string, rating: number): void {
    const entry = this.registry.get(name);
    if (entry) {
      entry.rating = Math.max(1, Math.min(5, rating));
      this.saveRegistry();
    }
  }

  /**
   * 增加下载次数
   */
  incrementDownloads(name: string): void {
    const entry = this.registry.get(name);
    if (entry) {
      entry.downloads++;
      this.saveRegistry();
    }
  }
}

/**
 * 创建插件市场服务
 */
export function createMarketplaceService(config?: Partial<MarketplaceConfig>): PluginMarketplaceService {
  return new PluginMarketplaceService({
    dataDir: config?.dataDir || '',
    pluginsDir: config?.pluginsDir || '',
    registryFile: config?.registryFile || '',
    officialPlugins: config?.officialPlugins || [],
  });
}
