import fs from 'node:fs';

import type { TaskExecutionContext, TaskExecutionResult, TaskExecutor } from '@clawkit/shared';

import type { WorkerConfig } from '../config';
import { PlaceholderExecutor } from './placeholder-executor';
import { ExecutionResultNormalizer } from '../services/execution-result-normalizer';
import { OpenCodeClient } from '../services/open-code-client';
import { ProjectContextReader } from '../services/project-context-reader';
import { SecurityBoundaryBuilder } from '../services/security-boundary-builder';
import { WorkerPromptCompiler } from '../services/worker-prompt-compiler';

/**
 * OpenCode 执行器
 * 实现 TaskExecutor 接口，负责调用 OpenCode 服务执行任务
 */
export class OpenCodeExecutor implements TaskExecutor {
  /** 执行器名称 */
  readonly name = 'opencode';

  private readonly client: OpenCodeClient;
  private readonly contextReader: ProjectContextReader;
  private readonly boundaryBuilder: SecurityBoundaryBuilder;
  private readonly promptCompiler: WorkerPromptCompiler;
  private readonly resultNormalizer: ExecutionResultNormalizer;
  private readonly placeholderExecutor: PlaceholderExecutor;

  constructor(private readonly config: WorkerConfig) {
    this.client = new OpenCodeClient(config.openCode);
    this.contextReader = new ProjectContextReader();
    this.boundaryBuilder = new SecurityBoundaryBuilder();
    this.promptCompiler = new WorkerPromptCompiler();
    this.resultNormalizer = new ExecutionResultNormalizer();
    this.placeholderExecutor = new PlaceholderExecutor(config.workerId);
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    try {
      this.ensureRepoPath(context.repoPath);
      const baseUrl = this.resolveBaseUrl(context);
      await this.client.checkAvailability(baseUrl);
      const projectContext = await this.contextReader.read(context.projectKey, context.repoPath, context.branchBase);
      const boundary = this.boundaryBuilder.build();
      const finalPrompt = this.promptCompiler.compile(context, projectContext, boundary);

      // 从 executorConfig 或 context.openCode（兼容）获取配置
      const agent = context.executorConfig?.agent ?? (context as any).openCode?.agent ?? 'build';

      const execution = await this.client.run({
        repoPath: context.repoPath,
        taskId: context.taskId,
        prompt: finalPrompt,
        agent,
        baseUrl,
        permission: boundary,
      });

      return this.resultNormalizer.normalize({
        context,
        workerId: this.config.workerId,
        rawOutput: execution.rawOutput,
        logs: execution.logs,
        sessionId: execution.sessionId,
      });
    } catch (error) {
      if (this.config.openCode.fallbackToPlaceholder) {
        return this.placeholderExecutor.execute(context);
      }

      return this.buildFailureResult(context, error);
    }
  }

  private ensureRepoPath(repoPath: string): void {
    if (!fs.existsSync(repoPath)) {
      throw this.buildStructuredError(
        'executor.repo_path_not_found',
        `项目路径不存在：${repoPath}`,
        'project_check',
        repoPath,
      );
    }
  }

  private resolveBaseUrl(context: TaskExecutionContext): string {
    // 优先使用 executorConfig 中的 baseUrl
    if (context.executorConfig?.baseUrl) {
      return context.executorConfig.baseUrl;
    }

    // 兼容旧版 context.openCode
    const port = context.executorConfig?.port ?? (context as any).openCode?.port ?? 4096;
    return `http://127.0.0.1:${port}`;
  }

  private buildFailureResult(context: TaskExecutionContext, error: unknown): TaskExecutionResult {
    const message = error instanceof Error ? error.message : String(error);
    const baseUrl = this.resolveBaseUrl(context);

    let errorCode = 'executor.unknown_error';
    let stage: 'project_check' | 'execute' = 'execute';
    let troubleshootingHint = '';

    if (message.includes('项目路径不存在') || message.includes('repo_path_not_found')) {
      errorCode = 'executor.repo_path_not_found';
      stage = 'project_check';
      troubleshootingHint = '请检查 manifest 中的 repoPath 配置是否正确';
    } else if (message.includes('ECONNREFUSED') || message.includes('connect') || message.includes('不可达')) {
      errorCode = 'executor.opencode_unavailable';
      stage = 'execute';
      troubleshootingHint = `OpenCode server 不可达，请确认：
1. 已启动 opencode serve --hostname 127.0.0.1 --port ${context.executorConfig?.port ?? 4096}
2. 已设置 OPENCODE_SERVER_PASSWORD 环境变量
3. 防火墙未阻止端口 ${context.executorConfig?.port ?? 4096}`;
    } else if (message.includes('401') || message.includes('Unauthorized') || message.includes('认证')) {
      errorCode = 'executor.auth_failed';
      stage = 'execute';
      troubleshootingHint = '认证失败，请检查 OPENCODE_SERVER_PASSWORD 环境变量是否正确';
    } else if (message.includes('timeout') || message.includes('超时')) {
      errorCode = 'executor.execution_timeout';
      stage = 'execute';
      troubleshootingHint = '执行超时，可能是任务过于复杂或 OpenCode 响应缓慢';
    } else if (message.includes('does not support image') || message.includes('image input')) {
      errorCode = 'executor.model_no_image_support';
      stage = 'execute';
      troubleshootingHint = '当前模型不支持图片输入，请移除任务描述或仓库中的图片附件（如 .png/.jpg/.gif），或更换支持多模态的模型';
    }

    const structuredError = error instanceof Error && 'structuredError' in error
      ? (error as Error & { structuredError?: TaskExecutionResult['structuredError'] }).structuredError
      : {
          errorCode,
          message,
          stage,
          rawErrorSummary: message,
        };

    const serverHint = this.client.buildServerUnavailableHint(baseUrl);
    const logs = [
      `执行失败：${message}`,
      troubleshootingHint || serverHint,
    ];

    return {
      taskId: context.taskId,
      workerId: this.config.workerId,
      projectKey: context.projectKey,
      status: 'failed',
      summary: `任务执行失败：${message}`,
      placeholderExecution: false,
      logs,
      changedFiles: [],
      commands: [],
      testResult: '未执行',
      rawOutputSummary: message,
      parseStatus: 'parse_failed',
      structuredError,
      risks: ['当前返回为结构化失败结果，未擅自执行高风险回退动作'],
      updatedAt: new Date().toISOString(),
    };
  }

  private buildStructuredError(
    errorCode: string,
    message: string,
    stage: 'project_check' | 'execute',
    rawErrorSummary: string,
  ): Error {
    const error = new Error(message) as Error & { structuredError?: TaskExecutionResult['structuredError'] };
    error.structuredError = {
      errorCode,
      message,
      stage,
      rawErrorSummary,
    };
    return error;
  }
}
