import { z } from 'zod';
export type ConfigSource = 'env' | 'file' | 'default';
export interface ConfigLoadResult<T> {
    config: T;
    sources: Record<string, ConfigSource>;
}
export declare function getEnvString(key: string, defaultValue?: string): string | undefined;
export declare function getEnvNumber(key: string, defaultValue?: number): number | undefined;
export declare function getEnvBoolean(key: string, defaultValue?: boolean): boolean | undefined;
export declare function getEnvArray(key: string, separator?: string, defaultValue?: string[]): string[] | undefined;
export declare function validateConfig<T>(schema: z.ZodSchema<T>, data: unknown, configName: string): T;
//# sourceMappingURL=index.d.ts.map