/**
 * 插件系统核心类型定义
 * 定义插件的基本结构、生命周期和通用接口
 */
/**
 * 插件类型
 */
export type PluginType = 'executor' | 'trigger' | 'notifier';
/**
 * 插件生命周期状态
 */
export type PluginLifecycleState = 'registered' | 'initializing' | 'ready' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'unloaded';
/**
 * 插件元信息
 */
export interface PluginMeta {
    /** 插件唯一标识符 */
    readonly id?: string;
    /** 插件名称 */
    readonly name: string;
    /** 插件版本 */
    readonly version: string;
    /** 插件类型 */
    readonly type: PluginType;
    /** 插件描述 */
    readonly description?: string;
    /** 插件作者 */
    readonly author?: string;
    /** 插件主页 */
    readonly homepage?: string;
    /** 插件依赖 */
    readonly dependencies?: Record<string, string>;
    /** 沙箱配置 */
    sandbox?: PluginSandboxConfig;
}
/**
 * 插件实例配置
 */
export interface PluginConfig {
    /** 插件类型 */
    type?: PluginType;
    /** 插件名称 */
    name?: string;
    /** 插件版本 */
    version?: string;
    /** 插件 ID */
    pluginId?: string;
    /** 是否启用 */
    enabled?: boolean;
    /** 插件描述 */
    description?: string;
    /** 插件作者 */
    author?: string;
    /** 插件主页 */
    homepage?: string;
    /** 插件依赖 */
    dependencies?: string[];
    /** 沙箱配置 */
    sandbox?: PluginSandboxConfig;
    /** 插件特定配置 */
    config?: Record<string, unknown>;
    /** 优先级（数值越小优先级越高） */
    priority?: number;
    /** 依赖插件 ID 列表 */
    pluginDependencies?: string[];
}
/**
 * 插件上下文
 * 插件运行时可以访问的上下文信息
 */
export interface PluginContext {
    /** 数据目录 */
    dataDir: string;
    /** 日志目录 */
    logDir: string;
    /** 临时目录 */
    tempDir: string;
    /** 配置目录 */
    configDir: string;
    /** 环境变量 */
    env: Record<string, string>;
    /** 工作目录 */
    workDir: string;
}
/**
 * 插件加载来源
 */
export type PluginSource = {
    type: 'builtin';
    name: string;
} | {
    type: 'local';
    path: string;
} | {
    type: 'npm';
    package: string;
    version?: string;
} | {
    type: 'url';
    url: string;
} | {
    type: 'file';
    path: string;
};
/**
 * 插件加载结果
 */
export interface PluginLoadResult {
    /** 是否成功 */
    success: boolean;
    /** 插件 ID */
    pluginId?: string;
    /** 插件元信息 */
    meta?: PluginMeta;
    /** 插件实例 */
    plugin?: {
        meta: PluginMeta;
        instance?: unknown;
        config: PluginConfig;
    };
    /** 错误信息 */
    error?: string;
}
/**
 * 插件验证结果
 */
export interface PluginValidationResult {
    /** 是否有效 */
    valid: boolean;
    /** 错误列表 */
    errors?: string[];
    /** 警告列表 */
    warnings?: string[];
    /** 缺失的依赖列表 */
    missingDependencies?: string[];
}
/**
 * 插件事件类型
 */
export type PluginEventType = 'plugin:loaded' | 'plugin:enabled' | 'plugin:disabled' | 'plugin:started' | 'plugin:stopped' | 'plugin:error' | 'plugin:configChanged' | 'plugin:stateChange';
/**
 * 插件事件
 */
export interface PluginEvent {
    /** 事件类型 */
    type?: PluginEventType;
    /** 插件元信息 */
    plugin?: PluginMeta;
    /** 插件名称 */
    name?: string;
    /** 插件 ID */
    pluginId?: string;
    /** 事件时间戳 */
    timestamp: number;
    /** 事件数据 */
    data?: Record<string, unknown>;
    /** 状态变更信息 */
    from?: PluginLifecycleState;
    to?: PluginLifecycleState;
    /** 原因 */
    reason?: string;
    /** 错误信息 */
    error?: string;
}
/**
 * 插件沙箱配置
 */
export interface PluginSandboxConfig {
    /** 是否启用沙箱 */
    enabled?: boolean;
    /** 允许访问的 Node.js 模块列表 */
    allowedModules?: string[];
    /** 允许的全局对象列表 */
    allowedGlobals?: string[];
    /** 允许访问的网络地址列表 */
    allowedNetworks?: string[];
    /** 允许访问的文件路径列表 */
    allowedPaths?: string[];
    /** 禁止访问的文件路径列表 */
    deniedPaths?: string[];
    /** 是否允许网络访问 */
    networkEnabled?: boolean;
    /** 是否允许文件系统访问 */
    fileSystemEnabled?: boolean;
    /** 是否允许子进程 */
    allowedSubprocess?: boolean;
    /** 最大内存限制（字节） */
    maxMemory?: number;
    /** 最大内存限制（MB） */
    maxMemoryMB?: number;
    /** 最大 CPU 时间（秒） */
    maxCpuSeconds?: number;
    /** 最大 CPU 时间（毫秒） */
    maxCpuTime?: number;
    /** 最大文件大小（字节） */
    maxFileSize?: number;
}
/**
 * 插件统计信息
 */
export interface PluginStats {
    /** 插件 ID */
    pluginId: string;
    /** 插件名称 */
    name: string;
    /** 插件版本 */
    version: string;
    /** 插件类型 */
    type: PluginType;
    /** 当前状态 */
    state: PluginLifecycleState;
    /** 加载时间 */
    loadTime: number;
    /** 运行时间（毫秒） */
    uptime: number;
    /** 错误数量 */
    errorCount: number;
    /** 最后错误信息 */
    lastError?: string;
}
//# sourceMappingURL=plugin.types.d.ts.map