/**
 * Worker 服务
 * 提供 Worker 节点管理
 */

import { HttpClient } from '../utils/http';
import { Worker, WorkerStatus } from '../types';

/**
 * Worker 服务类
 */
export class WorkerService {
  private readonly http: HttpClient;
  private readonly resource = 'workers';

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * 获取 Worker 列表
   */
  async list(): Promise<Worker[]> {
    const response = await this.http.get<{ workers: Worker[] }>(`/api/${this.resource}`);
    return response.workers || [];
  }

  /**
   * 获取 Worker 详情
   */
  async get(workerId: string): Promise<Worker> {
    return this.http.get<Worker>(`/api/${this.resource}/${workerId}`);
  }

  /**
   * 获取在线 Worker
   */
  async getOnline(): Promise<Worker[]> {
    const workers = await this.list();
    return workers.filter((w) => w.status === WorkerStatus.ONLINE);
  }

  /**
   * 获取可用 Worker（在线且负载未满）
   */
  async getAvailable(): Promise<Worker[]> {
    const workers = await this.list();
    return workers.filter(
      (w) => w.status === WorkerStatus.ONLINE && w.currentLoad < w.maxLoad
    );
  }

  /**
   * 获取指定项目的 Worker
   */
  async getByProject(projectKey: string): Promise<Worker[]> {
    const workers = await this.list();
    return workers.filter(
      (w) =>
        w.status === WorkerStatus.ONLINE &&
        (w.supportedProjects.includes(projectKey) || w.supportedProjects.includes('*'))
    );
  }

  /**
   * 获取 Worker 状态统计
   */
  async getStats(): Promise<{
    total: number;
    online: number;
    offline: number;
    busy: number;
  }> {
    const workers = await this.list();
    return {
      total: workers.length,
      online: workers.filter((w) => w.status === WorkerStatus.ONLINE).length,
      offline: workers.filter((w) => w.status === WorkerStatus.OFFLINE).length,
      busy: workers.filter((w) => w.status === WorkerStatus.BUSY).length,
    };
  }
}
