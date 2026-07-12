import { Manifest } from '../types/manifest';
/**
 * 校验结果
 */
export interface ValidationResult {
    /** 是否通过校验 */
    valid: boolean;
    /** 错误信息列表 */
    errors: ValidationError[];
}
/**
 * 校验错误
 */
export interface ValidationError {
    /** 错误路径 */
    path: string;
    /** 错误信息 */
    message: string;
    /** 错误代码 */
    code?: string;
}
/**
 * Manifest 校验器接口
 * 负责校验配置文件的合法性
 */
export interface ManifestValidator {
    /**
     * 校验 Manifest
     * @param manifest Manifest 对象
     * @returns 校验结果
     */
    validate(manifest: unknown): ValidationResult;
    /**
     * 校验并抛出异常
     * @param manifest Manifest 对象
     * @returns 校验通过的 Manifest
     * @throws 校验失败时抛出异常
     */
    validateOrThrow(manifest: unknown): Manifest;
}
//# sourceMappingURL=validator.d.ts.map