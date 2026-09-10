/**
 * 统一配置管理器
 * 支持多源配置合并、环境变量、文件配置和运行时更新
 */

import { EventEmitter } from 'events';
import { z, ZodSchema } from 'zod';

export type ConfigSource = 'default' | 'env' | 'file' | 'runtime';

export interface ConfigSourceMap {
  [key: string]: ConfigSource;
}

export interface ConfigLoadResult<T> {
  config: T;
  sources: ConfigSourceMap;
}

/**
 * 配置变更事件
 */
export interface ConfigChangeEvent<T> {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  source: ConfigSource;
  timestamp: Date;
}

/**
 * 统一配置管理器
 * 支持多层配置合并：defaults → env → file → runtime
 */
export class ConfigManager<T extends Record<string, unknown>> extends EventEmitter {
  private config: T;
  private sources: ConfigSourceMap;
  private schema: ZodSchema<T> | undefined;

  constructor(initialConfig: T, schema?: ZodSchema<T>) {
    super();
    this.config = { ...initialConfig };
    this.sources = {};
    this.schema = schema;

    // 初始化所有键的来源为 default
    for (const key of Object.keys(initialConfig)) {
      this.sources[key] = 'default';
    }
  }

  /**
   * 从环境变量加载配置
   */
  loadFromEnv(envMapping: Record<string, string>): void {
    for (const [configKey, envKey] of Object.entries(envMapping)) {
      const value = process.env[envKey];
      if (value !== undefined) {
        this.set(configKey, value, 'env');
      }
    }
  }

  /**
   * 从文件加载配置（JSON）
   */
  loadFromFile(fileConfig: Partial<T>): void {
    for (const [key, value] of Object.entries(fileConfig)) {
      if (value !== undefined) {
        this.set(key, value, 'file');
      }
    }
  }

  /**
   * 设置运行时配置
   */
  setRuntime(key: string, value: unknown): void {
    this.set(key, value, 'runtime');
  }

  /**
   * 设置配置值并追踪来源
   */
  private set(key: string, value: unknown, source: ConfigSource): void {
    const oldValue = (this.config as Record<string, unknown>)[key];
    (this.config as Record<string, unknown>)[key] = value;
    this.sources[key] = source;

    if (oldValue !== value) {
      this.emit('change', {
        key,
        oldValue,
        newValue: value,
        source,
        timestamp: new Date(),
      } as ConfigChangeEvent<T>);
    }
  }

  /**
   * 获取配置值
   */
  get<K extends keyof T>(key: K): T[K] {
    return this.config[key];
  }

  /**
   * 获取所有配置
   */
  getAll(): Readonly<T> {
    return Object.freeze({ ...this.config });
  }

  /**
   * 获取配置来源信息
   */
  getSource(key: string): ConfigSource {
    return this.sources[key] ?? 'default';
  }

  /**
   * 获取所有来源信息
   */
  getSources(): Readonly<ConfigSourceMap> {
    return Object.freeze({ ...this.sources });
  }

  /**
   * 验证配置
   */
  validate(): { valid: boolean; errors?: string[] } {
    if (!this.schema) {
      return { valid: true };
    }

    const result = this.schema.safeParse(this.config);
    if (result.success) {
      return { valid: true };
    }

    return {
      valid: false,
      errors: result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      ),
    };
  }

  /**
   * 获取配置快照
   */
  snapshot(): ConfigLoadResult<T> {
    return {
      config: this.getAll(),
      sources: this.getSources(),
    };
  }

  /**
   * 重置为默认值
   */
  reset(): void {
    const defaultConfig = this.config;
    for (const key of Object.keys(defaultConfig)) {
      this.sources[key] = 'default';
    }
    this.emit('reset', { timestamp: new Date() });
  }
}

/**
 * 创建带类型安全的配置管理器
 */
export function createConfigManager<T extends Record<string, unknown>>(
  initialConfig: T,
  schema?: ZodSchema<T>,
): ConfigManager<T> {
  return new ConfigManager(initialConfig, schema);
}
