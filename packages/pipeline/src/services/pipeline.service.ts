/**
 * Pipeline 服务
 * 管理流水线的创建、更新、执行和监控
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Pipeline,
  PipelineExecution,
  PipelineStage,
  PipelineTriggerType,
} from '../models';
import { DAGEngine, type StageExecutor, type StageExecutionContext, type StageExecutionResult } from '../engine/dag-engine';

/**
 * Pipeline 服务接口
 */
export interface IPipelineService {
  /** 创建流水线 */
  create(name: string, stages?: PipelineStage[], options?: {
    description?: string;
    triggers?: Pipeline['triggers'];
    variables?: Pipeline['variables'];
    config?: Pipeline['config'];
  }): Promise<Pipeline>;
  /** 获取流水线 */
  get(id: string): Promise<Pipeline | null>;
  /** 列出所有流水线 */
  list(): Promise<Pipeline[]>;
  /** 更新流水线 */
  update(id: string, updates: Partial<Pipeline>): Promise<Pipeline | null>;
  /** 删除流水线 */
  delete(id: string): Promise<boolean>;
  /** 执行流水线 */
  execute(id: string, triggerType?: string): Promise<PipelineExecution>;
  /** 获取执行记录 */
  getExecution(id: string): Promise<PipelineExecution | null>;
  /** 获取执行历史 */
  getExecutionHistory(pipelineId: string): Promise<PipelineExecution[]>;
  /** 取消执行 */
  cancelExecution(executionId: string): Promise<boolean>;
  /** 验证流水线 */
  validate(pipeline: Pipeline): { valid: boolean; errors: string[] };
  /** 获取统计信息 */
  getStats(): { total: number; running: number; completed: number; failed: number };
}

/**
 * Pipeline 存储接口
 */
export interface IPipelineRepository {
  save(pipeline: Pipeline): Promise<void>;
  findById(id: string): Promise<Pipeline | null>;
  findAll(): Promise<Pipeline[]>;
  delete(id: string): Promise<boolean>;
  saveExecution(execution: PipelineExecution): Promise<void>;
  findExecutionById(id: string): Promise<PipelineExecution | null>;
  findExecutionsByPipelineId(pipelineId: string): Promise<PipelineExecution[]>;
}

/**
 * Pipeline 服务配置
 */
export interface PipelineServiceOptions {
  maxConcurrency?: number;
  stageTimeout?: number;
}

/**
 * 默认阶段执行器
 * 提供默认的阶段执行逻辑
 */
export class DefaultStageExecutor implements StageExecutor {
  async execute(
    stage: PipelineStage,
    _context: StageExecutionContext
  ): Promise<StageExecutionResult> {
    const startTime = Date.now();

    try {
      // 如果有命令，执行命令
      if (stage.command) {
        const result = await this.executeCommand(stage.command, {
          cwd: stage.workingDir,
          env: stage.env,
        });

        if (!result.success) {
          return {
            success: false,
            error: {
              code: 'COMMAND_FAILED',
              message: `命令执行失败: ${stage.command}`,
            },
            duration: Date.now() - startTime,
          };
        }

        return {
          success: true,
          output: {
            stdout: result.stdout || '',
            stderr: result.stderr || '',
            exitCode: result.exitCode,
          },
          duration: Date.now() - startTime,
        };
      }

      // 如果有工作目录配置但没有命令
      if (stage.workingDir) {
        return {
          success: true,
          output: {
            message: `阶段 ${stage.name} 已配置工作目录: ${stage.workingDir}`,
          },
          duration: Date.now() - startTime,
        };
      }

      // 默认成功
      return {
        success: true,
        output: {
          message: `阶段 ${stage.name} 执行完成`,
        },
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : '未知错误',
        },
        duration: Date.now() - startTime,
      };
    }
  }

  private async executeCommand(
    command: string,
    options: { cwd?: string; env?: Record<string, string> }
  ): Promise<{ success: boolean; stdout?: string; stderr?: string; exitCode?: number; error?: string }> {
    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      const child = spawn(command, [], {
        shell: true,
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code: number) => {
        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code ?? undefined,
        });
      });

      child.on('error', (err: Error) => {
        resolve({
          success: false,
          error: err.message,
        });
      });
    });
  }
}

