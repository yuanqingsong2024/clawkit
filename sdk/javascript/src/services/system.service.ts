/**
 * 系统服务
 * 提供系统信息、健康检查、指标等管理
 */

import { HttpClient } from '../utils/http';
import { HealthStatus, SystemInfo, MetricSeries } from '../types';

/**
 * 系统服务类
 */
export class SystemService {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * 健康检查
   */
  async health(): Promise<HealthStatus> {
    return this.http.get<HealthStatus>('/api/health');
  }

  /**
   * 获取系统信息
   */
  async info(): Promise<SystemInfo> {
    return this.http.get<SystemInfo>('/api/system/info');
  }

  /**
   * 获取指标数据
   */
  async metrics(options?: {
    name?: string;
    start?: Date;
    end?: Date;
  }): Promise<MetricSeries[]> {
    const params: Record<string, unknown> = {};
    
    if (options?.name) params.name = options.name;
    if (options?.start) params.start = options.start.toISOString();
    if (options?.end) params.end = options.end.toISOString();

    const response = await this.http.get<{ metrics: MetricSeries[] }>('/api/metrics', params);
    return response.metrics || [];
  }

  /**
   * 获取任务指标
   */
  async taskMetrics(): Promise<MetricSeries[]> {
    return this.metrics({ name: 'tasks' });
  }

  /**
   * 获取 Worker 指标
   */
  async workerMetrics(): Promise<MetricSeries[]> {
    return this.metrics({ name: 'workers' });
  }

  /**
   * 获取系统资源指标
   */
  async systemMetrics(): Promise<MetricSeries[]> {
    return this.metrics({ name: 'system' });
  }

  /**
   * 检查服务是否就绪
   */
  async isReady(): Promise<boolean> {
    try {
      const health = await this.health();
      return health.success === true;
    } catch {
      return false;
    }
  }

  /**
   * 获取服务版本
   */
  async getVersion(): Promise<string> {
    const info = await this.info();
    return info.version;
  }

  /**
   * 获取 OpenAPI 规范文档
   */
  async getOpenApiSpec(): Promise<unknown> {
    return this.http.get('/openapi.json');
  }
}
