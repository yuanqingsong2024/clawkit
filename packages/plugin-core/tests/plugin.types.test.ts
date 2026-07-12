/**
 * 插件类型定义单元测试
 */

import { describe, it, expect } from 'vitest';
import type {
  PluginType,
  PluginLifecycleState,
  PluginMeta,
  PluginConfig,
  PluginContext,
  PluginSource,
  PluginLoadResult,
  PluginValidationResult,
  PluginEvent,
  PluginSandboxConfig,
  PluginStats,
} from '../src/types/plugin.types';

describe('插件类型定义测试', () => {
  describe('PluginType', () => {
    it('应该接受有效的插件类型', () => {
      const validTypes: PluginType[] = ['executor', 'trigger', 'notifier'];
      validTypes.forEach((type) => {
        expect(['executor', 'trigger', 'notifier']).toContain(type);
      });
    });
  });

  describe('PluginLifecycleState', () => {
    it('应该包含所有生命周期状态', () => {
      const states: PluginLifecycleState[] = [
        'registered',
        'initializing',
        'ready',
        'starting',
        'running',
        'stopping',
        'stopped',
        'error',
        'unloaded',
      ];
      expect(states).toHaveLength(9);
    });
  });

  describe('PluginMeta', () => {
    it('应该正确创建插件元信息', () => {
      const meta: PluginMeta = {
        name: 'test-plugin',
        version: '1.0.0',
        type: 'executor',
        description: '测试插件',
        author: 'Test Author',
        homepage: 'https://example.com',
        dependencies: {
          '@clawkit/shared': '^0.1.0',
        },
      };

      expect(meta.name).toBe('test-plugin');
      expect(meta.version).toBe('1.0.0');
      expect(meta.type).toBe('executor');
      expect(meta.dependencies['@clawkit/shared']).toBe('^0.1.0');
    });
  });

  describe('PluginConfig', () => {
    it('应该正确创建插件配置', () => {
      const config: PluginConfig = {
        name: 'test-plugin',
        version: '1.0.0',
        type: 'trigger',
        enabled: true,
        priority: 10,
        dependencies: ['@clawkit/shared'],
        config: {
          timeout: 30000,
        },
      };

      expect(config.enabled).toBe(true);
      expect(config.priority).toBe(10);
      expect(config.config?.timeout).toBe(30000);
    });
  });

  describe('PluginContext', () => {
    it('应该正确创建插件上下文', () => {
      const context: PluginContext = {
        dataDir: '/data/plugins/test',
        logDir: '/logs/plugins/test',
        tempDir: '/tmp/plugins/test',
        configDir: '/config/plugins/test',
        env: {
          NODE_ENV: 'test',
          PLUGIN_PATH: '/plugins/test',
        },
        workDir: '/workspace',
      };

      expect(context.dataDir).toBe('/data/plugins/test');
      expect(context.env.NODE_ENV).toBe('test');
      expect(context.workDir).toBe('/workspace');
    });
  });

  describe('PluginSource', () => {
    it('应该正确创建本地源插件源', () => {
      const source: PluginSource = {
        type: 'local',
        path: '/plugins/test',
      };

      expect(source.type).toBe('local');
      expect(source.path).toBe('/plugins/test');
    });

    it('应该正确创建 npm 源插件源', () => {
      const source: PluginSource = {
        type: 'npm',
        name: '@clawkit/plugin-example',
        version: '^1.0.0',
      };

      expect(source.type).toBe('npm');
      expect(source.name).toBe('@clawkit/plugin-example');
      expect(source.version).toBe('^1.0.0');
    });

    it('应该正确创建远程源插件源', () => {
      const source: PluginSource = {
        type: 'remote',
        url: 'https://registry.example.com/plugin.tgz',
        checksum: 'sha256:abc123',
      };

      expect(source.type).toBe('remote');
      expect(source.url).toBe('https://registry.example.com/plugin.tgz');
      expect(source.checksum).toBe('sha256:abc123');
    });
  });

  describe('PluginLoadResult', () => {
    it('应该正确创建成功的加载结果', () => {
      const meta: PluginMeta = {
        name: 'test-plugin',
        version: '1.0.0',
        type: 'executor',
      };

      const result: PluginLoadResult = {
        success: true,
        pluginId: 'executor:test-plugin@1.0.0',
        meta,
      };

      expect(result.success).toBe(true);
      expect(result.pluginId).toBe('executor:test-plugin@1.0.0');
      expect(result.meta).toBeDefined();
    });

    it('应该正确创建失败的加载结果', () => {
      const result: PluginLoadResult = {
        success: false,
        pluginId: 'executor:test-plugin@1.0.0',
        error: 'Plugin initialization failed',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Plugin initialization failed');
    });
  });

  describe('PluginValidationResult', () => {
    it('应该正确创建有效的验证结果', () => {
      const result: PluginValidationResult = {
        valid: true,
      };

      expect(result.valid).toBe(true);
    });

    it('应该正确创建带错误的验证结果', () => {
      const result: PluginValidationResult = {
        valid: false,
        errors: ['Missing required field: name', 'Invalid version format'],
      };

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it('应该正确创建带警告的验证结果', () => {
      const result: PluginValidationResult = {
        valid: true,
        warnings: ['Deprecated configuration option used'],
      };

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
    });
  });

  describe('PluginEvent', () => {
    it('应该正确创建插件事件', () => {
      const event: PluginEvent = {
        pluginId: 'executor:test-plugin@1.0.0',
        name: 'test-plugin',
        type: 'plugin:loaded',
        timestamp: Date.now(),
      };

      expect(event.pluginId).toBe('executor:test-plugin@1.0.0');
      expect(event.type).toBe('plugin:loaded');
      expect(event.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('PluginSandboxConfig', () => {
    it('应该正确创建沙箱配置', () => {
      const config: PluginSandboxConfig = {
        enabled: true,
        allowedModules: ['fs', 'path', 'os'],
        allowedGlobals: ['console', 'Math', 'JSON'],
        maxMemory: 256 * 1024 * 1024,
        maxCpuTime: 30000,
        maxFileSize: 10 * 1024 * 1024,
        allowedPaths: ['/tmp/plugins'],
        deniedPaths: ['/etc', '/root'],
        networkEnabled: false,
        fileSystemEnabled: true,
      };

      expect(config.enabled).toBe(true);
      expect(config.allowedModules).toContain('fs');
      expect(config.maxMemory).toBe(256 * 1024 * 1024);
      expect(config.networkEnabled).toBe(false);
    });
  });

  describe('PluginStats', () => {
    it('应该正确创建插件统计信息', () => {
      const stats: PluginStats = {
        pluginId: 'executor:test-plugin@1.0.0',
        state: 'running',
        startTime: Date.now() - 3600000, // 1小时前
        restartCount: 2,
        errorCount: 0,
        lastError: undefined,
        loadTime: 150,
        uptime: 3600000,
      };

      expect(stats.state).toBe('running');
      expect(stats.restartCount).toBe(2);
      expect(stats.uptime).toBe(3600000);
      expect(stats.lastError).toBeUndefined();
    });

    it('应该正确记录错误信息', () => {
      const stats: PluginStats = {
        pluginId: 'trigger:test-trigger@2.0.0',
        state: 'error',
        startTime: Date.now() - 60000,
        restartCount: 5,
        errorCount: 3,
        lastError: 'Connection timeout',
        loadTime: 200,
        uptime: 60000,
      };

      expect(stats.state).toBe('error');
      expect(stats.errorCount).toBe(3);
      expect(stats.lastError).toBe('Connection timeout');
    });
  });
});
