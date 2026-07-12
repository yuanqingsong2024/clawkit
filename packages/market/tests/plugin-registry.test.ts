/**
 * 插件注册表服务单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DefaultPluginRegistry,
  getPluginRegistry,
  setPluginRegistry,
  type InstalledPlugin,
} from '../src/services/plugin-registry.service';
import type { PluginType } from '@clawkit/plugin-core';

describe('DefaultPluginRegistry', () => {
  let registry: DefaultPluginRegistry;

  beforeEach(() => {
    registry = new DefaultPluginRegistry();
  });

  const createMockPlugin = (overrides?: Partial<InstalledPlugin>): InstalledPlugin => ({
    id: 'test-plugin',
    name: 'Test Plugin',
    type: 'executor' as PluginType,
    version: '1.0.0',
    installPath: '/path/to/plugin',
    status: 'installed',
    enabled: true,
    installedAt: Date.now(),
    updatedAt: Date.now(),
    dependencies: [],
    ...overrides,
  });

  describe('register', () => {
    it('应该成功注册插件', () => {
      const plugin = createMockPlugin();
      registry.register(plugin);

      expect(registry.has('test-plugin')).toBe(true);
      expect(registry.get('test-plugin')).toEqual(plugin);
    });

    it('应该覆盖已存在的插件', () => {
      const plugin1 = createMockPlugin({ version: '1.0.0' });
      const plugin2 = createMockPlugin({ version: '2.0.0' });

      registry.register(plugin1);
      registry.register(plugin2);

      expect(registry.get('test-plugin')?.version).toBe('2.0.0');
    });
  });

  describe('unregister', () => {
    it('应该成功注销已存在的插件', () => {
      registry.register(createMockPlugin());
      const result = registry.unregister('test-plugin');

      expect(result).toBe(true);
      expect(registry.has('test-plugin')).toBe(false);
    });

    it('注销不存在的插件应该返回 false', () => {
      const result = registry.unregister('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    it('应该返回已注册的插件', () => {
      const plugin = createMockPlugin({ name: 'My Plugin' });
      registry.register(plugin);

      const result = registry.get('test-plugin');
      expect(result?.name).toBe('My Plugin');
    });

    it('查询不存在的插件应该返回 undefined', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('已注册的插件应该返回 true', () => {
      registry.register(createMockPlugin());
      expect(registry.has('test-plugin')).toBe(true);
    });

    it('未注册的插件应该返回 false', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('应该返回所有已注册的插件', () => {
      registry.register(createMockPlugin({ id: 'plugin-1' }));
      registry.register(createMockPlugin({ id: 'plugin-2' }));
      registry.register(createMockPlugin({ id: 'plugin-3' }));

      const plugins = registry.getAll();
      expect(plugins).toHaveLength(3);
    });

    it('空注册表应该返回空数组', () => {
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('getByType', () => {
    it('应该按类型过滤插件', () => {
      registry.register(createMockPlugin({ id: 'exec-1', type: 'executor' }));
      registry.register(createMockPlugin({ id: 'trig-1', type: 'trigger' }));
      registry.register(createMockPlugin({ id: 'notif-1', type: 'notifier' }));

      const executors = registry.getByType('executor');
      expect(executors).toHaveLength(1);
      expect(executors[0].id).toBe('exec-1');

      const triggers = registry.getByType('trigger');
      expect(triggers).toHaveLength(1);
      expect(triggers[0].id).toBe('trig-1');
    });
  });

  describe('getEnabled', () => {
    it('应该只返回已启用的插件', () => {
      registry.register(createMockPlugin({ id: 'enabled-1', enabled: true }));
      registry.register(createMockPlugin({ id: 'disabled-1', enabled: false }));
      registry.register(createMockPlugin({ id: 'enabled-2', enabled: true }));

      const enabled = registry.getEnabled();
      expect(enabled).toHaveLength(2);
      expect(enabled.map(p => p.id)).toContain('enabled-1');
      expect(enabled.map(p => p.id)).toContain('enabled-2');
    });
  });

  describe('enable/disable', () => {
    it('应该成功启用插件', () => {
      registry.register(createMockPlugin({ enabled: false }));
      const result = registry.enable('test-plugin');

      expect(result).toBe(true);
      expect(registry.get('test-plugin')?.enabled).toBe(true);
    });

    it('应该成功禁用插件', () => {
      registry.register(createMockPlugin({ enabled: true }));
      const result = registry.disable('test-plugin');

      expect(result).toBe(true);
      expect(registry.get('test-plugin')?.enabled).toBe(false);
    });

    it('操作不存在的插件应该返回 false', () => {
      expect(registry.enable('non-existent')).toBe(false);
      expect(registry.disable('non-existent')).toBe(false);
    });
  });

  describe('updateStatus', () => {
    it('应该更新插件状态', () => {
      registry.register(createMockPlugin());
      registry.updateStatus('test-plugin', 'updating');

      expect(registry.get('test-plugin')?.status).toBe('updating');
    });
  });

  describe('size', () => {
    it('应该返回插件数量', () => {
      expect(registry.size()).toBe(0);

      registry.register(createMockPlugin({ id: 'plugin-1' }));
      expect(registry.size()).toBe(1);

      registry.register(createMockPlugin({ id: 'plugin-2' }));
      expect(registry.size()).toBe(2);

      registry.unregister('plugin-1');
      expect(registry.size()).toBe(1);
    });
  });
});

describe('全局注册表', () => {
  it('应该返回同一个全局实例', () => {
    const registry1 = getPluginRegistry();
    const registry2 = getPluginRegistry();

    expect(registry1).toBe(registry2);
  });

  it('应该允许设置新的全局实例', () => {
    const newRegistry = new DefaultPluginRegistry();
    setPluginRegistry(newRegistry);

    expect(getPluginRegistry()).toBe(newRegistry);
  });
});
