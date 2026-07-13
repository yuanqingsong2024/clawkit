/**
 * Pipeline 服务 (Controller 层)
 * 封装 @clawkit/pipeline 包的服务，供 Controller 层使用
 */

import { PipelineService as CorePipelineService } from '@clawkit/pipeline';
import { FilePipelineRepository } from '../persistence/pipeline-repository';
import type { Pipeline, PipelineStage, PipelineExecution } from '@clawkit/pipeline';

/**
 * Controller 层 Pipeline 服务
 * 包装 core 包的服务，添加 Controller 层特定的逻辑
 */
export class PipelineService {
  private readonly coreService: CorePipelineService;
  private readonly repository: FilePipelineRepository;

  constructor() {
    // 初始化存储
    this.repository = new FilePipelineRepository();
    
    // 初始化 core 包的服务
    this.coreService = new CorePipelineService(this.repository);
  }

  /**
   * 创建流水线
   */
  async create(
    name: string,
    stages: PipelineStage[] = [],
    options?: { description?: string }
  ): Promise<Pipeline> {
    return this.coreService.create(name, stages, { description: options?.description });
  }

  /**
   * 获取流水线
   */
  async get(id: string): Promise<Pipeline | null> {
    return this.coreService.get(id);
  }

  /**
   * 列出所有流水线
   */
  async list(): Promise<Pipeline[]> {
    return this.coreService.list();
  }

  /**
   * 更新流水线
   */
  async update(
    id: string, 
    updates: { name?: string; stages?: PipelineStage[]; description?: string }
  ): Promise<Pipeline | null> {
    return this.coreService.update(id, {
      meta: updates.name ? { name: updates.name } : undefined,
      stages: updates.stages,
      ...(updates.description !== undefined && { meta: { description: updates.description } }),
    } as Partial<Pipeline>);
  }

  /**
   * 删除流水线
   */
  async delete(id: string): Promise<boolean> {
    return this.coreService.delete(id);
  }

  /**
   * 验证流水线
   */
  validate(pipeline: Pipeline): { valid: boolean; errors: string[] } {
    return this.coreService.validate(pipeline);
  }

  /**
   * 执行流水线
   */
  async execute(id: string, triggerType?: string): Promise<PipelineExecution> {
    return this.coreService.execute(id, triggerType);
  }

  /**
   * 获取执行历史
   */
  async getExecutionHistory(pipelineId: string): Promise<PipelineExecution[]> {
    return this.coreService.getExecutionHistory(pipelineId);
  }

  /**
   * 获取执行详情
   */
  async getExecution(executionId: string): Promise<PipelineExecution | null> {
    return this.coreService.getExecution(executionId);
  }

  /**
   * 取消执行
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    return this.coreService.cancelExecution(executionId);
  }

  /**
   * 获取统计信息
   */
  getStats(): { total: number; running: number; completed: number; failed: number } {
    return this.coreService.getStats();
  }
}