/**
 * Pipeline 服务实现
 */
export class PipelineService implements IPipelineService {
  private readonly repository: IPipelineRepository;
  private readonly stageExecutor: StageExecutor;
  private readonly options: Required<PipelineServiceOptions>;
  private readonly engines = new Map<string, DAGEngine>();
  private stats = { total: 0, running: 0, completed: 0, failed: 0 };

  constructor(
    repository: IPipelineRepository,
    stageExecutor?: StageExecutor,
    options?: PipelineServiceOptions
  ) {
    this.repository = repository;
    this.stageExecutor = stageExecutor || new DefaultStageExecutor();
    this.options = {
      maxConcurrency: options?.maxConcurrency ?? 4,
      stageTimeout: options?.stageTimeout ?? 300000,
    };
  }

  /**
   * 创建流水线
   */
  async create(
    name: string,
    stages: PipelineStage[],
    options?: {
      description?: string;
      triggers?: Pipeline['triggers'];
      variables?: Pipeline['variables'];
      config?: Pipeline['config'];
    }
  ): Promise<Pipeline> {
    const id = uuidv4();
    const now = Date.now();
    
    const pipeline: Pipeline = {
      meta: {
        id,
        name,
        description: options?.description,
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
      stages: stages || [],
      triggers: options?.triggers,
      variables: options?.variables,
      config: options?.config,
    };

    await this.repository.save(pipeline);
    this.stats.total++;
    return pipeline;
  }

  /**
   * 获取流水线
   */
  async get(id: string): Promise<Pipeline | null> {
    return this.repository.findById(id);
  }

  /**
   * 列出所有流水线
   */
  async list(): Promise<Pipeline[]> {
    return this.repository.findAll();
  }

  /**
   * 更新流水线
   */
  async update(id: string, updates: Partial<Pipeline>): Promise<Pipeline | null> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      return null;
    }

    const updated: Pipeline = {
      ...existing,
      meta: {
        ...existing.meta,
        ...updates.meta,
        updatedAt: Date.now(),
      },
      stages: updates.stages ?? existing.stages,
      triggers: updates.triggers ?? existing.triggers,
      variables: updates.variables ?? existing.variables,
      config: updates.config ?? existing.config,
    };

