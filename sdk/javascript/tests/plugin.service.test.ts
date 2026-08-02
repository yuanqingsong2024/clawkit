/**
 * 插件服务单元测试
 */

import { PluginService } from '../src/services/plugin.service';
import { HttpClient } from '../src/utils/http';

// 模拟 HttpClient
jest.mock('../src/utils/http');

const mockHttp = new HttpClient({ baseUrl: 'http://localhost:8787' }) as jest.Mocked<HttpClient>;

describe('PluginService', () => {
  let service: PluginService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PluginService(mockHttp);
  });

  describe('list', () => {
    it('应该返回插件列表', async () => {
      const mockPlugins = {
        data: [
          { name: 'dingtalk-notifier', type: 'notifier', version: '1.0.0' },
          { name: 'gitlab-trigger', type: 'trigger', version: '1.0.0' },
        ],
        total: 2,
      };

      (mockHttp.get as jest.Mock).mockResolvedValue(mockPlugins);

      const result = await service.list();

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('应该支持类型过滤', async () => {
      const mockPlugins = {
        data: [{ name: 'dingtalk-notifier', type: 'notifier' }],
        total: 1,
      };

      (mockHttp.get as jest.Mock).mockResolvedValue(mockPlugins);

      await service.list({ type: 'notifier' });

      expect(mockHttp.get).toHaveBeenCalledWith('/api/plugins', {
        type: 'notifier',
      });
    });
  });

  describe('search', () => {
    it('应该搜索插件', async () => {
      const mockPlugins = {
        data: [{ name: 'dingtalk-notifier', description: '钉钉通知器' }],
        total: 1,
      };

      (mockHttp.get as jest.Mock).mockResolvedValue(mockPlugins);

      const result = await service.search('钉钉');

      expect(mockHttp.get).toHaveBeenCalledWith('/api/plugins/search', {
        q: '钉钉',
      });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('get', () => {
    it('应该返回插件详情', async () => {
      const mockPlugin = {
        name: 'dingtalk-notifier',
        type: 'notifier',
        version: '1.0.0',
        description: '钉钉通知器',
        author: { name: 'ClawKit Team' },
        capabilities: [{ type: 'markdown', description: '支持 Markdown' }],
      };

      (mockHttp.get as jest.Mock).mockResolvedValue(mockPlugin);

      const result = await service.get('dingtalk-notifier');

      expect(mockHttp.get).toHaveBeenCalledWith('/api/plugins/dingtalk-notifier');
      expect(result.name).toBe('dingtalk-notifier');
    });
  });

  describe('install', () => {
    it('应该安装插件', async () => {
      const mockResult = {
        success: true,
        plugin: { name: 'github-trigger', status: 'installed' },
      };

      (mockHttp.post as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.install('github-trigger');

      expect(mockHttp.post).toHaveBeenCalledWith('/api/plugins/install', {
        name: 'github-trigger',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('uninstall', () => {
    it('应该卸载插件', async () => {
      (mockHttp.post as jest.Mock).mockResolvedValue({ success: true });

      const result = await service.uninstall('github-trigger');

      expect(mockHttp.post).toHaveBeenCalledWith('/api/plugins/uninstall', {
        name: 'github-trigger',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('update', () => {
    it('应该更新插件', async () => {
      const mockResult = {
        success: true,
        plugin: { name: 'dingtalk-notifier', version: '1.1.0' },
      };

      (mockHttp.post as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.update('dingtalk-notifier');

      expect(mockHttp.post).toHaveBeenCalledWith('/api/plugins/update', {
        name: 'dingtalk-notifier',
      });
    });
  });

  describe('rate', () => {
    it('应该评分插件', async () => {
      const mockResult = {
        success: true,
        rating: 4.5,
      };

      (mockHttp.post as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.rate('dingtalk-notifier', 5);

      expect(mockHttp.post).toHaveBeenCalledWith('/api/plugins/rate', {
        name: 'dingtalk-notifier',
        rating: 5,
      });
    });

    it('应该验证评分范围', async () => {
      await expect(service.rate('dingtalk-notifier', 0)).rejects.toThrow();
      await expect(service.rate('dingtalk-notifier', 6)).rejects.toThrow();
    });
  });

  describe('getInstalled', () => {
    it('应该返回已安装插件列表', async () => {
      const mockPlugins = {
        data: [
          { name: 'dingtalk-notifier', status: 'installed' },
          { name: 'gitlab-trigger', status: 'installed' },
        ],
        total: 2,
      };

      (mockHttp.get as jest.Mock).mockResolvedValue(mockPlugins);

      const result = await service.getInstalled();

      expect(mockHttp.get).toHaveBeenCalledWith('/api/plugins/installed');
      expect(result.data).toHaveLength(2);
    });
  });

  describe('validateConfig', () => {
    it('应该验证插件配置', async () => {
      const mockResult = {
        valid: true,
        config: { webhookUrl: 'https://...' },
      };

      (mockHttp.post as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.validateConfig('dingtalk-notifier', {
        webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=xxx',
      });

      expect(result.valid).toBe(true);
    });
  });
});
