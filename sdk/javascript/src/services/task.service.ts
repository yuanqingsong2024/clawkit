/**
 * 任务服务
 * 提供任务管理的 CRUD 操作
 */

import { HttpClient } from '../utils/http';
import {
  Task,
  TaskStatus,
  CreateTaskOptions,
  ListTasksOptions,
  ApproveTaskOptions,
  RejectTaskOptions,
  PaginatedResponse,
  NotFoundError,
} from '../types';

/**
 * 任务服务类
 */
export class TaskService {
  private readonly http: HttpClient;
  private readonly resource = 'tasks';

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * 创建任务
   */
  async create(options: CreateTaskOptions): Promise<Task> {
    return this.http.post<Task>(`/api/${this.resource}`, {
      text: options.text,
      projectKey: options.projectKey,
      priority: options.priority,
      prompt: options.prompt,
    });
  }

  /**
   * 获取任务列表
   */
  async list(options?: ListTasksOptions): Promise<PaginatedResponse<Task>> {
    const params: Record<string, unknown> = {};
    
    if (options?.page) params.page = options.page;
    if (options?.pageSize) params.pageSize = options.pageSize;
    if (options?.status) params.status = options.status;
    if (options?.projectKey) params.projectKey = options.projectKey;
    if (options?.priority) params.priority = options.priority;

    return this.http.get<PaginatedResponse<Task>>(`/api/${this.resource}`, params);
  }

  /**
   * 获取任务详情
   */
  async get(taskId: string): Promise<Task> {
    try {
      return await this.http.get<Task>(`/api/${this.resource}/${taskId}`);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && (error as { statusCode: number }).statusCode === 404) {
        throw new NotFoundError('Task', taskId);
      }
      throw error;
    }
  }

  /**
   * 获取任务状态
   */
  async getStatus(taskId: string): Promise<{ status: TaskStatus }> {
    try {
      return await this.http.get<{ status: TaskStatus }>(`/api/${this.resource}/${taskId}/status`);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && (error as { statusCode: number }).statusCode === 404) {
        throw new NotFoundError('Task', taskId);
      }
      throw error;
    }
  }

  /**
   * 审批任务
   */
  async approve(taskId: string, options?: ApproveTaskOptions): Promise<Task> {
    return this.http.post<Task>(`/api/${this.resource}/${taskId}/approve`, {
      comment: options?.comment,
    });
  }

  /**
   * 拒绝任务
   */
  async reject(taskId: string, options: RejectTaskOptions): Promise<Task> {
    return this.http.post<Task>(`/api/${this.resource}/${taskId}/reject`, {
      reason: options.reason,
    });
  }

  /**
   * 取消任务
   */
  async cancel(taskId: string): Promise<Task> {
    return this.http.post<Task>(`/api/${this.resource}/${taskId}/cancel`);
  }

  /**
   * 删除任务
   */
  async delete(taskId: string): Promise<void> {
    try {
      await this.http.delete(`/api/${this.resource}/${taskId}`);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && (error as { statusCode: number }).statusCode === 404) {
        throw new NotFoundError('Task', taskId);
      }
      throw error;
    }
  }

  /**
   * 重新执行任务
   */
  async retry(taskId: string): Promise<Task> {
    return this.http.post<Task>(`/api/${this.resource}/${taskId}/retry`);
  }

  /**
   * 获取任务结果
   */
  async getResult(taskId: string): Promise<Task['result']> {
    const task = await this.get(taskId);
    return task.result;
  }
}
