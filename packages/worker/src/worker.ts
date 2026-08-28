/**
 * Worker 主类
 * 负责任务拉取、执行和结果提交
 */

import { createLogger, WorkerStatus } from '@clawkit/shared';
import type { TaskExecutor } from '@clawkit/shared';

import type { WorkerConfig } from './config';
import { loadWorkerConfig } from './config';
import { ExecutorFactoryService, getExecutorFactoryService } from './services/executor-factory-service';
import { HeartbeatService } from './services/heartbeat-service';
import { WorkerRegistrationService } from './services/registration-service';
import { ResultSubmitService } from './services/result-submit-service';
import { TaskPullService } from './services/task-pull-service';
import { TaskStreamService } from './services/task-stream-service';
import { TaskCancellationService } from './services/task-cancellation-service';

export class Worker {
  private config: WorkerConfig;
  private logger = createLogger('Worker');
  private registrationService: WorkerRegistrationService;
  private heartbeatService: HeartbeatService;
  private taskPullService: TaskPullService;
  private resultSubmitService: ResultSubmitService;
  private taskStreamService: TaskStreamService;
  private taskCancellationService: TaskCancellationService;
  private executorFactoryService: ExecutorFactoryService;
  private executor: TaskExecutor;
  private fallbackExecutor: TaskExecutor;

  private runningTasks: Map<string, Promise<void>> = new Map();
  private pollIntervalId?: NodeJS.Timeout;
  private useSSE = true;

  constructor(config?: WorkerConfig) {
    this.config = config || loadWorkerConfig();
    
    // 初始化执行器工厂服务
    this.executorFactoryService = getExecutorFactoryService();
    this.executorFactoryService.initialize();

    this.registrationService = new WorkerRegistrationService(
      this.config,
      () => this.detectSupportedExecutors(),
    );
    this.heartbeatService = new HeartbeatService(
      this.config,
      () => this.getWorkerStatus(),
      () => this.getCurrentTaskId(),
      async () => {
        const record = await this.registrationService.register();
        this.logger.info(`Worker 自动重新注册成功: ${record.workerId} (${record.name})`);
      },
    );
    this.taskPullService = new TaskPullService(this.config);
    this.taskCancellationService = new TaskCancellationService(this.config);
    this.resultSubmitService = new ResultSubmitService(this.config);
    this.taskStreamService = new TaskStreamService(
      this.config,
      () => this.onTaskNotification(),
    );

    // 创建默认执行器（使用 OpenCode）
    this.executor = this.createDefaultExecutor();
    
    // 创建备用执行器（用于降级）
    this.fallbackExecutor = this.createFallbackExecutor();
  }

  /**
   * 创建默认执行器
   * 根据配置选择合适的执行器类型
   */
  private createDefaultExecutor(): TaskExecutor {
    const executorType = this.config.openCode.mode === 'cli' ? 'claude-code' : 'opencode';
    
    try {
      return this.executorFactoryService.createExecutor({
        type: executorType,
        config: {
          baseUrl: this.config.openCode.server.baseUrl,
          passwordEnv: this.config.openCode.server.passwordEnv,
          timeoutMs: this.config.openCode.timeoutMs,
        },
      });
    } catch (error) {
      this.logger.warn(`创建执行器 ${executorType} 失败: ${error}，使用备用执行器`);
      return this.fallbackExecutor;
    }
  }

  /**
   * 创建备用执行器
   * 用于当主执行器不可用时降级
   */
  private createFallbackExecutor(): TaskExecutor {
    try {
      return this.executorFactoryService.createExecutor({
        type: 'placeholder',
        config: {},
      });
    } catch {
      // 如果连备用执行器都创建失败，返回 placeholder
      const { PlaceholderExecutor } = require('../executors/placeholder-executor');
      return new PlaceholderExecutor(this.config.workerId);
    }
  }

