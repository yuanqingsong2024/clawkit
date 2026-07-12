/**
 * Setup Orchestrator 服务
 * 
 * 编排 Setup 向导的整体流程
 */
import type { SetupManifestService } from './setup-manifest-service';
import type { SetupRunService } from './setup-run-service';
import type { WebConsoleService } from './web-console-service';
import type { WorkerRegistry } from '../../services/worker-registry';

export interface SetupContext {
  config: Record<string, unknown>;
  status: 'initialized' | 'running' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

export class SetupOrchestrator {
  private manifestService: SetupManifestService;
  private runService: SetupRunService;
  private webConsoleService: WebConsoleService;
  private workerRegistry: WorkerRegistry;
  private context: SetupContext | null = null;

  constructor(
    manifestService: SetupManifestService,
    runService: SetupRunService,
    webConsoleService: WebConsoleService,
    workerRegistry: WorkerRegistry,
  ) {
    this.manifestService = manifestService;
    this.runService = runService;
    this.webConsoleService = webConsoleService;
    this.workerRegistry = workerRegistry;
  }

  /**
   * 开始 Setup 流程
   */
  async startSetup(config: Record<string, unknown>): Promise<SetupContext> {
    this.context = {
      config,
      status: 'initialized',
      progress: 0,
    };

    try {
      // 1. 生成/验证 manifest
      this.context.status = 'running';
      this.context.progress = 10;

      const validatedConfig = await this.manifestService.validateConfig(config);
      if (!validatedConfig.valid) {
        throw new Error(`配置验证失败：${validatedConfig.errors?.join(', ')}`);
      }

      // 2. 执行 Setup
      this.context.progress = 20;
      const result = await this.runService.runSetup(config);

      if (!result.success) {
        throw new Error(result.error || 'Setup 执行失败');
      }

      // 3. 完成
      this.context.status = 'completed';
      this.context.progress = 100;

      return this.context;
    } catch (error) {
      this.context.status = 'failed';
      this.context.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  /**
   * 获取当前 Setup 状态
   */
  getStatus(): SetupContext | null {
    return this.context;
  }

  /**
   * 取消 Setup
   */
  async cancelSetup(): Promise<void> {
    if (this.context && this.context.status === 'running') {
      this.context.status = 'failed';
      this.context.error = '用户取消';
    }
  }

  /**
   * 重置 Setup 状态
   */
  reset(): void {
    this.context = null;
  }
}

export default SetupOrchestrator;
