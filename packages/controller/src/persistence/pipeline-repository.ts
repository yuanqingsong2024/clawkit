/**
 * Pipeline 持久化存储
 * 使用 JSON 文件存储流水线数据
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Pipeline, PipelineExecution } from '@clawkit/pipeline';

export interface PipelineRepositoryOptions {
  dataDir?: string;
}

/**
 * 基于文件系统的 Pipeline 存储
 */
export class FilePipelineRepository {
  private readonly pipelinesFile: string;
  private readonly executionsFile: string;
  private pipelines: Map<string, Pipeline> = new Map();
  private executions: Map<string, PipelineExecution> = new Map();
  private pipelineExecutions: Map<string, string[]> = new Map();

  constructor(options: PipelineRepositoryOptions = {}) {
    const dataDir = options.dataDir || './data';
    
    // 确保目录存在
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.pipelinesFile = path.join(dataDir, 'pipelines.json');
    this.executionsFile = path.join(dataDir, 'pipeline-executions.json');
    
    this.load();
  }

  /**
   * 加载数据
   */
  private load(): void {
    // 加载流水线
    try {
      if (fs.existsSync(this.pipelinesFile)) {
        const data = JSON.parse(fs.readFileSync(this.pipelinesFile, 'utf-8'));
        for (const pipeline of data) {
          this.pipelines.set(pipeline.meta.id, pipeline);
        }
      }
    } catch (error) {
      console.error('加载流水线数据失败:', error);
    }

    // 加载执行记录
    try {
      if (fs.existsSync(this.executionsFile)) {
        const data = JSON.parse(fs.readFileSync(this.executionsFile, 'utf-8'));
        for (const execution of data.executions || []) {
          this.executions.set(execution.id, execution);
        }
        for (const [pipelineId, executionIds] of Object.entries(data.pipelineExecutions || {})) {
          this.pipelineExecutions.set(pipelineId, executionIds as string[]);
        }
      }
    } catch (error) {
      console.error('加载执行记录失败:', error);
    }
  }

  /**
   * 保存数据
   */
  private persist(): void {
    // 保存流水线
    const pipelinesData = Array.from(this.pipelines.values());
    fs.writeFileSync(this.pipelinesFile, JSON.stringify(pipelinesData, null, 2));

    // 保存执行记录
    const executionsData = {
      executions: Array.from(this.executions.values()),
      pipelineExecutions: Object.fromEntries(this.pipelineExecutions),
    };
    fs.writeFileSync(this.executionsFile, JSON.stringify(executionsData, null, 2));
  }

  /**
   * 保存流水线
   */
  async save(pipeline: Pipeline): Promise<void> {
    this.pipelines.set(pipeline.meta.id, pipeline);
    this.persist();
  }

  /**
   * 根据 ID 查询流水线
   */
  async findById(id: string): Promise<Pipeline | null> {
    return this.pipelines.get(id) || null;
  }

  /**
   * 查询所有流水线
   */
  async findAll(): Promise<Pipeline[]> {
    return Array.from(this.pipelines.values());
  }

  /**
   * 删除流水线
   */
  async delete(id: string): Promise<boolean> {
    const deleted = this.pipelines.delete(id);
    if (deleted) {
      this.persist();
    }
    return deleted;
  }

  /**
   * 保存执行记录
   */
  async saveExecution(execution: PipelineExecution): Promise<void> {
    this.executions.set(execution.id, execution);
    
    // 更新流水线执行索引
    const ids = this.pipelineExecutions.get(execution.pipelineId) || [];
    if (!ids.includes(execution.id)) {
      ids.push(execution.id);
      this.pipelineExecutions.set(execution.pipelineId, ids);
    }
    
    this.persist();
  }

  /**
   * 根据 ID 查询执行记录
   */
  async findExecutionById(id: string): Promise<PipelineExecution | null> {
    return this.executions.get(id) || null;
  }

  /**
   * 根据流水线 ID 查询执行历史
   */
  async findExecutionsByPipelineId(pipelineId: string): Promise<PipelineExecution[]> {
    const ids = this.pipelineExecutions.get(pipelineId) || [];
    return ids
      .map(id => this.executions.get(id))
      .filter((e): e is PipelineExecution => e !== undefined)
      .sort((a, b) => {
        const aTime = a.startedAt ?? a.createdAt;
        const bTime = b.startedAt ?? b.createdAt;
        return bTime - aTime;
      });
  }
}