  /**
   * 根据任务上下文选择执行器
   * 优先使用任务指定的执行器类型
   */
  private selectExecutor(task: any): TaskExecutor {
    const executorType = task.executorType || (this.config.openCode.mode === 'cli' ? 'claude-code' : 'opencode');
    const normalizedType = this.executorFactoryService.normalizeExecutorType(executorType);

    // 配置了执行器白名单时，避免任务静默调用未声明的本地 CLI。
    if ((this.config.executors?.length ?? 0) > 0 && !this.config.executors.some((type) => this.executorFactoryService.normalizeExecutorType(type) === normalizedType)) {
      this.logger.warn(`执行器 ${executorType} 不在 Worker 白名单中，使用备用执行器`);
      return this.fallbackExecutor;
    }

    try {
      const configuredPath = this.config.cliPaths[normalizedType];
      return this.executorFactoryService.createExecutor({
        type: normalizedType,
        config: {
          ...(task.executorConfig || {
            baseUrl: this.config.openCode.server.baseUrl,
            passwordEnv: this.config.openCode.server.passwordEnv,
            timeoutMs: this.config.openCode.timeoutMs,
          }),
          ...(configuredPath ? { binaryPath: configuredPath } : {}),
        },
      });
    } catch (error) {
      this.logger.warn(`创建执行器 ${executorType} 失败: ${error}，使用备用执行器`);
      return this.fallbackExecutor;
    }
  }

  private async detectSupportedExecutors(): Promise<string[]> {
    const cliTypes = new Set(['opencode-cli', 'claude-code', 'codex-cli']);
    const configuredTypes = (this.config.executors || [])
      .map((type) => this.executorFactoryService.normalizeExecutorType(type))
      .filter((type) => cliTypes.has(type));
    const supported: string[] = [];

    for (const type of configuredTypes) {
      try {
        const executor = this.executorFactoryService.createExecutor({
          type,
          config: {
            ...(this.config.cliPaths[type] ? { binaryPath: this.config.cliPaths[type] } : {}),
            timeoutMs: 5000,
          },
        });
        const healthy = executor.healthCheck ? await executor.healthCheck() : false;
        if (healthy) {
          supported.push(type);
        } else {
          this.logger.warn(`执行器 ${type} 未通过可用性检查`);
        }
      } catch (error) {
        this.logger.warn(`探测执行器 ${type} 失败：${error}`);
      }
    }

    return Array.from(new Set(supported));
  }

  private getWorkerStatus(): WorkerStatus {
    return this.runningTasks.size > 0 ? WorkerStatus.BUSY : WorkerStatus.IDLE;
  }

  private getCurrentTaskId(): string | undefined {
    const taskIds = Array.from(this.runningTasks.keys());
    return taskIds.length > 0 ? taskIds[0] : undefined;
  }

  async start(): Promise<void> {
    this.logger.info(`Worker ${this.config.workerId} 启动中...`);

    try {
      const record = await this.registrationService.register();
      this.logger.info(`Worker 注册成功: ${record.workerId} (${record.name})`);

      this.heartbeatService.start();

      try {
        this.taskStreamService.start();
        // SSE 只负责低延迟通知，保留低频轮询作为断线和事件丢失兜底
        this.startPolling();
        this.logger.info(`Worker ${this.config.workerId} 已启动，使用 SSE 接收任务通知`);
      } catch (error) {
        this.logger.warn(`SSE 连接失败，降级为轮询模式: ${error}`);
        this.useSSE = false;
        this.startPolling();
        this.logger.info(`Worker ${this.config.workerId} 已启动，使用轮询模式`);
      }
    } catch (error) {
      this.logger.error(`Worker 启动失败: ${error}`);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.logger.info(`Worker ${this.config.workerId} 停止中...`);

    if (this.useSSE) {
      this.taskStreamService.stop();
    }

    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = undefined;
    }

    this.heartbeatService.stop();
    this.logger.info(`Worker ${this.config.workerId} 已停止`);
  }

  private startPolling(): void {
    this.pollIntervalId = setInterval(() => {
      if (this.runningTasks.size < this.config.maxConcurrentTasks) {
        this.pollAndExecute().catch((error) => {
          this.logger.error(`任务轮询执行失败: ${error.message}`);
        });
      }
    }, this.config.pollIntervalMs);
  }

  private onTaskNotification(): void {
    if (this.runningTasks.size < this.config.maxConcurrentTasks) {
      this.pollAndExecute().catch((error) => {
        this.logger.error(`任务拉取执行失败: ${error.message}`);
      });
    }
  }

