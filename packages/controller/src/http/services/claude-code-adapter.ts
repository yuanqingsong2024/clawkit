/**
 * Claude Code 适配器
 * 
 * 提供与 Claude Code 的集成能力
 */
import { ControllerApiService } from './controller-api-service';

export interface ClaudeCodeAdapterConfig {
  enabled?: boolean;
  serverUrl?: string;
}

export interface TaskDraft {
  id: string;
  projectKey: string;
  prompt: string;
  metadata?: Record<string, unknown>;
}

export interface TaskRequest {
  id: string;
  projectKey: string;
  prompt: string;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  metadata?: Record<string, unknown>;
}

export interface TaskResult {
  id: string;
  status: 'success' | 'failed' | 'cancelled';
  output?: string;
  error?: string;
  duration?: number;
}

/**
 * Claude Code 适配器类
 * 
 * 提供与 Claude Code 的集成能力
 */
export class ClaudeCodeAdapter {
  private apiService: ControllerApiService;
  private config: ClaudeCodeAdapterConfig;

  constructor(apiService: ControllerApiService, config: ClaudeCodeAdapterConfig = {}) {
    this.apiService = apiService;
    this.config = {
      enabled: config.enabled ?? true,
      serverUrl: config.serverUrl,
    };
  }

  /**
   * 格式化草稿
   */
  draftFormatter(draft: TaskDraft): TaskDraft {
    return draft;
  }

  /**
   * 格式化结果
   */
  resultFormatter(result: TaskResult): TaskResult {
    return result;
  }

  /**
   * 处理 webhook 请求
   */
  async handleWebhook(payload: unknown): Promise<TaskRequest | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const taskRequest: TaskRequest = {
      id: `claude-${Date.now()}`,
      projectKey: 'default',
      prompt: JSON.stringify(payload),
    };

    return taskRequest;
  }

  /**
   * 转换为任务请求
   */
  toTaskRequest(draft: TaskDraft): TaskRequest {
    return {
      id: draft.id,
      projectKey: draft.projectKey,
      prompt: draft.prompt,
      metadata: draft.metadata,
    };
  }

  /**
   * 获取任务结果
   */
  async getTaskResult(taskId: string): Promise<TaskResult | null> {
    return null;
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<boolean> {
    return false;
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: string): Promise<string | null> {
    return null;
  }

  /**
   * 检查适配器是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled ?? true;
  }

  /**
   * 获取配置
   */
  getConfig(): ClaudeCodeAdapterConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ClaudeCodeAdapterConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export default ClaudeCodeAdapter;
