/**
 * V1 到 V2 Manifest 配置转换工具
 *
 * 提供 V1 配置向 V2 配置的自动转换能力，确保向后兼容。
 */
/**
 * 从 V1 Manifest 转换为 V2 Manifest 的选项
 */
export interface V1ToV2Options {
    /** 是否在转换时输出警告信息 */
    emitWarnings?: boolean;
    /** 默认执行器类型 */
    defaultExecutorType?: 'opencode' | 'placeholder';
    /** 默认触发器类型 */
    defaultTriggerType?: 'claude-code';
}
/**
 * 转换警告信息
 */
export interface ConversionWarning {
    path: string;
    message: string;
    suggestion?: string;
}
/**
 * V1 到 V2 转换结果
 */
export interface V1ToV2Result {
    success: boolean;
    v2Manifest: Record<string, unknown>;
    warnings: ConversionWarning[];
    errors: string[];
}
/**
 * 将 V1 Manifest 配置转换为 V2
 *
 * @param v1Manifest V1 版本的配置对象
 * @param options 转换选项
 * @returns 转换结果，包含 V2 配置和警告/错误信息
 *
 * @example
 * ```typescript
 * const v1Config = { profile: { name: 'my-app' }, projects: [...] };
 * const result = convertV1ToV2(v1Config);
 * if (result.success) {
 *   console.log('V2 Config:', result.v2Manifest);
 *   result.warnings.forEach(w => console.warn(w.message));
 * }
 * ```
 */
export declare function convertV1ToV2(v1Manifest: unknown, options?: V1ToV2Options): V1ToV2Result;
/**
 * 检测配置版本
 *
 * @param manifest 配置对象
 * @returns 'v1-simple' | 'v1-full' | 'v2' | 'unknown'
 */
export declare function detectManifestVersion(manifest: unknown): 'v1-simple' | 'v1-full' | 'v2' | 'unknown';
/**
 * 导出类型供外部使用
 */
export type { V1SimpleManifest, V1FullManifest } from './manifest-v2-compatibility.types';
//# sourceMappingURL=manifest-v2-compatibility.d.ts.map