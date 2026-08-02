/**
 * HTTP 客户端单元测试
 */

import { HttpClient } from '../src/utils/http';

describe('HttpClient', () => {
  const baseUrl = 'http://localhost:8787';
  let client: HttpClient;

  beforeEach(() => {
    client = new HttpClient({ baseUrl });
  });

  describe('constructor', () => {
    it('应该正确初始化客户端', () => {
      expect(client).toBeDefined();
    });

    it('应该使用默认配置', () => {
      const defaultClient = new HttpClient();
      expect(defaultClient).toBeDefined();
    });
  });

  describe('get', () => {
    it('应该能够发起 GET 请求（mock 测试）', async () => {
      // 由于我们没有真实的服务器，使用 mock
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      });
      
      global.fetch = mockFetch;

      const result = await client.get('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/test`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('post', () => {
    it('应该能够发起 POST 请求（mock 测试）', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: '123' }),
      });
      
      global.fetch = mockFetch;

      const result = await client.post('/api/tasks', { text: '测试任务' });

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/tasks`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ text: '测试任务' }),
        })
      );
    });
  });

  describe('put', () => {
    it('应该能够发起 PUT 请求（mock 测试）', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: '123', text: '更新后' }),
      });
      
      global.fetch = mockFetch;

      const result = await client.put('/api/tasks/123', { text: '更新后' });

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/tasks/123`,
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });
  });

  describe('delete', () => {
    it('应该能够发起 DELETE 请求（mock 测试）', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
      });
      
      global.fetch = mockFetch;

      await client.delete('/api/tasks/123');

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/tasks/123`,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('错误处理', () => {
    it('应该在响应不 ok 时抛出错误', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      
      global.fetch = mockFetch;

      await expect(client.get('/api/not-found')).rejects.toThrow();
    });

    it('应该包含状态码在错误信息中', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      
      global.fetch = mockFetch;

      try {
        await client.get('/api/error');
      } catch (error) {
        expect((error as { statusCode: number }).statusCode).toBe(500);
      }
    });
  });
});

describe('错误类', () => {
  it('应该正确抛出 NotFoundError', () => {
    const { NotFoundError } = require('../src/types');
    
    const error = new NotFoundError('Task', 'task-123');
    
    expect(error.message).toContain('Task');
    expect(error.message).toContain('task-123');
    expect((error as { statusCode: number }).statusCode).toBe(404);
  });
});
