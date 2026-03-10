/**
 * 共享类型定义
 * 当前仅为骨架，后续根据需要扩展
 */

/**
 * 部署模式
 */
export enum DeployMode {
  /** 单机模式：所有组件在同一台机器 */
  AllInOne = 'all-in-one',
  /** 混合模式：OpenClaw + controller 在云端，worker + OpenCode 在本地 */
  Hybrid = 'hybrid',
  /** 双机模式：OpenClaw + controller 在 A 机器，worker + OpenCode 在 B 机器 */
  Split = 'split',
}

/**
 * 配置接口（占位）
 */
export interface Config {
  mode: DeployMode;
  // 后续扩展其他配置项
}

/**
 * 工具函数（占位）
 */
export function getVersion(): string {
  return '0.1.0';
}
