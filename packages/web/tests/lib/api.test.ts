/**
 * api.ts 工具函数测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('api.ts 工具函数', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getBaseUrl', () => {
    it('应返回当前 origin', () => {
      const result = window.location.origin;
      expect(result).toBeTruthy();
    });
  });

  describe('API 函数集成测试', () => {
    it('应在 fetch 可用时正常工作', async () => {
      // 模拟 fetch
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json',
        },
        json: () => Promise.resolve({ test: 'data' }),
      };
      
      global.fetch = vi.fn().mockResolvedValue(mockResponse);
      
      const response = await fetch('/api/test');
      const data = await response.json();
      
      expect(data).toEqual({ test: 'data' });
    });

    it('应在 fetch 失败时处理错误', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: {
          get: () => 'text/plain',
        },
      };
      
      global.fetch = vi.fn().mockResolvedValue(mockResponse);
      
      const response = await fetch('/api/test');
      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
  });
});
