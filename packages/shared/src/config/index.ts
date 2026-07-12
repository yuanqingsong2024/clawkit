import { z } from 'zod';

export type ConfigSource = 'env' | 'file' | 'default';

export interface ConfigLoadResult<T> {
  config: T;
  sources: Record<string, ConfigSource>;
}

export function getEnvString(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}

export function getEnvNumber(key: string, defaultValue?: number): number | undefined {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`环境变量 ${key} 的值 "${value}" 不是有效的数字`);
  }
  return parsed;
}

export function getEnvBoolean(key: string, defaultValue?: boolean): boolean | undefined {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

export function getEnvArray(key: string, separator = ',', defaultValue?: string[]): string[] | undefined {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.split(separator).map(s => s.trim()).filter(Boolean);
}

export function validateConfig<T>(schema: z.ZodSchema<T>, data: unknown, configName: string): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`${configName} 配置验证失败：${errors}`);
  }

  return result.data;
}
