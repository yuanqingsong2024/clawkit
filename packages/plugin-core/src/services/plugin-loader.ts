/**
 * 插件加载器
 * 负责从文件系统或其他来源加载插件
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import type {
  PluginSource,
  PluginLoadResult,
  PluginMeta,
  PluginConfig,
  PluginContext,
  PluginType,
} from '../types/plugin.types';
import type { PluginManager } from './plugin-manager';

/**
 * 插件发现结果
 */
export interface DiscoveredPlugin {
  /** 插件路径 */
  path: string;
  /** 插件元信息 */
  meta: PluginMeta;
  /** 插件配置 */
  config: PluginConfig;
}

/**
 * 插件加载器选项
 */
export interface PluginLoaderOptions {
  /** 插件目录 */
  pluginDir?: string;
  /** 插件目录列表 */
  pluginDirs?: string[];
  /** 是否递归扫描子目录 */
  recursive?: boolean;
  /** 插件配置文件名 */
  configFileName?: string;
  /** 允许的插件类型 */
  allowedTypes?: PluginType[];
  /** 插件过滤器 */
  filter?: (meta: PluginMeta) => boolean;
}

/**
 * 插件加载器
 * 负责发现和加载插件
 */
export class PluginLoader {
  private options: Required<PluginLoaderOptions>;
  private loadedPlugins = new Map<string, unknown>();

  constructor(options: PluginLoaderOptions = {}) {
    this.options = {
      pluginDir: options.pluginDir || './plugins',
      pluginDirs: options.pluginDirs || [],
      recursive: options.recursive ?? true,
      configFileName: options.configFileName || 'plugin.json',
      allowedTypes: options.allowedTypes || ['executor', 'trigger', 'notifier'],
      filter: options.filter || (() => true),
    };
  }

  /**
   * 发现插件目录中的所有插件
   */
  async discover(): Promise<DiscoveredPlugin[]> {
    const plugins: DiscoveredPlugin[] = [];
    const dirs = this.options.pluginDirs.length > 0
      ? this.options.pluginDirs
      : [this.options.pluginDir];

    for (const dir of dirs) {
      try {
        const discovered = await this.discoverInDir(dir);
        plugins.push(...discovered);
      } catch (error) {
        console.error(`扫描插件目录 ${dir} 失败:`, error);
      }
    }

    return plugins;
  }

