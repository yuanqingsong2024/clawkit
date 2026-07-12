/**
 * 错误信息国际化映射
 * 将技术错误码转换为用户友好的中文提示
 */
import { ControllerErrorCode } from '../types/errors';
/**
 * 错误信息映射表
 * 格式：{ 错误码: { title: 简短标题, message: 详细说明, suggestion: 操作建议 } }
 */
export declare const ERROR_MESSAGES: Record<ControllerErrorCode, {
    title: string;
    message: string;
    suggestion?: string;
}>;
/**
 * 获取用户友好的错误信息
 * @param errorCode 错误码
 * @param technicalMessage 技术错误信息（可选，用于补充详情）
 * @returns 格式化的错误信息对象
 */
export declare function getErrorMessage(errorCode: ControllerErrorCode, technicalMessage?: string): {
    title: string;
    message: string;
    suggestion?: string;
    technical?: string;
};
/**
 * 格式化错误信息为单行文本（用于日志）
 * @param errorCode 错误码
 * @param technicalMessage 技术错误信息
 * @returns 格式化的错误文本
 */
export declare function formatErrorMessage(errorCode: ControllerErrorCode, technicalMessage?: string): string;
//# sourceMappingURL=error-messages.d.ts.map