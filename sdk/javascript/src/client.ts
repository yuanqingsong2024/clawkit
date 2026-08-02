/**
 * ClawKit 客户端主类
 * 统一管理所有服务，提供简洁的 API 接口
 */

import { HttpClient } from './utils/http';
import { TaskService } from './services/task.service';
import { PipelineService } from './services/pipeline.service';
import { WorkerService } from './services/worker.service';
import { SystemService } from './services/system.service';
import { PluginService } from './services/plugin.service';
import type { ClawKitClientOptions } from './types';

/**
 * ClawKit 客户端
 * 
 * @example
 * ```typescript
 * import { ClawKit } from '@clawkit/sdk';
 * 
 * const client = new ClawKit({
 *   baseUrl: 'http://localhost:8787',
 *   apiKey: 'your-api-key'
 * });
 * 
 * // 创建任务
 * const task = await client.tasks.create({
 *   text: '优化数据库查询性能'
 * });
 * 
 * // 执行流水线
 * const execution = await client.pipelines.execute('pipeline-id');
 * ```
 */
export class ClawKit {
  /**
   * HTTP 客户端实例
   */
  readonly http: HttpClient;

  /**
   * 任务服务
   */
  readonly tasks: TaskService;

  /**
   * 流水线服务
   */
  readonly pipelines: PipelineService;

  /**
   * Worker 服务
   */
  readonly workers: WorkerService;

  /**
   * 系统服务
   */
  readonly system: SystemService;

  /**
   * 插件服务
   */
  readonly plugins: PluginService;

  /**
   * 构造函数
   */
  constructor(options: ClawKitClientOptions) {
    // 验证必填参数
    if (!options.baseUrl) {
      throw new Error('baseUrl is required');
    }

    // 初始化 HTTP 客户端
    this.http = new HttpClient(options);

    // 初始化各服务
    this.tasks = new TaskService(this.http);
    this.pipelines = new PipelineService(this.http);
    this.workers = new WorkerService(this.http);
    this.system = new SystemService(this.http);
    this.plugins = new PluginService(this.http);
  }

  /**
   * 获取基础 URL
   */
  getBaseUrl(): string {
    return this.http.getBaseUrl();
  }

  /**
   * 关闭客户端（释放资源）
   */
  async close(): Promise<void> {
    // axios 没有需要关闭的连接，但保留此方法以备将来扩展
  }
}

/**
 * 从环境变量创建客户端
 * 
 * @example
 * ```typescript
 * const client = ClawKit.fromEnv();
 * // 自动读取 CLAWKIT_BASE_URL 和 CLAWKIT_API_KEY 环境变量
 * ```
 */
export function fromEnv(): ClawKit {
  const baseUrl = process.env.CLAWKIT_BASE_URL || process.env.CLAWKIT_URL;
  const apiKey = process.env.CLAWKIT_API_KEY;

  if (!baseUrl) {
    throw new Error('CLAWKIT_BASE_URL or CLAWKIT_URL environment variable is required');
  }

  return new ClawKit({
    baseUrl,
    apiKey: apiKey || undefined,
  });
}

// 导出类型
export * from './types';

// 导出服务
export { TaskService } from './services/task.service';
export { PipelineService } from './services/pipeline.service';
export { WorkerService } from './services/worker.service';
export { SystemService } from './services/system.service';
export { PluginService } from './services/plugin.service';

// 导出工具
export { HttpClient } from './utils/http';
