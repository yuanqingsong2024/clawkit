/**
 * 插件管理器单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginManager } from '../src/services/plugin-manager';
import type { PluginMeta, PluginContext, PluginType } from '../src/types/plugin.types';

describe('PluginManager', () => {
  // 测试插件上下文
  const testContext: PluginContext = {
    dataDir: '/tmp/plugins/test/data',
    logDir: '/tmp/plugins/test/logs',
    tempDir: '/tmp/plugins/test/temp',
    configDir: '/tmp/plugins/test/config',
    env: { NODE_ENV: 'test' },
    workDir: '/tmp/plugins/test',
  };

  // 创建模拟插件
  const createMockPlugin = (type: PluginType = 'executor') => ({
    meta: {
      name: 'mock-plugin',
      version: '1.0.0',
      type,
      description: 'Mock plugin for testing',
      author: 'Test',
      dependencies: {},
    } as PluginMeta,
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    unload: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue(true),
  });

  describe('构造函数', () => {
    it('应该创建 PluginManager 实例', () => {
      const manager = new PluginManager({});
      expect(manager).toBeDefined();
    });

    it('应该使用提供的上下文', () => {
      const manager = new PluginManager({
        defaultDataDir: testContext.dataDir,
        defaultLogDir: testContext.logDir,
      });
      expect(manager).toBeDefined();
    });
  });

  describe('register', () => {
    it('应该成功注册插件', () => {
      const manager = new PluginManager({});
      const mockPlugin = createMockPlugin();

      const result = manager.register(
        'executor',
        'mock-plugin',
        '1.0.0',
        { name: 'mock-plugin', version: '1.0.0', type: 'executor' },
        testContext,
        mockPlugin as any,
      );

      expect(result.success).toBe(true);
      expect(result.pluginId).toBe('executor:mock-plugin@1.0.0');
    });

    it('重复注册应失败', () => {
      const manager = new PluginManager({});
      const mockPlugin = createMockPlugin();

      manager.register(
        'executor',
        'mock-plugin',
        '1.0.0',
        { name: 'mock-plugin', version: '1.0.0', type: 'executor' },
        testContext,
        mockPlugin as any,
      );

      const result = manager.register(
        'executor',
        'mock-plugin',
        '1.0.0',
        { name: 'mock-plugin', version: '1.0.0', type: 'executor' },
        testContext,
        mockPlugin as any,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('已注册');
    });

    it('不同版本可以重复注册', () => {
      const manager = new PluginManager({});
      const mockPlugin = createMockPlugin();

      manager.register(
        'executor',
        'mock-plugin',
        '1.0.0',
        { name: 'mock-plugin', version: '1.0.0', type: 'executor' },
        testContext,
        mockPlugin as any,
      );

      const result = manager.register(
        'executor',
        'mock-plugin',
        '2.0.0',
        { name: 'mock-plugin', version: '2.0.0', type: 'executor' },
        testContext,
        mockPlugin as any,
      );

      expect(result.success).toBe(true);
    });
  });

  describe('load', () => {
    it('应该成功加载已注册的插件', async () => {
      const manager = new PluginManager({});
      const mockPlugin = createMockPlugin();

      manager.register(
        'executor',
        'mock-plugin',
        '1.0.0',
        { name: 'mock-plugin', version: '1.0.0', type: 'executor' },
        testContext,
        mockPlugin as any,
      );

      const result = await manager.load('executor:mock-plugin@1.0.0');

      expect(result.success).toBe(true);
      // 验证插件状态已变为 initializing/ready
      expect(manager.getState('executor:mock-plugin@1.0.0')).toMatch(/initializing|ready/);
    });

    it('加载未注册的插件应失败', async () => {
      const manager = new PluginManager({});
      const result = await manager.load('executor:nonexistent@1.0.0');

      expect(result.success).toBe(false);
      expect(result.error).toContain('未注册');
    });
  });

  describe('start / stop', () => {
    it('应该成功启动插件', async () => {
      const manager = new PluginManager({});
      const mockPlugin = createMockPlugin();

      manager.register(
        'executor',
        'mock-plugin',
        '1.0.0',
        { name: 'mock-plugin', version: '1.0.0', type: 'executor' },
        testContext,
        mockPlugin as any,
      );

      await manager.load('executor:mock-plugin@1.0.0');
      const result = await manager.start('executor:mock-plugin@1.0.0');

      expect(result.success).toBe(true);
      // 验证插件状态已变为 starting/running
      expect(manager.getState('executor:mock-plugin@1.0.0')).toMatch(/starting|running/);
    });

    it('应该成功停止插件', async () => {
      const manager = new PluginManager({});
      const mockPlugin = createMockPlugin();

      manager.register(
        'executor',
        'mock-plugin',
        '1.0.0',
        { name: 'mock-plugin', version: '1.0.0', type: 'executor' },
        testContext,
        mockPlugin as any,
      );

      await manager.load('executor:mock-plugin@1.0.0');
      await manager.start('executor:mock-plugin@1.0.0');
      const result = await manager.stop('executor:mock-plugin@1.0.0');

      expect(result.success).toBe(true);
      // 验证插件状态已变为 stopping/stopped
      expect(manager.getState('executor:mock-plugin@1.0.0')).toMatch(/stopping|stopped/);
    });
  });

  describe('unload', () => {
    it('应该成功卸载插件', async () => {
      const manager = new PluginManager({});
      const mockPlugin = createMockPlugin();

      manager.register(
        'executor',
        'mock-plugin',
        '1.0.0',
        { name: 'mock-plugin', version: '1.0.0', type: 'executor' },
        testContext,
        mockPlugin as any,
      );

      await manager.load('executor:mock-plugin@1.0.0');
      const result = await manager.unload('executor:mock-plugin@1.0.0');

      expect(result.success).toBe(true);
      // 验证插件已被移除
      expect(manager.has('executor:mock-plugin@1.0.0')).toBe(false);
    });
  });

  describe('get / has', () => {
    it('应该返回已注册的插件', () => {
      const manager = new PluginManager({});
      const mockPlugin = createMockPlugin();

      manager.register(
        'executor',
        'mock-plugin',
        '1.0.0',
        { name: 'mock-plugin', version: '1.0.0', type: 'executor' },
        testContext,
        mockPlugin as any,
      );

      const plugin = manager.get('executor:mock-plugin@1.0.0');
      expect(plugin).toBeDefined();
    });

    it('has 应该正确报告插件存在性', () => {
      const manager = new PluginManager({});
      const mockPlugin = createMockPlugin();

      expect(manager.has('executor:mock-plugin@1.0.0')).toBe(false);

      manager.register(
        'executor',
        'mock-plugin',
        '1.0.0',
        { name: 'mock-plugin', version: '1.0.0', type: 'executor' },
        testContext,
        mockPlugin as any,
      );

      expect(manager.has('executor:mock-plugin@1.0.0')).toBe(true);
    });
  });

  describe('getPluginsByType', () => {
    it('应该返回指定类型的所有插件', () => {
      const manager = new PluginManager({});
      const executorPlugin = createMockPlugin('executor');
      const triggerPlugin = createMockPlugin('trigger');

      manager.register(
        'executor',
        'executor-plugin',
        '1.0.0',
        { name: 'executor-plugin', version: '1.0.0', type: 'executor' },
        testContext,
        executorPlugin as any,
      );

      manager.register(
        'trigger',
        'trigger-plugin',
        '1.0.0',
        { name: 'trigger-plugin', version: '1.0.0', type: 'trigger' },
        testContext,
        triggerPlugin as any,
      );

      const executors = manager.getPluginsByType('executor');
      expect(executors).toHaveLength(1);
      expect(executors[0].name).toBe('executor-plugin');
    });
  });

  describe('getAllPlugins', () => {
    it('getAllPlugins 应该返回所有插件', () => {
      const manager = new PluginManager({});
      const plugin1 = createMockPlugin();
      const plugin2 = createMockPlugin('trigger');

      manager.register(
        'executor',
        'plugin1',
        '1.0.0',
        { name: 'plugin1', version: '1.0.0', type: 'executor' },
        testContext,
        plugin1 as any,
      );

      manager.register(
        'trigger',
        'plugin2',
        '1.0.0',
        { name: 'plugin2', version: '1.0.0', type: 'trigger' },
        testContext,
        plugin2 as any,
      );

      const all = manager.getAllPlugins();
      expect(all).toHaveLength(2);
    });
  });

  describe('getStats', () => {
    it('应该返回插件统计信息', async () => {
      const manager = new PluginManager({});
      const plugin = createMockPlugin();

      manager.register(
        'executor',
        'mock-plugin',
        '1.0.0',
        { name: 'mock-plugin', version: '1.0.0', type: 'executor' },
        testContext,
        plugin as any,
      );

      await manager.load('executor:mock-plugin@1.0.0');

      const stats = manager.getStats('executor:mock-plugin@1.0.0');
      expect(stats).toBeDefined();
      expect(stats?.name).toBe('mock-plugin');
    });

    it('未注册的插件返回 undefined', () => {
      const manager = new PluginManager({});
      const stats = manager.getStats('executor:nonexistent@1.0.0');
      expect(stats).toBeUndefined();
    });
  });

  describe('事件监听', () => {
    it('应该触发 registered 事件', () => {
      const manager = new PluginManager({});
      const mockPlugin = createMockPlugin();
      const handler = vi.fn();

      manager.on('registered', handler);

      manager.register(
        'executor',
        'mock-plugin',
        '1.0.0',
        { name: 'mock-plugin', version: '1.0.0', type: 'executor' },
        testContext,
        mockPlugin as any,
      );

      expect(handler).toHaveBeenCalled();
    });

    it('应该触发 loaded 事件', async () => {
      const manager = new PluginManager({});
      const mockPlugin = createMockPlugin();
      const handler = vi.fn();

      manager.on('loaded', handler);

      manager.register(
        'executor',
        'mock-plugin',
        '1.0.0',
        { name: 'mock-plugin', version: '1.0.0', type: 'executor' },
        testContext,
        mockPlugin as any,
      );

      await manager.load('executor:mock-plugin@1.0.0');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getAllStats', () => {
    it('应该返回所有插件的统计信息', async () => {
      const manager = new PluginManager({});
      const plugin = createMockPlugin();

      manager.register(
        'executor',
        'mock-plugin',
        '1.0.0',
        { name: 'mock-plugin', version: '1.0.0', type: 'executor' },
        testContext,
        plugin as any,
      );

      await manager.load('executor:mock-plugin@1.0.0');

      const allStats = manager.getAllStats();
      expect(allStats).toHaveLength(1);
    });
  });

  describe('getRunningCount', () => {
    it('应该返回正在运行的插件数量', async () => {
      const manager = new PluginManager({});
      const plugin = createMockPlugin();

      manager.register(
        'executor',
        'mock-plugin',
        '1.0.0',
        { name: 'mock-plugin', version: '1.0.0', type: 'executor' },
        testContext,
        plugin as any,
      );

      await manager.load('executor:mock-plugin@1.0.0');
      await manager.start('executor:mock-plugin@1.0.0');

      expect(manager.getRunningCount()).toBe(1);
    });
  });

  describe('getState', () => {
    it('应该返回插件当前状态', async () => {
      const manager = new PluginManager({});
      const plugin = createMockPlugin();

      manager.register(
        'executor',
        'mock-plugin',
        '1.0.0',
        { name: 'mock-plugin', version: '1.0.0', type: 'executor' },
        testContext,
        plugin as any,
      );

      expect(manager.getState('executor:mock-plugin@1.0.0')).toBe('registered');

      await manager.load('executor:mock-plugin@1.0.0');
      expect(manager.getState('executor:mock-plugin@1.0.0')).toMatch(/initializing|ready/);

      await manager.start('executor:mock-plugin@1.0.0');
      expect(manager.getState('executor:mock-plugin@1.0.0')).toMatch(/starting|running/);
    });

    it('未注册的插件应返回 undefined', () => {
      const manager = new PluginManager({});
      expect(manager.getState('executor:nonexistent@1.0.0')).toBeUndefined();
    });
  });
});