  /**
   * 在指定目录中发现插件
   */
  private async discoverInDir(dir: string): Promise<DiscoveredPlugin[]> {
    const plugins: DiscoveredPlugin[] = [];

    try {
      await fs.access(dir);
    } catch {
      // 目录不存在，跳过
      return plugins;
    }

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // 检查是否是插件目录（包含 plugin.json）
        const configPath = path.join(fullPath, this.options.configFileName);

        try {
          await fs.access(configPath);
          const plugin = await this.loadPluginConfig(fullPath);
          if (plugin && this.options.filter(plugin.meta)) {
            plugins.push(plugin);
          }
        } catch {
          // 不是插件目录，如果是递归模式则继续扫描子目录
          if (this.options.recursive) {
            const subPlugins = await this.discoverInDir(fullPath);
            plugins.push(...subPlugins);
          }
        }
      } else if (entry.isFile() && entry.name === this.options.configFileName) {
        // 插件配置在文件根目录的情况
        const pluginDir = path.dirname(fullPath);
        const plugin = await this.loadPluginConfig(pluginDir);
        if (plugin && this.options.filter(plugin.meta)) {
          plugins.push(plugin);
        }
      }
    }

    return plugins;
  }

  /**
   * 加载插件配置文件
   */
  private async loadPluginConfig(pluginDir: string): Promise<DiscoveredPlugin | null> {
    const configPath = path.join(pluginDir, this.options.configFileName);

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as Record<string, unknown>;

      // 验证必填字段
      const name = config.name as string | undefined;
      const version = config.version as string | undefined;
      const type = config.type as string | undefined;

      if (!name || !version || !type) {
        console.warn(`插件配置文件 ${configPath} 缺少必填字段 (name, version, type)`);
        return null;
      }

      // 检查插件类型是否允许
      if (!this.options.allowedTypes.includes(type as PluginType)) {
        console.warn(`插件类型 ${type} 不在允许列表中`);
        return null;
      }

      // 将依赖转换为 Record<string, string> 格式
      const rawDeps = config.dependencies;
      let dependencies: Record<string, string> = {};
      if (rawDeps && typeof rawDeps === 'object' && !Array.isArray(rawDeps)) {
        dependencies = Object.fromEntries(
          Object.entries(rawDeps).filter(([, v]) => typeof v === 'string')
        ) as Record<string, string>;
      }

      const meta: PluginMeta = {
        name,
        version,
        type: type as PluginType,
        description: config.description as string | undefined,
        author: config.author as string | undefined,
        homepage: config.homepage as string | undefined,
        dependencies,
        sandbox: config.sandbox as PluginMeta['sandbox'],
      };

      const pluginConfig: PluginConfig = {
        name,
        version,
        type: type as PluginType,
        description: config.description as string | undefined,
        author: config.author as string | undefined,
        homepage: config.homepage as string | undefined,
        dependencies: Array.isArray(rawDeps) ? rawDeps : (rawDeps && typeof rawDeps === 'object' ? Object.keys(rawDeps) : []),
        sandbox: config.sandbox as PluginConfig['sandbox'],
        enabled: (config.enabled as boolean | undefined) ?? true,
        config: config.config as Record<string, unknown> | undefined,
        priority: config.priority as number | undefined,
      };

      return {
        path: pluginDir,
        meta,
        config: pluginConfig,
      };
    } catch (error) {
      console.error(`读取插件配置 ${configPath} 失败:`, error);
      return null;
    }
  }

  /**
   * 加载插件模块
   */
  async loadModule(pluginPath: string): Promise<unknown> {
    // 检查缓存
    if (this.loadedPlugins.has(pluginPath)) {
      return this.loadedPlugins.get(pluginPath)!;
    }

    try {
      // 尝试加载多种格式
      let module: unknown;

      // 1. 尝试直接加载 index.js
      const indexPath = path.join(pluginPath, 'index.js');
      try {
        await fs.access(indexPath);
        module = require(indexPath);
      } catch {
        // 2. 尝试加载 dist/index.js
        const distPath = path.join(pluginPath, 'dist', 'index.js');
        try {
          await fs.access(distPath);
          module = require(distPath);
        } catch {
          // 3. 尝试加载 package.json 指定的入口
          const pkgPath = path.join(pluginPath, 'package.json');
          try {
            const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
            if (pkg.main) {
              module = require(path.join(pluginPath, pkg.main));
            }
          } catch {
            // 忽略
          }
        }
      }

      if (module) {
        this.loadedPlugins.set(pluginPath, module);
        return module;
      }

      throw new Error(`无法找到插件入口文件: ${pluginPath}`);
    } catch (error) {
      console.error(`加载插件模块 ${pluginPath} 失败:`, error);
      throw error;
    }
  }

  /**
   * 注册并加载发现的插件
   */
  async registerDiscoveredPlugins(
    manager: PluginManager,
    context?: Partial<PluginContext>,
  ): Promise<PluginLoadResult[]> {
    const discovered = await this.discover();
    const results: PluginLoadResult[] = [];

    for (const plugin of discovered) {
      try {
        // 注册插件
        const registerResult = manager.register(
          plugin.meta.type,
          plugin.meta.name,
          plugin.meta.version,
          plugin.config,
          context,
        );

        if (registerResult.success) {
          results.push(registerResult);
        } else {
          console.warn(`注册插件 ${plugin.meta.name} 失败:`, registerResult.error);
        }
      } catch (error) {
        results.push({
          success: false,
          pluginId: `${plugin.meta.type}:${plugin.meta.name}@${plugin.meta.version}`,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * 从 package.json 发现 workspace 插件
   */
  async discoverWorkspacePlugins(workspaceRoot: string): Promise<DiscoveredPlugin[]> {
    const plugins: DiscoveredPlugin[] = [];

    try {
      const pkgPath = path.join(workspaceRoot, 'package.json');
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));

      if (pkg.workspace) {
        // 扫描 workspace 包
        const packagesDir = path.join(workspaceRoot, 'packages');
        try {
          const entries = await fs.readdir(packagesDir, { withFileTypes: true });

          for (const entry of entries) {
            if (entry.isDirectory()) {
              const pluginPkgPath = path.join(packagesDir, entry.name, 'package.json');
              try {
                const pluginPkg = JSON.parse(await fs.readFile(pluginPkgPath, 'utf-8'));

                // 检查是否是插件包（命名约定：@clawkit/plugin-*）
                const name = pluginPkg.name as string | undefined;
                const keywords = (pluginPkg.keywords as string[] || []).map(k => k.toLowerCase());
                const isPlugin = name?.startsWith('@clawkit/plugin-') || keywords.includes('clawkit-plugin');

                if (isPlugin && name) {
                  const pluginType = this.inferPluginType(pluginPkg);
                  const rawDeps = pluginPkg.dependencies;
                  const depsRecord: Record<string, string> = {};
                  if (rawDeps && typeof rawDeps === 'object') {
                    Object.entries(rawDeps).forEach(([k, v]) => {
                      if (typeof v === 'string') depsRecord[k] = v;
                    });
                  }

                  const config: PluginConfig = {
                    name,
                    version: pluginPkg.version as string,
                    type: pluginType,
                    description: pluginPkg.description as string | undefined,
                    author: pluginPkg.author as string | undefined,
                    homepage: pluginPkg.homepage as string | undefined,
                    dependencies: Object.keys(depsRecord),
                    enabled: true,
                  };

                  plugins.push({
                    path: path.join(packagesDir, entry.name),
                    meta: {
                      name,
                      version: pluginPkg.version as string,
                      type: pluginType,
                      description: pluginPkg.description as string | undefined,
                      author: pluginPkg.author as string | undefined,
                      homepage: pluginPkg.homepage as string | undefined,
                      dependencies: depsRecord,
                    },
                    config,
                  });
                }
              } catch {
                // 忽略无法读取的包
              }
            }
          }
        } catch {
          // packages 目录不存在
        }
      }
    } catch (error) {
      console.error(`扫描 workspace 插件失败:`, error);
    }

    return plugins;
  }

  /**
   * 推断插件类型
   */
  private inferPluginType(pkg: Record<string, unknown>): PluginType {
    const name = String(pkg.name || '').toLowerCase();
    const keywords = (pkg.keywords as string[] || []).map(k => k.toLowerCase());

    if (name.includes('executor') || keywords.includes('executor')) {
      return 'executor';
    }
    if (name.includes('trigger') || keywords.includes('trigger')) {
      return 'trigger';
    }
    if (name.includes('notifier') || keywords.includes('notifier')) {
      return 'notifier';
    }

    return 'executor'; // 默认类型
  }

  /**
   * 验证插件路径安全性
   */
  async validatePath(pluginPath: string, allowedPaths: string[]): Promise<boolean> {
    const resolved = path.resolve(pluginPath);

    for (const allowed of allowedPaths) {
      const allowedResolved = path.resolve(allowed);
      if (resolved.startsWith(allowedResolved)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取已加载的插件模块
   */
  getLoadedModule(pluginPath: string): unknown {
    return this.loadedPlugins.get(pluginPath);
  }

  /**
   * 清除加载缓存
   */
  clearCache(): void {
    this.loadedPlugins.clear();
  }
}

/**
 * 创建插件加载器
 */
export function createPluginLoader(options?: PluginLoaderOptions): PluginLoader {
  return new PluginLoader(options);
}

/**
 * 从配置文件加载插件列表
 */
export async function loadPluginManifest(manifestPath: string): Promise<DiscoveredPlugin[]> {
  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content);

    if (Array.isArray(manifest.plugins)) {
      return manifest.plugins.map((p: Record<string, unknown>) => {
        const name = p.name as string | undefined;
        const version = p.version as string | undefined;
        const type = p.type as string | undefined;
        const rawDeps = p.dependencies;
        const depsArray = Array.isArray(rawDeps) ? rawDeps : Object.keys(rawDeps || {});

        return {
          path: (p.path as string) || '',
          meta: {
            name: name!,
            version: version!,
            type: type!,
            description: p.description as string | undefined,
            author: p.author as string | undefined,
            homepage: p.homepage as string | undefined,
            dependencies: typeof rawDeps === 'object' && !Array.isArray(rawDeps) 
              ? rawDeps as Record<string, string> 
              : {},
          },
          config: {
            name,
            version,
            type: type as PluginType | undefined,
            description: p.description as string | undefined,
            author: p.author as string | undefined,
            homepage: p.homepage as string | undefined,
            dependencies: depsArray,
            enabled: (p.enabled as boolean | undefined) ?? true,
            config: p.config as Record<string, unknown> | undefined,
          } as PluginConfig,
        };
      });
    }

    return [];
  } catch (error) {
    console.error(`加载插件清单 ${manifestPath} 失败:`, error);
    return [];
  }
}