  private async pollAndExecute(): Promise<void> {
    try {
      const response = await this.taskPullService.pullTask();

      if (!response.hasTask || !response.task) {
        return;
      }

      const task = response.task;
      this.logger.info(`拉取到任务: ${task.taskId} (当前并发: ${this.runningTasks.size + 1}/${this.config.maxConcurrentTasks})`);

      // 根据任务选择执行器
      const executor = this.selectExecutor(task);
      const taskPromise = this.executeTask(task, executor);
      this.runningTasks.set(task.taskId, taskPromise);

      taskPromise.finally(() => {
        this.runningTasks.delete(task.taskId);
      });
    } catch (error) {
      this.logger.error(`任务拉取失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async executeTask(task: any, executor: TaskExecutor): Promise<void> {
    const timeoutMs = task.executionTimeoutMs || this.config.openCode.timeoutMs;
    const maxRetries = task.maxRetries !== undefined ? task.maxRetries : 3;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort('timeout'), timeoutMs);
      const cancellationInterval = setInterval(() => {
        this.taskCancellationService.isCancelled(task.taskId)
          .then((cancelled) => {
            if (cancelled) abortController.abort('cancelled');
          })
          .catch((error: unknown) => {
            if (error instanceof Error) {
              this.logger.warn(`任务 ${task.taskId} 取消状态查询失败: ${error.message}`);
            }
          });
      }, Math.min(this.config.pollIntervalMs, 1000));

      try {
        // 构建执行上下文（V2 格式）
        // 兼容旧版 task.openCode 和新版 task.executorConfig
        const executorConfig = task.executorConfig ?? {
          baseUrl: task.openCode?.server?.baseUrl ?? task.openCode?.baseUrl,
          port: task.openCode?.server?.port ?? task.openCode?.port ?? 4096,
          agent: task.openCode?.agent ?? 'build',
          mode: task.openCode?.mode ?? 'default',
        };

        const executionPromise = executor.execute({
          taskId: task.taskId,
          projectKey: task.projectKey,
          repoPath: task.repoPath,
          branchBase: task.branchBase,
          executorType: task.executorType ?? executor.name,
          executorConfig,
          intent: task.intent,
          constraints: task.constraints ?? [],
          acceptanceCriteria: task.acceptanceCriteria ?? [],
          sourceText: task.sourceText ?? '',
          status: task.status,
          executionPrompt: task.executionPrompt ?? task.intent,
          outputContract: task.outputContract ?? {
            completionChecklist: [],
            modifiedFiles: [],
            executionCommands: [],
            testResults: [],
            risksAndConfirmations: [],
          },
          executionBoundary: task.executionBoundary ?? {
            allowedActions: [],
            forbiddenActions: [],
            highRiskHandling: 'skip',
          },
          abortSignal: abortController.signal,
        });

        const result = await Promise.race([
          executionPromise,
          new Promise<never>((_, reject) => {
            abortController.signal.addEventListener('abort', () => {
              reject(new Error(
                abortController.signal.reason === 'cancelled'
                  ? '任务已取消'
                  : `任务执行超时（${timeoutMs}ms）`,
              ));
            }, { once: true });
          }),
        ]);

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

        this.logger.info(`任务 ${task.taskId} 执行完成`);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError.message.includes('任务已取消')) {
          this.logger.info(`任务 ${task.taskId} 已取消`);
          return;
        }
        const isTimeout = lastError.message.includes('任务执行超时');

        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt), 30000);
          this.logger.warn(`任务 ${task.taskId} ${isTimeout ? '执行超时' : '执行失败'}，${delayMs}ms 后重试（${attempt + 1}/${maxRetries}）`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          this.logger.error(`任务 ${task.taskId} 重试 ${maxRetries} 次后仍${isTimeout ? '超时' : '失败'}`);
        }
      } finally {
        clearTimeout(timeoutId);
        clearInterval(cancellationInterval);
      }
    }

    if (lastError) {
      const isTimeout = lastError.message.includes('任务执行超时');
      await this.resultSubmitService.submitResult({
        taskId: task.taskId,
        status: 'failed',
        workerId: this.config.workerId,
        projectKey: task.projectKey,
        summary: `${isTimeout ? '任务执行超时' : '任务执行失败'}（重试 ${maxRetries} 次后仍失败）: ${lastError.message}`,
        placeholderExecution: false,
        logs: [`${isTimeout ? '执行超时' : '执行失败'}（重试 ${maxRetries} 次）: ${lastError.message}`],
        changedFiles: [],
        commands: [],
        testResult: '未执行',
        rawOutputSummary: lastError.message,
        parseStatus: 'parse_failed',
        updatedAt: new Date().toISOString(),
      });
    }
  }
}
