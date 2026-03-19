import { WorkerStatus } from '@clawkit/shared';
import type { TaskExecutor } from '@clawkit/shared';

import type { WorkerConfig } from './config';
import { loadWorkerConfig } from './config';
import { OpenCodeExecutor } from './executors/open-code-executor';
import { HeartbeatService } from './services/heartbeat-service';
import { WorkerRegistrationService } from './services/registration-service';
import { ResultSubmitService } from './services/result-submit-service';
import { TaskPullService } from './services/task-pull-service';

export class Worker {
  private config: WorkerConfig;
  private registrationService: WorkerRegistrationService;
  private heartbeatService: HeartbeatService;
  private taskPullService: TaskPullService;
  private resultSubmitService: ResultSubmitService;
  private executor: TaskExecutor;

  private currentStatus: WorkerStatus = WorkerStatus.IDLE;
  private currentTaskId?: string;
  private pollIntervalId?: NodeJS.Timeout;

  constructor(config?: WorkerConfig, executor?: TaskExecutor) {
    this.config = config || loadWorkerConfig();
    this.registrationService = new WorkerRegistrationService(this.config);
    this.heartbeatService = new HeartbeatService(
      this.config,
      () => this.currentStatus,
      () => this.currentTaskId,
    );
    this.taskPullService = new TaskPullService(this.config);
    this.resultSubmitService = new ResultSubmitService(this.config);
    this.executor = executor ?? new OpenCodeExecutor(this.config);
  }

  async start(): Promise<void> {
    console.log(`Worker ${this.config.workerId} 启动中...`);

    try {
      const record = await this.registrationService.register();
      console.log(`Worker 注册成功: ${record.workerId} (${record.name})`);

      this.heartbeatService.start();

      this.startPolling();

      console.log(`Worker ${this.config.workerId} 已启动，开始轮询任务`);
    } catch (error) {
      console.error('Worker 启动失败:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    console.log(`Worker ${this.config.workerId} 停止中...`);
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = undefined;
    }

    this.heartbeatService.stop();
    console.log(`Worker ${this.config.workerId} 已停止`);
  }

  private startPolling(): void {
    this.pollIntervalId = setInterval(() => {
      if (this.currentStatus === WorkerStatus.IDLE) {
        this.pollAndExecute().catch((error) => {
          console.error('任务轮询执行失败:', error.message);
        });
      }
    }, this.config.pollIntervalMs);
  }

  private async pollAndExecute(): Promise<void> {
    try {
      const response = await this.taskPullService.pullTask();

      if (!response.hasTask || !response.task) {
        return;
      }

      const task = response.task;
      console.log(`拉取到任务: ${task.taskId}`);

      this.currentStatus = WorkerStatus.BUSY;
      this.currentTaskId = task.taskId;

      try {
        const result = await this.executor.execute({
          taskId: task.taskId,
          projectKey: task.projectKey,
          repoPath: task.repoPath,
          branchBase: task.branchBase,
          openCode: task.openCode,
          intent: task.intent,
          constraints: task.constraints,
          acceptanceCriteria: task.acceptanceCriteria,
          sourceText: task.sourceText,
          status: task.status,
          executionPrompt: task.executionPrompt,
          outputContract: task.outputContract,
          executionBoundary: task.executionBoundary,
        });

        await this.resultSubmitService.submitResult({
          taskId: result.taskId,
          status: result.status,
          workerId: result.workerId,
          projectKey: result.projectKey,
          summary: result.summary,
          placeholderExecution: result.placeholderExecution,
          logs: result.logs,
          changedFiles: result.changedFiles,
          commands: result.commands,
          testResult: result.testResult,
          rawOutputSummary: result.rawOutputSummary,
          parseStatus: result.parseStatus,
          structuredError: result.structuredError,
          sessionId: result.sessionId,
          risks: result.risks,
          nextStageHint: result.nextStageHint,
          updatedAt: result.updatedAt,
        });

        console.log(`任务 ${task.taskId} 执行完成`);
      } catch (error) {
        console.error(`任务 ${task.taskId} 执行失败:`, error);

        await this.resultSubmitService.submitResult({
          taskId: task.taskId,
          status: 'failed',
          workerId: this.config.workerId,
          projectKey: task.projectKey,
          summary: `任务执行失败: ${error instanceof Error ? error.message : String(error)}`,
          placeholderExecution: false,
          logs: [`执行失败: ${error instanceof Error ? error.message : String(error)}`],
          changedFiles: [],
          commands: [],
          testResult: '未执行',
          rawOutputSummary: error instanceof Error ? error.message : String(error),
          parseStatus: 'parse_failed',
          updatedAt: new Date().toISOString(),
        });
      } finally {
        this.currentStatus = WorkerStatus.IDLE;
        this.currentTaskId = undefined;
      }
    } catch (error) {
      console.error('任务拉取失败:', error);
    }
  }
}

export default Worker;
