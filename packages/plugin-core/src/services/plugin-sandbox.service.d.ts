/**
 * 插件沙箱服务
 * 提供安全的插件执行环境隔离
 */
import type { PluginSandboxConfig, PluginContext } from '../types/plugin.types';
/**
 * 默认沙箱配置
 */
export declare const DEFAULT_SANDBOX_CONFIG: Required<PluginSandboxConfig>;
/**
 * 在沙箱中执行代码
 */
export declare function runInSandbox(code: string, config: PluginSandboxConfig, pluginContext: PluginContext, options?: {
    filename?: string;
    timeout?: number;
}): unknown;
/**
 * 创建插件隔离运行环境
 */
export declare function createPluginIsolate(config: PluginSandboxConfig, context: PluginContext): {
    run: (code: string, options?: {
        timeout?: number;
    }) => unknown;
    eval: (expression: string) => unknown;
    dispose: () => void;
};
/**
 * 验证代码安全性
 */
export declare function validateCodeSafety(code: string): {
    safe: boolean;
    issues: string[];
};
//# sourceMappingURL=plugin-sandbox.service.d.ts.map