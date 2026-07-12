/**
 * Setup Run 服务
 * 
 * 处理 Setup 向导的执行流程
 */
import type { SetupStreamService, StreamEvent } from './setup-stream-service';
import type { SqliteTaskStore } from '../../persistence/sqlite-task-store';

export interface SetupStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

export class SetupRunService {
  private streamService: SetupStreamService;
  private taskStore: SqliteTaskStore | null;
  private currentStep: SetupStep | null = null;

  constructor(streamService: SetupStreamService, taskStore: SqliteTaskStore | null) {
    this.streamService = streamService;
    this.taskStore = taskStore;
  }

  /**
   * 执行 Setup 流程
   */
  async runSetup(config: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
    const steps = this.getSetupSteps(config);

    for (const step of steps) {
      this.currentStep = step;
      this.emitProgress(step);

      try {
        await this.executeStep(step);
        step.status = 'completed';
        step.progress = 100;
      } catch (error) {
        step.status = 'failed';
        step.error = error instanceof Error ? error.message : 'Unknown error';
        this.emitProgress(step);
        return { success: false, error: step.error };
      }

      this.emitProgress(step);
    }

    return { success: true };
  }

  /**
   * 获取 Setup 步骤列表
   */
  private getSetupSteps(config: Record<string, unknown>): SetupStep[] {
    return [
      { id: 'validate', name: '验证配置', status: 'pending' },
      { id: 'prepare', name: '准备环境', status: 'pending' },
      { id: 'install', name: '安装组件', status: 'pending' },
      { id: 'configure', name: '配置服务', status: 'pending' },
      { id: 'start', name: '启动服务', status: 'pending' },
      { id: 'verify', name: '验证运行', status: 'pending' },
    ];
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(step: SetupStep): Promise<void> {
    switch (step.id) {
      case 'validate':
        await this.validateConfig(step);
        break;
      case 'prepare':
        await this.prepareEnvironment(step);
        break;
      case 'install':
        await this.installComponents(step);
        break;
      case 'configure':
        await this.configureServices(step);
        break;
      case 'start':
        await this.startServices(step);
        break;
      case 'verify':
        await this.verifySetup(step);
        break;
    }
  }

  private async validateConfig(step: SetupStep): Promise<void> {
    step.progress = 50;
    this.emitProgress(step);
    await this.delay(100);
  }

  private async prepareEnvironment(step: SetupStep): Promise<void> {
    step.progress = 50;
    this.emitProgress(step);
    await this.delay(100);
  }

  private async installComponents(step: SetupStep): Promise<void> {
    step.progress = 50;
    this.emitProgress(step);
    await this.delay(100);
  }

  private async configureServices(step: SetupStep): Promise<void> {
    step.progress = 50;
    this.emitProgress(step);
    await this.delay(100);
  }

  private async startServices(step: SetupStep): Promise<void> {
    step.progress = 50;
    this.emitProgress(step);
    await this.delay(100);
  }

  private async verifySetup(step: SetupStep): Promise<void> {
    step.progress = 50;
    this.emitProgress(step);
    await this.delay(100);
  }

  /**
   * 发送进度更新
   */
  private emitProgress(step: SetupStep): void {
    const event: StreamEvent = {
      type: 'setup-progress',
      data: step,
      timestamp: Date.now(),
    };
    this.streamService.broadcastEvent(event);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default SetupRunService;
