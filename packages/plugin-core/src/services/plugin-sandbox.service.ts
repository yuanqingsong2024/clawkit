/**
 * 插件沙箱服务
 * 提供安全的插件执行环境隔离
 */

import * as vm from 'vm';
import * as path from 'path';
import * as crypto from 'crypto';
import type { PluginSandboxConfig, PluginContext } from '../types/plugin.types';

/**
 * 默认沙箱配置
 */
export const DEFAULT_SANDBOX_CONFIG: Required<PluginSandboxConfig> = {
  enabled: true,
  allowedModules: ['fs', 'path', 'os', 'crypto', 'url', 'querystring', 'events', 'util', 'stream', 'buffer'],
  allowedGlobals: ['console', 'setTimeout', 'setInterval', 'Math', 'JSON', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Promise', 'Map', 'Set', 'Error'],
  allowedNetworks: [],
  allowedPaths: [],
  deniedPaths: ['/etc', '/root', '/home', '/var', '/sys', '/proc'],
  networkEnabled: false,
  fileSystemEnabled: true,
  allowedSubprocess: false,
  maxMemory: 256 * 1024 * 1024,
  maxMemoryMB: 256,
  maxCpuSeconds: 30,
  maxCpuTime: 30000,
  maxFileSize: 10 * 1024 * 1024,
};

/**
 * 沙箱模块缓存
 */
const moduleCache = new Map<string, unknown>();

/**
 * 创建安全的 require 函数
 */
function createSecureRequire(config: Required<PluginSandboxConfig>): (moduleName: string) => unknown {
  const allowedModules = new Set(config.allowedModules || []);
  
  return (moduleName: string): unknown => {
    if (moduleCache.has(moduleName)) {
      return moduleCache.get(moduleName)!;
    }
    
    if (!allowedModules.has(moduleName)) {
      throw new Error(`模块 "${moduleName}" 不在允许列表中`);
    }
    
    let module: unknown;
    
    switch (moduleName) {
      case 'fs':
        module = {
          existsSync: () => false,
          readFileSync: () => '',
          statSync: () => ({ isFile: () => false, isDirectory: () => false }),
          readdirSync: () => [],
        };
        break;
      case 'path':
        module = path;
        break;
      case 'os':
        module = { homedir: () => '/tmp', tmpdir: () => '/tmp', platform: process.platform, arch: process.arch };
        break;
      case 'crypto':
        module = {
          randomBytes: crypto.randomBytes,
          createHash: crypto.createHash,
          createHmac: crypto.createHmac,
          randomUUID: crypto.randomUUID,
        };
        break;
      case 'url':
        module = { parse: (u: string) => new URL(u), resolve: (b: string, r: string) => new URL(r, b).toString() };
        break;
      case 'querystring':
        module = { parse: (str: string) => Object.fromEntries(new URLSearchParams(str)), stringify: (obj: Record<string, string>) => new URLSearchParams(obj).toString() };
        break;
      case 'events':
        module = { EventEmitter: class { on() {} emit() {} } };
        break;
      case 'util':
        module = { inspect: (obj: unknown) => JSON.stringify(obj) };
        break;
      case 'stream':
        module = { Readable: class {}, Writable: class {}, Transform: class {} };
        break;
      case 'buffer':
        module = { Buffer };
        break;
      default:
        try {
          module = require(moduleName);
        } catch {
          throw new Error(`无法加载模块 "${moduleName}"`);
        }
    }
    
    moduleCache.set(moduleName, module);
    return module;
  };
}

/**
 * 在沙箱中执行代码
 */
export function runInSandbox(
  code: string,
  config: PluginSandboxConfig,
  pluginContext: PluginContext,
  options?: {
    filename?: string;
    timeout?: number;
  },
): unknown {
  const mergedConfig = { ...DEFAULT_SANDBOX_CONFIG, ...config } as Required<PluginSandboxConfig>;
  const secureRequire = createSecureRequire(mergedConfig);
  
  if (!mergedConfig.enabled) {
    const moduleObj: { exports: unknown } = { exports: {} };
    const fn = new Function('module', 'exports', 'require', 'context', code);
    fn(moduleObj, moduleObj.exports, (m: string) => require(m), pluginContext);
    return (moduleObj.exports as { default?: unknown }).default || moduleObj.exports;
  }
  
  // 创建沙箱上下文
  const sandbox = {
    console: console,
    Buffer,
    setTimeout: globalThis.setTimeout,
    setInterval: globalThis.setInterval,
    clearTimeout: globalThis.clearTimeout,
    clearInterval: globalThis.clearInterval,
    Date,
    JSON,
    Math,
    Promise,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
  };

  const moduleObj: { exports: unknown } = { exports: {} };
  
  const script = new vm.Script(`
    (function(module, exports, require, context) {
      ${code}
    })(moduleObj, moduleObj.exports, secureRequire, __pluginContext);
  `, {
    filename: options?.filename || 'plugin.vm',
  });
  
  // 在 VM 中运行
  const vmContext = vm.createContext({
    ...sandbox,
    moduleObj,
    secureRequire,
    __pluginContext: pluginContext,
  });
  
  script.runInContext(vmContext, { timeout: options?.timeout || 5000 });
  
  return (moduleObj.exports as { default?: unknown }).default || moduleObj.exports;
}

/**
 * 创建插件隔离运行环境
 */
export function createPluginIsolate(
  config: PluginSandboxConfig,
  context: PluginContext,
): {
  run: (code: string, options?: { timeout?: number }) => unknown;
  eval: (expression: string) => unknown;
  dispose: () => void;
} {
  const mergedConfig = { ...DEFAULT_SANDBOX_CONFIG, ...config } as Required<PluginSandboxConfig>;
  const secureRequire = createSecureRequire(mergedConfig);
  
  const sandbox = {
    console: console,
    Buffer,
    setTimeout: globalThis.setTimeout,
    setInterval: globalThis.setInterval,
    clearTimeout: globalThis.clearTimeout,
    clearInterval: globalThis.clearInterval,
    Date,
    JSON,
    Math,
    Promise,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
  };
  
  const isolatedModule: { exports: unknown } = { exports: {} };
  
  return {
    run: (code: string, options?: { timeout?: number }) => {
      const script = new vm.Script(`
        (function(module, exports, require, context) {
          ${code}
        })(isolatedModule, isolatedModule.exports, secureRequire, __pluginContext);
      `, {
        filename: 'plugin.vm',
      });
      
      const vmContext = vm.createContext({
        ...sandbox,
        isolatedModule,
        secureRequire,
        __pluginContext: context,
      });
      
      script.runInContext(vmContext, { timeout: options?.timeout || 5000 });
      return (isolatedModule.exports as { default?: unknown }).default || isolatedModule.exports;
    },
    
    eval: (expression: string) => {
      const script = new vm.Script(expression, { filename: 'plugin-eval.vm' });
      const vmContext = vm.createContext(sandbox);
      return script.runInContext(vmContext, { timeout: 1000 });
    },
    
    dispose: () => {
      // 清理完成
    },
  };
}

/**
 * 验证代码安全性
 */
export function validateCodeSafety(code: string): { safe: boolean; issues: string[] } {
  const issues: string[] = [];
  
  const dangerousPatterns: Array<{ pattern: RegExp; message: string }> = [
    { pattern: /process\.exit/, message: '禁止使用 process.exit' },
    { pattern: /process\.binding/, message: '禁止访问 process.binding' },
    { pattern: /eval\s*\(/, message: '禁止使用 eval' },
    { pattern: /new\s+Function\s*\(/, message: '禁止使用 new Function' },
    { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/, message: '禁止加载 child_process 模块' },
    { pattern: /require\s*\(\s*['"]cluster['"]\s*\)/, message: '禁止加载 cluster 模块' },
    { pattern: /require\s*\(\s*['"]net['"]\s*\)/, message: '禁止加载 net 模块' },
    { pattern: /require\s*\(\s*['"]http['"]\s*\)/, message: '禁止加载 http 模块' },
    { pattern: /require\s*\(\s*['"]https['"]\s*\)/, message: '禁止加载 https 模块' },
  ];
  
  for (const { pattern, message } of dangerousPatterns) {
    if (pattern.test(code)) {
      issues.push(message);
    }
  }
  
  return { safe: issues.length === 0, issues };
}