    await this.repository.save(updated);
    return updated;
  }

  /**
   * 删除流水线
   */
  async delete(id: string): Promise<boolean> {
    const deleted = await this.repository.delete(id);
    if (deleted) {
      this.stats.total = Math.max(0, this.stats.total - 1);
    }
    return deleted;
  }

  /**
   * 执行流水线
   */
  async execute(id: string, triggerType?: string): Promise<PipelineExecution> {
    const pipeline = await this.repository.findById(id);
    if (!pipeline) {
      throw new Error(`流水线不存在: ${id}`);
    }

    const executionId = uuidv4();
    const trigger = (triggerType || 'manual') as PipelineTriggerType;

    // 创建执行记录
    const execution: PipelineExecution = {
      id: executionId,
      pipelineId: id,
      triggerType: trigger,
      status: 'pending',
      createdAt: Date.now(),
      nodeResults: new Map(),
      stageExecutions: {},
    };

    // 初始化所有节点状态
    for (const stage of pipeline.stages) {
      execution.stageExecutions![stage.id] = 'pending';
    }

    await this.repository.saveExecution(execution);
    this.stats.running++;

    // 异步执行（不阻塞）
    this.runExecution(executionId, pipeline).catch(() => {
      // 错误已在 runExecution 中处理
    });

    return execution;
  }

  /**
   * 运行执行
   */
  private async runExecution(executionId: string, pipeline: Pipeline): Promise<void> {
    const engine = new DAGEngine({
      maxConcurrency: this.options.maxConcurrency,
      stageTimeout: this.options.stageTimeout,
    });
    engine.setExecutor(this.stageExecutor);
    this.engines.set(executionId, engine);

    // 监听事件更新执行状态
    engine.on('stageStart', ({ stageId }) => {
      this.updateStageStatus(executionId, stageId, 'running');
    });

    engine.on('stageComplete', ({ stageId }) => {
      this.updateStageStatus(executionId, stageId, 'completed');
    });

    engine.on('stageFailed', ({ stageId }) => {
      this.updateStageStatus(executionId, stageId, 'failed');
    });

    try {
      const result = await engine.execute(pipeline.stages);

      // 更新执行状态
      const execution = await this.repository.findExecutionById(executionId);
      if (execution) {
        execution.status = result.success ? 'completed' : 'failed';
        execution.endedAt = Date.now();
        execution.duration = result.totalDuration;

        if (!result.success) {
          execution.error = `流水线执行失败，失败阶段: ${result.failedStages.join(', ')}`;
        }

        await this.repository.saveExecution(execution);
        
        // 更新统计
        this.stats.running--;
        if (result.success) {
          this.stats.completed++;
        } else {
          this.stats.failed++;
        }
      }
    } catch (err) {
      const execution = await this.repository.findExecutionById(executionId);
      if (execution) {
        execution.status = 'failed';
        execution.endedAt = Date.now();
        execution.error = err instanceof Error ? err.message : '执行错误';
        await this.repository.saveExecution(execution);
        
        this.stats.running--;
        this.stats.failed++;
      }
    } finally {
      this.engines.delete(executionId);
    }
  }

  /**
   * 更新节点状态
   */
  private async updateStageStatus(
    executionId: string,
    stageId: string,
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'
  ): Promise<void> {
    const execution = await this.repository.findExecutionById(executionId);
    if (execution) {
      if (!execution.stageExecutions) {
        execution.stageExecutions = {};
      }
      execution.stageExecutions[stageId] = status;
      if (status === 'running' && !execution.startedAt) {
        execution.startedAt = Date.now();
      }
      await this.repository.saveExecution(execution);
    }
  }

  /**
   * 获取执行记录
   */
  async getExecution(id: string): Promise<PipelineExecution | null> {
    return this.repository.findExecutionById(id);
  }

  /**
   * 获取执行历史
   */
  async getExecutionHistory(pipelineId: string): Promise<PipelineExecution[]> {
    return this.repository.findExecutionsByPipelineId(pipelineId);
  }

  /**
   * 取消执行
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const engine = this.engines.get(executionId);
    if (engine) {
      // 停止执行
      this.engines.delete(executionId);
    }

    const execution = await this.repository.findExecutionById(executionId);
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      execution.endedAt = Date.now();
      await this.repository.saveExecution(execution);
      
      this.stats.running--;
      return true;
    }

    return false;
  }

  /**
   * 验证流水线
   */
  validate(pipeline: Pipeline): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查节点 ID 唯一性
    const stageIds = new Set<string>();
    for (const stage of pipeline.stages) {
      if (stageIds.has(stage.id)) {
        errors.push(`节点 ID 重复: ${stage.id}`);
      }
      stageIds.add(stage.id);

      // 检查依赖是否存在
      if (stage.dependencies) {
        for (const depId of stage.dependencies) {
          if (!pipeline.stages.some((s) => s.id === depId)) {
            errors.push(`节点 ${stage.id} 的依赖 ${depId} 不存在`);
          }
        }
      }
    }

    // 检查循环依赖
    const hasCircular = this.checkCircularDependency(pipeline.stages);
    if (hasCircular) {
      errors.push('存在循环依赖');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 检查循环依赖
   */
  private checkCircularDependency(stages: PipelineStage[]): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (stageId: string): boolean => {
      visited.add(stageId);
      recursionStack.add(stageId);

      const stage = stages.find((s) => s.id === stageId);
      if (stage?.dependencies) {
        for (const depId of stage.dependencies) {
          if (!visited.has(depId)) {
            if (dfs(depId)) {
              return true;
            }
          } else if (recursionStack.has(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(stageId);
      return false;
    };

    for (const stage of stages) {
      if (!visited.has(stage.id)) {
        if (dfs(stage.id)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 获取统计信息
   */
  getStats(): { total: number; running: number; completed: number; failed: number } {
    return { ...this.stats };
  }

  /**
   * 获取执行引擎状态
   */
  getEngineStatus(executionId: string): { total: number; completed: number; running: number; failed: number } | null {
    const engine = this.engines.get(executionId);
    return engine ? engine.getStatusSummary() : null;
  }
}
