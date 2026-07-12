/**
 * 插件市场类型定义
 * 定义插件市场中的核心数据类型
 */

/** 插件类型 */
export type PluginType = 'executor' | 'trigger' | 'notifier';

/**
 * 插件配置接口
 */
export interface PluginConfig {
  /** 配置名称 */
  name: string;
  /** 配置值 */
  value: unknown;
  /** 配置描述 */
  description?: string;
  /** 是否敏感配置 */
  sensitive?: boolean;
}

/**
 * 已安装插件信息
 */
export interface InstalledPlugin {
  /** 插件唯一标识 */
  id: string;
  /** 插件名称 */
  name: string;
  /** 插件类型 */
  type: PluginType;
  /** 插件版本 */
  version: string;
  /** 安装路径 */
  installPath: string;
  /** 插件状态 */
  status: PluginStatus;
  /** 是否启用 */
  enabled: boolean;
  /** 安装时间 */
  installedAt: number;
  /** 最后更新时间 */
  updatedAt: number;
  /** 依赖列表 */
  dependencies: string[];
  /** 插件配置 */
  config?: PluginConfig[];
  /** 插件来源 */
  source?: string;
  /** 描述 */
  description?: string;
  /** 作者 */
  author?: string;
  /** 原始市场条目 */
  marketEntry?: MarketEntry;
}

/**
 * 插件状态
 */
export type PluginStatus = 'installed' | 'updating' | 'removing' | 'error' | 'disabled';

/**
 * 插件市场条目
 */
export interface MarketEntry {
  /** 插件唯一标识 (格式: @scope/name 或 name) */
  id: string;
  /** 插件名称 */
  name: string;
  /** 插件描述 */
  description: string;
  /** 插件版本 */
  version: string;
  /** 插件类型 */
  type: PluginType;
  /** 作者信息 */
  author: Author;
  /** 插件分类 */
  categories: string[];
  /** 插件标签 */
  tags: string[];
  /** 插件图标 URL */
  iconUrl?: string;
  /** 插件截图 */
  screenshots?: string[];
  /** 插件详情页 URL */
  homepage?: string;
  /** 仓库地址 */
  repository?: string;
  /** 许可证 */
  license?: string;
  /** 下载统计 */
  downloads: DownloadStats;
  /** 评分信息 */
  rating?: Rating;
  /** 插件状态 */
  status: MarketEntryStatus;
  /** 发布时间 */
  publishedAt: number;
  /** 最后更新时间 */
  updatedAt: number;
  /** 版本历史 */
  versions: VersionInfo[];
  /** 安装说明 */
  installScript?: string;
}

/**
 * 作者信息
 */
export interface Author {
  /** 作者 ID */
  id: string;
  /** 作者名称 */
  name: string;
  /** 作者邮箱 */
  email?: string;
  /** 作者头像 */
  avatarUrl?: string;
}

/**
 * 下载统计
 */
export interface DownloadStats {
  /** 总下载量 */
  total: number;
  /** 周下载量 */
  weekly: number;
  /** 月下载量 */
  monthly: number;
}

/**
 * 评分信息
 */
export interface Rating {
  /** 平均评分 (1-5) */
  average: number;
  /** 评分数量 */
  count: number;
  /** 分布统计 */
  distribution?: {
    /** 各星级数量 */
    stars: Record<number, number>;
  };
}

/**
 * 插件市场条目状态
 */
export type MarketEntryStatus = 'published' | 'draft' | 'deprecated' | 'removed';

/**
 * 版本信息
 */
export interface VersionInfo {
  /** 版本号 */
  version: string;
  /** 版本说明 */
  changelog?: string;
  /** 发布时间 */
  publishedAt: number;
  /** 是否稳定版 */
  stable: boolean;
  /** 下载地址 */
  downloadUrl?: string;
  /** 兼容性信息 */
  compatibility?: {
    /** 最低 clawkit 版本 */
    minClawkitVersion: string;
    /** 最高 clawkit 版本 */
    maxClawkitVersion?: string;
  };
}

/**
 * 插件搜索结果
 */
export interface SearchResult {
  /** 搜索结果列表 */
  entries: MarketEntry[];
  /** 总结果数 */
  total: number;
  /** 当前页 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 搜索耗时 */
  took: number;
}

/**
 * 搜索过滤条件
 */
export interface SearchFilters {
  /** 插件类型过滤 */
  type?: PluginType;
  /** 分类过滤 */
  categories?: string[];
  /** 标签过滤 */
  tags?: string[];
  /** 作者过滤 */
  author?: string;
  /** 最低评分 */
  minRating?: number;
  /** 排序字段 */
  sortBy?: 'downloads' | 'rating' | 'updated' | 'name' | 'published';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
  /** 关键词搜索 */
  query?: string;
}

/**
 * 插件安装配置
 */
export interface InstallConfig {
  /** 插件 ID */
  pluginId: string;
  /** 安装版本 */
  version?: string;
  /** 安装路径 */
  installPath?: string;
  /** 是否安装依赖 */
  installDeps?: boolean;
  /** 安装后是否启用 */
  autoEnable?: boolean;
}

/**
 * 插件安装结果
 */
export interface InstallResult {
  /** 是否成功 */
  success: boolean;
  /** 安装的插件信息 */
  plugin?: MarketEntry;
  /** 错误信息 */
  error?: string;
  /** 安装路径 */
  installPath?: string;
  /** 安装的依赖列表 */
  installedDeps?: string[];
}

/**
 * 插件市场配置
 */
export interface MarketConfig {
  /** 市场服务器地址 */
  serverUrl: string;
  /** API 密钥 */
  apiKey?: string;
  /** 缓存目录 */
  cacheDir?: string;
  /** 缓存过期时间 (毫秒) */
  cacheTtl?: number;
  /** 是否使用代理 */
  useProxy?: boolean;
  /** 代理地址 */
  proxyUrl?: string;
  /** 下载超时时间 (毫秒) */
  downloadTimeout?: number;
}

/**
 * 插件市场统计
 */
export interface MarketStats {
  /** 插件总数 */
  totalPlugins: number;
  /** 分类统计 */
  categoryStats: Record<string, number>;
  /** 插件类型统计 */
  typeStats: Record<PluginType, number>;
  /** 下载量统计 */
  totalDownloads: number;
  /** 注册作者数 */
  totalAuthors: number;
}

/**
 * 插件分类
 */
export interface PluginCategory {
  /** 分类 ID */
  id: string;
  /** 分类名称 */
  name: string;
  /** 分类描述 */
  description?: string;
  /** 分类图标 */
  icon?: string;
  /** 该分类下的插件数量 */
  pluginCount: number;
}
