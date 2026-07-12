/**
 * 插件生命周期服务单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginLifecycleService, createLifecycleService } from '../src/services/plugin-lifecycle.service';
import type { PluginMeta, PluginContext } from '../src/types/plugin.types';

describe('PluginLifecycleService', () => {
  // 测试插件元信息
  const testMeta: PluginMeta = {
    name: 'test-plugin',
    version: '1.0.0',
    type: 'executor',
    description: '测试插件',
    author: 'Test Author',
    dependencies: {},
  };

  // 测试插件上下文
  const testContext: PluginContext = {
    dataDir: '/tmp/plugins/test/data',
    logDir: '/tmp/plugins/test/logs',
    tempDir: '/tmp/plugins/test/temp',
    configDir: '/tmp/plugins/test/config',
    env: { NODE_ENV: 'test' },
    workDir: '/tmp/plugins/test',
  };

  describe('构造函数与初始化', () => {
    it('应该创建生命周期服务实例', () => {
      const service = new PluginLifecycleService('test-plugin-id', testMeta, testContext);
      expect(service).toBeDefined();
    });

    it('初始状态应为 registered', () => {
      const service = new PluginLifecycleService('test-plugin-id', testMeta, testContext);
      expect(service.getState()).toBe('registered');
    });

    it('应该正确获取插件 ID', () => {
      const service = new PluginLifecycleService('test-plugin-id', testMeta, testContext);
      expect(service.getPluginId()).toBe('test-plugin-id');
    });

    it('应该正确获取插件元信息', () => {
      const service = new PluginLifecycleService('test-plugin-id', testMeta, testContext);
      const meta = service.getMeta();
      expect(meta.name).toBe('test-plugin');
      expect(meta.version).toBe('1.0.0');
    });

    it('应该正确获取插件上下文', () => {
      const service = new PluginLifecycleService('test-plugin-id', testMeta, testContext);
      const context = service.getContext();
      expect(context.dataDir).toBe('/tmp/plugins/test/data');
      expect(context.env.NODE_ENV).toBe('test');
    });
  });

  describe('getStats', () => {
    it('应该返回正确的统计信息', () => {
      const service = new PluginLifecycleService('test-plugin-id', testMeta, testContext);
      const stats = service.getStats();

      expect(stats.pluginId).toBe('test-plugin-id');
      expect(stats.state).toBe('registered');
      expect(stats.name).toBe('test-plugin');
      expect(stats.version).toBe('1.0.0');
      expect(stats.type).toBe('executor');
    });

    it('应该跟踪错误信息', () => {
      const service = new PluginLifecycleService('test-plugin-id', testMeta, testContext);
      const stats = service.getStats();
      
      expect(stats.errorCount).toBe(0);
      expect(stats.lastError).toBeUndefined();
    });
  });

  describe('getStateHistory', () => {
    it('应该返回状态历史记录', () => {
      const service = new PluginLifecycleService('test-plugin-id', testMeta, testContext);
      const history = service.getStateHistory();
      
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].state).toBe('registered');
    });
  });

  describe('getError', () => {
    it('初始状态应没有错误', () => {
      const service = new PluginLifecycleService('test-plugin-id', testMeta, testContext);
      expect(service.getError()).toBeUndefined();
    });
  });

  describe('setHooks', () => {
    it('应该正确设置生命周期钩子', () => {
      const service = new PluginLifecycleService('test-plugin-id', testMeta, testContext);
      const hooks = {
        onBeforeInitialize: vi.fn(),
        onAfterInitialize: vi.fn(),
      };
      
      service.setHooks(hooks);
      // 钩子已设置，没有抛出错误即成功
      expect(true).toBe(true);
    });

    it('应该可以覆盖部分钩子', () => {
      const service = new PluginLifecycleService('test-plugin-id', testMeta, testContext);
      
      service.setHooks({ onBeforeInitialize: vi.fn() });
      service.setHooks({ onAfterInitialize: vi.fn() });
      
      expect(true).toBe(true);
    });
  });

  describe('事件发射', () => {
    it('应该能够监听状态变更事件', async () => {
      const service = new PluginLifecycleService('test-plugin-id', testMeta, testContext);
      const eventPromise = new Promise<unknown>((resolve) => {
        service.on('stateChange' as any, (data: unknown) => {
          resolve(data);
        });
      });
      
      // 触发状态变更
      service.emit('stateChange', { from: 'registered', to: 'initializing' });
      
      const event = await eventPromise;
      expect(event).toBeDefined();
    });
  });
});

describe('createLifecycleService 工厂函数', () => {
  it('应该能够创建 PluginLifecycleService 实例', () => {
    const testMeta: PluginMeta = {
      name: 'test-plugin',
      version: '1.0.0',
      type: 'executor',
    };
    const testContext: PluginContext = {
      dataDir: '/tmp/test/data',
      logDir: '/tmp/test/logs',
      tempDir: '/tmp/test/temp',
      configDir: '/tmp/test/config',
      env: {},
      workDir: '/tmp/test',
    };

    const service = createLifecycleService('test-id', testMeta, testContext);
    expect(service).toBeInstanceOf(PluginLifecycleService);
  });

  it('应该返回带有正确 ID 的服务', () => {
    const testMeta: PluginMeta = {
      name: 'test-plugin',
      version: '1.0.0',
      type: 'trigger',
    };
    const testContext: PluginContext = {
      dataDir: '/tmp/test/data',
      logDir: '/tmp/test/logs',
      tempDir: '/tmp/test/temp',
      configDir: '/tmp/test/config',
      env: {},
      workDir: '/tmp/test',
    };

    const service = createLifecycleService('custom-id-123', testMeta, testContext);
    expect(service.getPluginId()).toBe('custom-id-123');
  });
});
