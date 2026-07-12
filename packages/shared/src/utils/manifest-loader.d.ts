/**
 * Manifest 加载器
 * 支持自动识别简化配置和完整配置
 */
import type { Manifest } from '../types/manifest';
import type { EditableSimpleManifest, SimpleManifest } from '../schema/manifest-simple';
/**
 * 加载 manifest 配置
 * 自动识别简化配置和完整配置
 */
export declare function loadManifest(filePath: string): Manifest;
/**
 * 加载可编辑的简化 manifest 配置
 * 允许项目列表为空，便于项目管理页面保存中间态。
 */
export declare function loadEditableSimpleManifest(filePath: string): EditableSimpleManifest;
/**
 * 检测配置类型
 */
export declare function detectManifestType(filePath: string): 'simple' | 'full' | 'unknown';
/**
 * 验证简化配置
 */
export declare function validateSimpleManifest(data: unknown): {
    valid: boolean;
    errors?: string[];
    data?: SimpleManifest;
};
/**
 * 验证可编辑的简化配置
 */
export declare function validateEditableSimpleManifest(data: unknown): {
    valid: boolean;
    errors?: string[];
    data?: EditableSimpleManifest;
};
/**
 * 验证完整配置
 */
export declare function validateFullManifest(data: unknown): {
    valid: boolean;
    errors?: string[];
    data?: Manifest;
};
//# sourceMappingURL=manifest-loader.d.ts.map