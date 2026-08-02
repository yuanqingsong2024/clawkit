/**
 * 流水线服务
 * 提供流水线管理的 CRUD 操作
 */

import { HttpClient } from '../utils/http';
import {
  Pipeline,
  PipelineStage,
  CreatePipelineOptions,
  UpdatePipelineOptions,
  PipelineExecution,
  PipelineStats,
  NotFoundError,
} from '../types';

/**
 * 流水线服务类
 */
export class PipelineService {
  private readonly http: HttpClient;
  private readonly resource = 'pipelines';

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * 获取流水线列表
   */
  async list(): Promise<Pipeline[]> {
    const response = await this.http.get<Pipeline[]>(`/api/${this.resource}`);
    return Array.isArray(response) ? response : [];
  }

  /**
   * 获取流水线详情
   */
  async get(pipelineId: string): Promise<Pipeline> {
    try {
      return await this.http.get<Pipeline>(`/api/${this.resource}/${pipelineId}`);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && (error as { statusCode: number }).statusCode === 404) {
        throw new NotFoundError('Pipeline', pipelineId);
      }
      throw error;
    }
  }

  /**
   * 创建流水线
   */
  async create(options: CreatePipelineOptions): Promise<Pipeline> {
    return this.http.post<Pipeline>(`/api/${this.resource}`, {
      name: options.name,
      description: options.description,
      stages: options.stages || [],
    });
  }

  /**
   * 更新流水线
   */
  async update(pipelineId: string, options: UpdatePipelineOptions): Promise<Pipeline> {
    try {
      return await this.http.put<Pipeline>(`/api/${this.resource}/${pipelineId}`, options);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && (error as { statusCode: number }).statusCode === 404) {
        throw new NotFoundError('Pipeline', pipelineId);
      }
      throw error;
    }
  }

  /**
   * 删除流水线
   */
  async delete(pipelineId: string): Promise<void> {
    try {
      await this.http.delete(`/api/${this.resource}/${pipelineId}`);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && (error as { statusCode: number }).statusCode === 404) {
        throw new NotFoundError('Pipeline', pipelineId);
      }
      throw error;
    }
  }

  /**
   * 验证流水线配置
   */
  async validate(pipelineId: string): Promise<{ valid: boolean; errors: string[] }> {
    return this.http.post<{ valid: boolean; errors: string[] }>(
      `/api/${this.resource}/${pipelineId}/validate`
    );
  }

  /**
   * 执行流水线
   */
  async execute(pipelineId: string, triggerType = 'manual'): Promise<PipelineExecution> {
    try {
      return await this.http.post<PipelineExecution>(
        `/api/${this.resource}/${pipelineId}/execute`,
        { triggerType }
      );
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && (error as { statusCode: number }).statusCode === 404) {
        throw new NotFoundError('Pipeline', pipelineId);
      }
      throw error;
    }
  }

  /**
   * 获取执行历史
   */
  async getExecutionHistory(pipelineId: string): Promise<PipelineExecution[]> {
    return this.http.get<PipelineExecution[]>(`/api/${this.resource}/${pipelineId}/executions`);
  }

  /**
   * 获取执行详情
   */
  async getExecution(executionId: string): Promise<PipelineExecution> {
    return this.http.get<PipelineExecution>(`/api/${this.resource}/executions/${executionId}`);
  }

  /**
   * 取消执行
   */
  async cancelExecution(executionId: string): Promise<void> {
    await this.http.post(`/api/${this.resource}/executions/${executionId}/cancel`);
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<PipelineStats> {
    return this.http.get<PipelineStats>(`/api/${this.resource}/stats`);
  }

  /**
   * 添加阶段
   */
  async addStage(pipelineId: string, stage: PipelineStage): Promise<Pipeline> {
    const pipeline = await this.get(pipelineId);
    return this.update(pipelineId, {
      stages: [...pipeline.stages, stage],
    });
  }

  /**
   * 移除阶段
   */
  async removeStage(pipelineId: string, stageId: string): Promise<Pipeline> {
    const pipeline = await this.get(pipelineId);
    return this.update(pipelineId, {
      stages: pipeline.stages.filter((s) => s.id !== stageId),
    });
  }
}
