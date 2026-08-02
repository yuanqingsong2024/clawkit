/**
 * 流水线服务单元测试
 */

import { PipelineService } from '../src/services/pipeline.service';
import { HttpClient } from '../src/utils/http';

// 模拟 HttpClient
jest.mock('../src/utils/http');

const mockHttp = new HttpClient({ baseUrl: 'http://localhost:8787' }) as jest.Mocked<HttpClient>;

describe('PipelineService', () => {
  let service: PipelineService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PipelineService(mockHttp);
  });

  describe('create', () => {
    it('应该创建流水线', async () => {
      const mockPipeline = {
        id: 'pipeline-001',
        name: 'CI Pipeline',
        status: 'draft',
        stages: [],
        createdAt: '2026-08-01T12:00:00Z',
      };

      (mockHttp.post as jest.Mock).mockResolvedValue(mockPipeline);

      const result = await service.create({
        name: 'CI Pipeline',
        stages: [],
      });

      expect(mockHttp.post).toHaveBeenCalledWith('/api/pipelines', {
        name: 'CI Pipeline',
        stages: [],
      });
      expect(result.id).toBe('pipeline-001');
    });
  });

  describe('list', () => {
    it('应该返回流水线列表', async () => {
      const mockResponse = {
        data: [
          { id: 'pipeline-001', name: 'Pipeline 1', status: 'active' },
          { id: 'pipeline-002', name: 'Pipeline 2', status: 'draft' },
        ],
        total: 2,
      };

      (mockHttp.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.list();

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('应该支持分页', async () => {
      const mockResponse = {
        data: [{ id: 'pipeline-003' }],
        total: 50,
        page: 2,
        pageSize: 10,
      };

      (mockHttp.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.list({ page: 2, pageSize: 10 });

      expect(mockHttp.get).toHaveBeenCalledWith('/api/pipelines', {
        page: 2,
        pageSize: 10,
      });
      expect(result.page).toBe(2);
    });
  });

  describe('get', () => {
    it('应该返回流水线详情', async () => {
      const mockPipeline = {
        id: 'pipeline-001',
        name: 'CI Pipeline',
        stages: [
          { id: 'stage-1', name: 'Build', type: 'task' },
          { id: 'stage-2', name: 'Test', type: 'task', dependsOn: ['stage-1'] },
        ],
      };

      (mockHttp.get as jest.Mock).mockResolvedValue(mockPipeline);

      const result = await service.get('pipeline-001');

      expect(mockHttp.get).toHaveBeenCalledWith('/api/pipelines/pipeline-001');
      expect(result.stages).toHaveLength(2);
    });
  });

  describe('execute', () => {
    it('应该执行流水线', async () => {
      const mockExecution = {
        id: 'exec-001',
        pipelineId: 'pipeline-001',
        status: 'running',
        currentStage: 'stage-1',
      };

      (mockHttp.post as jest.Mock).mockResolvedValue(mockExecution);

      const result = await service.execute('pipeline-001');

      expect(mockHttp.post).toHaveBeenCalledWith('/api/pipelines/pipeline-001/execute');
      expect(result.status).toBe('running');
    });

    it('应该支持传入参数执行', async () => {
      const mockExecution = {
        id: 'exec-001',
        status: 'running',
      };

      (mockHttp.post as jest.Mock).mockResolvedValue(mockExecution);

      await service.execute('pipeline-001', {
        branch: 'main',
        env: { NODE_ENV: 'production' },
      });

      expect(mockHttp.post).toHaveBeenCalledWith('/api/pipelines/pipeline-001/execute', {
        branch: 'main',
        env: { NODE_ENV: 'production' },
      });
    });
  });

  describe('stop', () => {
    it('应该停止流水线执行', async () => {
      const mockResult = {
        id: 'exec-001',
        status: 'cancelled',
      };

      (mockHttp.post as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.stop('pipeline-001', 'exec-001');

      expect(mockHttp.post).toHaveBeenCalledWith(
        '/api/pipelines/pipeline-001/executions/exec-001/stop'
      );
      expect(result.status).toBe('cancelled');
    });
  });

  describe('getExecution', () => {
    it('应该返回执行详情', async () => {
      const mockExecution = {
        id: 'exec-001',
        pipelineId: 'pipeline-001',
        status: 'completed',
        stages: [
          { id: 'stage-1', status: 'success', duration: 3000 },
          { id: 'stage-2', status: 'success', duration: 5000 },
        ],
        totalDuration: 8000,
      };

      (mockHttp.get as jest.Mock).mockResolvedValue(mockExecution);

      const result = await service.getExecution('pipeline-001', 'exec-001');

      expect(result.totalDuration).toBe(8000);
    });
  });

  describe('getExecutionLogs', () => {
    it('应该返回执行日志', async () => {
      const mockLogs = {
        logs: [
          { timestamp: '2026-08-01T12:00:00Z', level: 'info', message: '开始执行' },
          { timestamp: '2026-08-01T12:00:01Z', level: 'info', message: 'Stage 1 完成' },
        ],
      };

      (mockHttp.get as jest.Mock).mockResolvedValue(mockLogs);

      const result = await service.getExecutionLogs('pipeline-001', 'exec-001');

      expect(result.logs).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('应该删除流水线', async () => {
      (mockHttp.delete as jest.Mock).mockResolvedValue(undefined);

      await expect(service.delete('pipeline-001')).resolves.toBeUndefined();

      expect(mockHttp.delete).toHaveBeenCalledWith('/api/pipelines/pipeline-001');
    });
  });
});
