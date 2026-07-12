import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiGet, apiPost, apiPut, apiDelete, apiRequest, ApiError } from '../../src/lib/api';

describe('API 模块', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('apiRequest', () => {
    it('应该正确构建 URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ success: true, code: 'ok', message: '', data: {} }),
      });
      global.fetch = mockFetch;

      await apiRequest('/test');
      
      expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.any(Object));
    });

    it('路径以 / 开头时不应该重复添加', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ success: true, code: 'ok', message: '', data: {} }),
      });
      global.fetch = mockFetch;

      await apiRequest('/test');
      
      expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.any(Object));
    });

    it('空路径应该抛出错误', async () => {
      await expect(apiRequest('')).rejects.toThrow('接口路径不能为空');
    });

    it('HTTP 错误应该抛出 ApiError', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ success: false, code: 'not_found', message: '资源不存在' }),
      });
      global.fetch = mockFetch;

      await expect(apiRequest('/not-found')).rejects.toThrow();
    });

    it('非 JSON 响应应该抛出错误', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/plain']]),
      });
      global.fetch = mockFetch;

      await expect(apiRequest('/html')).rejects.toThrow('接口返回格式不正确');
    });

    it('API 返回 success: false 应该抛出 ApiError', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ success: false, code: 'error_code', message: '错误信息' }),
      });
      global.fetch = mockFetch;

      await expect(apiRequest('/error')).rejects.toThrow('错误信息');
    });
  });

  describe('apiGet', () => {
    it('应该发送 GET 请求并返回 data', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ success: true, code: 'ok', message: '', data: { id: 1 } }),
      });
      global.fetch = mockFetch;

      const result = await apiGet<{ id: number }>('/test');
      
      expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({ method: 'GET' }));
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('apiPost', () => {
    it('应该发送 POST 请求并包含 body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ success: true, code: 'ok', message: '', data: { created: true } }),
      });
      global.fetch = mockFetch;

      const body = { name: 'test' };
      const result = await apiPost('/test', body);
      
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
        })
      );
      expect(result).toEqual({ created: true });
    });

    it('不传 body 时应该发送空 body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ success: true, code: 'ok', message: '', data: null }),
      });
      global.fetch = mockFetch;

      await apiPost('/test');
      
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        })
      );
    });
  });

  describe('apiPut', () => {
    it('应该发送 PUT 请求', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ success: true, code: 'ok', message: '', data: { updated: true } }),
      });
      global.fetch = mockFetch;

      const body = { name: 'updated' };
      const result = await apiPut('/test', body);
      
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(body),
        })
      );
      expect(result).toEqual({ updated: true });
    });
  });

  describe('apiDelete', () => {
    it('应该发送 DELETE 请求', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ success: true, code: 'ok', message: '', data: { deleted: true } }),
      });
      global.fetch = mockFetch;

      const result = await apiDelete('/test');
      
      expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({ method: 'DELETE' }));
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('ApiError', () => {
    it('应该正确存储错误属性', () => {
      const error = new ApiError({
        code: 'test_error',
        message: '测试错误',
        details: { extra: 'info' },
        statusCode: 400,
      });

      expect(error.code).toBe('test_error');
      expect(error.message).toBe('测试错误');
      expect(error.details).toEqual({ extra: 'info' });
      expect(error.statusCode).toBe(400);
    });
  });
});
