/**
 * 任务服务单元测试
 */

import { TaskService } from '../src/services/task.service';
import { HttpClient } from '../src/utils/http';

// 模拟 HttpClient
jest.mock('../src/utils/http');

const mockHttp = new HttpClient({ baseUrl: 'http://localhost:8787' }) as jest.Mocked<HttpClient>;

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TaskService(mockHttp);
  });

  describe('create', () => {
    it('应该创建任务并返回任务对象', async () => {
      const mockTask = {
        id: 'task-001',
        text: '优化数据库查询',
        status: 'draft',
        projectKey: 'my-project',
        priority: 'medium',
        createdAt: '2026-08-01T12:00:00Z',
        updatedAt: '2026-08-01T12:00:00Z',
      };

      (mockHttp.post as jest.Mock).mockResolvedValue(mockTask);

      const result = await service.create({
        text: '优化数据库查询',
        projectKey: 'my-project',
        priority: 'medium',
      });

      expect(mockHttp.post).toHaveBeenCalledWith('/api/tasks', {
        text: '优化数据库查询',
        projectKey: 'my-project',
        priority: 'medium',
        prompt: undefined,
      });
      expect(result).toEqual(mockTask);
    });

    it('应该支持创建带 prompt 的任务', async () => {
      const mockTask = {
        id: 'task-002',
        text: '代码审查',
        status: 'draft',
        prompt: '请审查这段代码',
      };

      (mockHttp.post as jest.Mock).mockResolvedValue(mockTask);

      const result = await service.create({
        text: '代码审查',
        prompt: '请审查这段代码',
      });

      expect(mockHttp.post).toHaveBeenCalledWith('/api/tasks', {
        text: '代码审查',
        prompt: '请审查这段代码',
        projectKey: undefined,
        priority: undefined,
      });
      expect(result.prompt).toBe('请审查这段代码');
    });
  });

  describe('list', () => {
    it('应该返回任务列表', async () => {
      const mockResponse = {
        data: [
          { id: 'task-001', text: '任务1', status: 'draft' },
          { id: 'task-002', text: '任务2', status: 'approved' },
        ],
        total: 2,
        page: 1,
        pageSize: 10,
      };

      (mockHttp.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.list();

      expect(mockHttp.get).toHaveBeenCalledWith('/api/tasks', {});
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('应该支持分页参数', async () => {
      const mockResponse = {
        data: [{ id: 'task-003', text: '任务3', status: 'draft' }],
        total: 100,
        page: 3,
        pageSize: 20,
      };

      (mockHttp.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.list({
        page: 3,
        pageSize: 20,
      });

      expect(mockHttp.get).toHaveBeenCalledWith('/api/tasks', {
        page: 3,
        pageSize: 20,
      });
      expect(result.page).toBe(3);
    });

    it('应该支持状态过滤', async () => {
      const mockResponse = {
        data: [{ id: 'task-001', text: '任务1', status: 'draft' }],
        total: 1,
      };

      (mockHttp.get as jest.Mock).mockResolvedValue(mockResponse);

      await service.list({ status: 'draft' });

      expect(mockHttp.get).toHaveBeenCalledWith('/api/tasks', {
        status: 'draft',
      });
    });
  });

  describe('get', () => {
    it('应该返回任务详情', async () => {
      const mockTask = {
        id: 'task-001',
        text: '测试任务',
        status: 'draft',
      };

      (mockHttp.get as jest.Mock).mockResolvedValue(mockTask);

      const result = await service.get('task-001');

      expect(mockHttp.get).toHaveBeenCalledWith('/api/tasks/task-001');
      expect(result.id).toBe('task-001');
    });

    it('应该在任务不存在时抛出 NotFoundError', async () => {
      const error = new Error('Not found');
      (error as { statusCode: number }).statusCode = 404;
      (mockHttp.get as jest.Mock).mockRejectedValue(error);

      await expect(service.get('non-existent')).rejects.toThrow('Task not found');
    });
  });

  describe('getStatus', () => {
    it('应该返回任务状态', async () => {
      (mockHttp.get as jest.Mock).mockResolvedValue({ status: 'running' });

      const result = await service.getStatus('task-001');

      expect(result.status).toBe('running');
    });
  });

  describe('approve', () => {
    it('应该审批通过任务', async () => {
      const mockTask = {
        id: 'task-001',
        status: 'approved',
      };

      (mockHttp.post as jest.Mock).mockResolvedValue(mockTask);

      const result = await service.approve('task-001');

      expect(mockHttp.post).toHaveBeenCalledWith('/api/tasks/task-001/approve', {
        comment: undefined,
      });
      expect(result.status).toBe('approved');
    });

    it('应该支持添加审批评论', async () => {
      const mockTask = {
        id: 'task-001',
        status: 'approved',
      };

      (mockHttp.post as jest.Mock).mockResolvedValue(mockTask);

      await service.approve('task-001', { comment: '同意执行' });

      expect(mockHttp.post).toHaveBeenCalledWith('/api/tasks/task-001/approve', {
        comment: '同意执行',
      });
    });
  });

  describe('reject', () => {
    it('应该拒绝任务', async () => {
      const mockTask = {
        id: 'task-001',
        status: 'rejected',
      };

      (mockHttp.post as jest.Mock).mockResolvedValue(mockTask);

      const result = await service.reject('task-001', {
        reason: '需求不明确',
      });

      expect(mockHttp.post).toHaveBeenCalledWith('/api/tasks/task-001/reject', {
        reason: '需求不明确',
      });
      expect(result.status).toBe('rejected');
    });
  });

  describe('cancel', () => {
    it('应该取消任务', async () => {
      const mockTask = {
        id: 'task-001',
        status: 'cancelled',
      };

      (mockHttp.post as jest.Mock).mockResolvedValue(mockTask);

      const result = await service.cancel('task-001');

      expect(mockHttp.post).toHaveBeenCalledWith('/api/tasks/task-001/cancel');
      expect(result.status).toBe('cancelled');
    });
  });

  describe('delete', () => {
    it('应该删除任务', async () => {
      (mockHttp.delete as jest.Mock).mockResolvedValue(undefined);

      await expect(service.delete('task-001')).resolves.toBeUndefined();

      expect(mockHttp.delete).toHaveBeenCalledWith('/api/tasks/task-001');
    });

    it('应该在任务不存在时抛出 NotFoundError', async () => {
      const error = new Error('Not found');
      (error as { statusCode: number }).statusCode = 404;
      (mockHttp.delete as jest.Mock).mockRejectedValue(error);

      await expect(service.delete('non-existent')).rejects.toThrow('Task not found');
    });
  });

  describe('retry', () => {
    it('应该重新执行任务', async () => {
      const mockTask = {
        id: 'task-001',
        status: 'running',
      };

      (mockHttp.post as jest.Mock).mockResolvedValue(mockTask);

      const result = await service.retry('task-001');

      expect(mockHttp.post).toHaveBeenCalledWith('/api/tasks/task-001/retry');
      expect(result.status).toBe('running');
    });
  });

  describe('getResult', () => {
    it('应该返回任务结果', async () => {
      const mockTask = {
        id: 'task-001',
        result: {
          output: '任务完成',
          duration: 3000,
        },
      };

      (mockHttp.get as jest.Mock).mockResolvedValue(mockTask);

      const result = await service.getResult('task-001');

      expect(result).toEqual({
        output: '任务完成',
        duration: 3000,
      });
    });
  });
});
