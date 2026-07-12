/**
 * 插件工具函数
 * 提供插件相关的常用工具函数
 */

import type { PluginMeta, PluginType, PluginLifecycleState } from '../types/plugin.types';

/**
 * 检查插件是否为指定类型
 */
export function isPluginOfType(meta: PluginMeta, type: PluginType): boolean {
  return meta.type === type;
}

/**
 * 检查插件是否为执行器类型
 */
export function isExecutorPlugin(meta: PluginMeta): boolean {
  return isPluginOfType(meta, 'executor');
}

/**
 * 检查插件是否为触发器类型
 */
export function isTriggerPlugin(meta: PluginMeta): boolean {
  return isPluginOfType(meta, 'trigger');
}

/**
 * 检查插件是否为通知器类型
 */
export function isNotifierPlugin(meta: PluginMeta): boolean {
  return isPluginOfType(meta, 'notifier');
}

/**
 * 比较插件版本
 * @returns 
 *   -1: v1 < v2
 *    0: v1 === v2
 *    1: v1 > v2
 */
export function compareVersions(v1: string, v2: string): -1 | 0 | 1 {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }

  return 0;
}

/**
 * 检查插件版本是否兼容
 */
export function isVersionCompatible(
  pluginVersion: string,
  requiredVersion: string,
): boolean {
  const comparison = compareVersions(pluginVersion, requiredVersion);
  return comparison >= 0;
}

/**
 * 验证插件名称格式
 */
export function isValidPluginName(name: string): boolean {
  // 插件名称必须是小写字母、数字和连字符，且以字母开头
  return /^[a-z][a-z0-9-]*$/.test(name);
}

/**
 * 规范化插件名称
 */
export function normalizePluginName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

/**
 * 获取插件类型的显示名称
 */
export function getPluginTypeDisplayName(type: PluginType): string {
  const displayNames: Record<PluginType, string> = {
    executor: '执行器',
    trigger: '触发器',
    notifier: '通知器',
  };
  return displayNames[type] || type;
}

/**
 * 获取生命周期状态的显示名称
 */
export function getLifecycleStateDisplayName(state: PluginLifecycleState): string {
  const displayNames: Record<PluginLifecycleState, string> = {
    registered: '已注册',
    initializing: '初始化中',
    ready: '就绪',
    starting: '启动中',
    running: '运行中',
    stopping: '停止中',
    stopped: '已停止',
    error: '错误',
    unloaded: '已卸载',
  };
  return displayNames[state] || state;
}

/**
 * 判断插件是否处于终态
 */
export function isTerminalState(state: PluginLifecycleState): boolean {
  return state === 'stopped' || state === 'error' || state === 'unloaded';
}

/**
 * 判断插件是否可启动
 */
export function isStartable(state: PluginLifecycleState): boolean {
  return state === 'ready' || state === 'stopped';
}

/**
 * 判断插件是否可停止
 */
export function isStoppable(state: PluginLifecycleState): boolean {
  return state === 'running' || state === 'starting';
}

/**
 * 格式化插件信息
 */
export function formatPluginInfo(meta: PluginMeta): string {
  const lines = [
    `名称: ${meta.name}`,
    `类型: ${getPluginTypeDisplayName(meta.type)}`,
    `版本: ${meta.version}`,
    `作者: ${meta.author || '未知'}`,
    `描述: ${meta.description || '无'}`,
  ];

  if (meta.homepage) {
    lines.push(`主页: ${meta.homepage}`);
  }

  return lines.join('\n');
}

/**
 * 生成插件唯一标识符
 */
export function generatePluginId(name: string, version: string): string {
  return `${name}@${version}`;
}

/**
 * 解析插件标识符
 */
export function parsePluginId(id: string): { name: string; version: string } | null {
  const match = id.match(/^(@?[^@]+)@(.+)$/);
  if (!match) {
    return null;
  }
  return { name: match[1], version: match[2] };
}

/**
 * 合并插件配置
 */
export function mergePluginConfig(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  return { ...base, ...override };
}

/**
 * 深拷贝插件配置
 */
export function deepCloneConfig<T extends Record<string, unknown>>(config: T): T {
  return JSON.parse(JSON.stringify(config));
}

/**
 * 过滤敏感配置项
 */
export function filterSensitiveConfig(
  config: Record<string, unknown>,
  sensitiveKeys: string[] = ['password', 'token', 'secret', 'apiKey', 'api_key'],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    const isSensitive = sensitiveKeys.some(
      (sensitiveKey) => key.toLowerCase().includes(sensitiveKey.toLowerCase()),
    );

    if (isSensitive) {
      result[key] = '********';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = filterSensitiveConfig(
        value as Record<string, unknown>,
        sensitiveKeys,
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * 验证插件依赖
 */
export function validateDependencies(
  dependencies: string[],
  availablePlugins: Set<string>,
): { valid: boolean; missing: string[] } {
  const missing = dependencies.filter((dep) => !availablePlugins.has(dep));
  return {
    valid: missing.length === 0,
    missing,
  };
}
