/**
 * Claude Code Executor
 * 使用 Claude Code CLI 执行任务的执行器
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { TaskExecutionContext, TaskExecutionResult, TaskExecutor, ExecutorFactory, ExecutorMeta, ExecutorFactoryConfig } from '@clawkit/shared';

import { PlaceholderExecutor } from './placeholder-executor';

/**
 * Claude Code Executor 元信息
 */
const CLAUDE_CODE_META: ExecutorMeta = {
  name: 'claude-code',
  displayName: 'Claude Code CLI',
  version: '1.0.0',
  description: '使用 Anthropic Claude Code CLI 执行任务',
  capabilities: [
    {
      type: 'code-generation',
      description: '代码生成和修改',
      supportsStreaming: true,
    },
    {
      type: 'refactoring',
      description: '代码重构',
      supportsStreaming: true,
    },
    {
      type: 'code-review',
      description: '代码审查',
    },
    {
      type: 'testing',
      description: '测试生成和运行',
    },
  ],
  supportedLanguages: ['typescript', 'javascript', 'python', 'go', 'rust', 'java', 'cpp', 'c'],
};

/**
 * Claude Code Executor 实现
 */
export class ClaudeCodeExecutor implements TaskExecutor {
  readonly name = 'claude-code';

  private readonly config: ExecutorFactoryConfig;
  private readonly workerId: string;
  private readonly placeholderExecutor: PlaceholderExecutor;

  constructor(config: ExecutorFactoryConfig, workerId = 'worker-unknown') {
    this.config = config;
    this.workerId = workerId;
    this.placeholderExecutor = new PlaceholderExecutor(workerId);
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    try {
      // 检查仓库路径
      this.ensureRepoPath(context.repoPath);

      // 获取 Claude Code CLI 配置
      const config = this.config.config || {};
      const binaryPath = (config.binaryPath as string) || 'claude';
      const baseUrl = config.baseUrl as string | undefined;

      // 检查 Claude Code 是否可用
      const isAvailable = await this.checkAvailability(binaryPath);
      if (!isAvailable) {
        return this.buildFailureResult(
          context,
          'claude_code_unavailable',
          'Claude Code CLI 不可用，请确认已安装 Claude Code 并配置正确的路径',
          'project_check',
        );
      }

      // 构建 Claude Code 命令参数
      const args = this.buildCommandArgs(context, baseUrl);

      // 执行 Claude Code
      const result = await this.runClaudeCode(binaryPath, args, context);

      return result;
    } catch (error) {
      // 如果配置允许降级到占位执行器
      if (this.config.fallbackToPlaceholder) {
        return this.placeholderExecutor.execute(context);
      }

      return this.buildFailureResult(
        context,
        'executor.unknown_error',
        error instanceof Error ? error.message : String(error),
        'execute',
      );
    }
  }

  /**
   * 检查 Claude Code CLI 是否可用
   */
  private async checkAvailability(binaryPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(binaryPath, ['--version'], { shell: true });
      let output = '';
      
      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      proc.stderr?.on('data', (data) => {
        output += data.toString();
      });
      
      proc.on('close', (code) => {
        resolve(code === 0 && output.length > 0);
      });
      
      proc.on('error', () => {
        resolve(false);
      });
      
      // 超时
      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * 构建 Claude Code 命令参数
   */
  private buildCommandArgs(context: TaskExecutionContext, baseUrl?: string): string[] {
    const args: string[] = [];

    // 添加任务描述
    if (context.executionPrompt) {
      args.push('--prompt', context.executionPrompt);
    } else {
      args.push('--prompt', context.intent);
    }

    // 添加项目路径
    args.push('--dir', context.repoPath);

    // 添加分支
    if (context.branchBase) {
      args.push('--branch', context.branchBase);
    }

    // 添加输出格式
    args.push('--output-format', 'json');

    // 添加模型（如果配置了）
    const model = (this.config.config as Record<string, unknown>)?.model as string | undefined;
    if (model) {
      args.push('--model', model);
    }

    // 添加终止条件（基于验收标准）
    if (context.acceptanceCriteria.length > 0) {
      args.push('--exit-on', context.acceptanceCriteria.join(';'));
    }

    return args;
  }

  /**
   * 执行 Claude Code CLI
   */
  private runClaudeCode(
    binaryPath: string,
    args: string[],
    context: TaskExecutionContext,
  ): Promise<TaskExecutionResult> {
    return new Promise((resolve) => {
      const logs: string[] = [];
      let rawOutput = '';

      logs.push(`[${new Date().toISOString()}] 开始执行 Claude Code CLI`);
      logs.push(`[${new Date().toISOString()}] 命令: ${binaryPath} ${args.join(' ')}`);

      const proc = spawn(binaryPath, args, {
        shell: true,
        cwd: context.repoPath,
        env: {
          ...process.env,
          // 添加认证信息（如果配置了）
          ...(() => {
            const pwdEnv = (this.config.config as Record<string, unknown>)?.passwordEnv as string | undefined;
            return pwdEnv ? { [pwdEnv]: process.env[pwdEnv] || '' } : {};
          })(),
        },
      });

    // 设置超时
    const timeoutMs = (this.config.config as Record<string, unknown>)?.timeoutMs as number | undefined;
    const timeout = timeoutMs ?? 300000;
      const timeoutId = setTimeout(() => {
        proc.kill();
        resolve(this.buildFailureResult(
          context,
          'execution_timeout',
          `执行超时（${timeout}ms）`,
          'execute',
        ));
      }, timeout);

      proc.stdout?.on('data', (data) => {
        const text = data.toString();
        rawOutput += text;
        logs.push(`[stdout] ${text.trim()}`);
      });

      proc.stderr?.on('data', (data) => {
        const text = data.toString();
        logs.push(`[stderr] ${text.trim()}`);
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        logs.push(`[${new Date().toISOString()}] Claude Code CLI 退出，退出码: ${code}`);

        if (code === 0) {
          resolve(this.buildSuccessResult(context, rawOutput, logs));
        } else {
          resolve(this.buildFailureResult(
            context,
            'execution_failed',
            `Claude Code 执行失败，退出码: ${code}`,
            'execute',
            rawOutput,
          ));
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve(this.buildFailureResult(
          context,
          'execution_error',
          `Claude Code 执行错误：${error.message}`,
          'execute',
        ));
      });
    });
  }

  /**
   * 检查仓库路径是否存在
   */
  private ensureRepoPath(repoPath: string): void {
    if (!fs.existsSync(repoPath)) {
      throw new Error(`项目路径不存在：${repoPath}`);
    }
    if (!fs.statSync(repoPath).isDirectory()) {
      throw new Error(`项目路径不是目录：${repoPath}`);
    }
  }

  /**
   * 构建成功结果
   */
  private buildSuccessResult(
    context: TaskExecutionContext,
    rawOutput: string,
    logs: string[],
  ): TaskExecutionResult {
    let changedFiles: string[] = [];
    let commands: string[] = [];

    // 尝试解析 JSON 输出
    try {
      const result = JSON.parse(rawOutput);
      changedFiles = result.changedFiles || [];
      commands = result.commands || [];
    } catch {
      // JSON 解析失败，使用原始输出
    }

    return {
      taskId: context.taskId,
      workerId: this.workerId,
      projectKey: context.projectKey,
      status: 'done',
      summary: `Claude Code 执行完成`,
      placeholderExecution: false,
      logs,
      changedFiles,
      commands,
      testResult: '未执行',
      rawOutputSummary: rawOutput.substring(0, 500),
      parseStatus: changedFiles.length > 0 ? 'structured' : 'text_only',
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 构建失败结果
   */
  private buildFailureResult(
    context: TaskExecutionContext,
    errorCode: string,
    message: string,
    stage: 'project_check' | 'execute' | 'result_parse',
    rawOutput?: string,
  ): TaskExecutionResult {
    return {
      taskId: context.taskId,
      workerId: this.workerId,
      projectKey: context.projectKey,
      status: 'failed',
      summary: `Claude Code 执行失败：${message}`,
      placeholderExecution: false,
      logs: [
        `执行失败：${message}`,
        stage === 'project_check' ? '请检查项目路径配置是否正确' : '请检查 Claude Code CLI 是否正确安装',
      ],
      changedFiles: [],
      commands: [],
      testResult: '未执行',
      rawOutputSummary: rawOutput?.substring(0, 500) || message,
      parseStatus: 'parse_failed',
      structuredError: {
        errorCode,
        message,
        stage,
        rawErrorSummary: message,
        troubleshootingHint: this.getTroubleshootingHint(errorCode),
      },
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 获取故障排查提示
   */
  private getTroubleshootingHint(errorCode: string): string {
    switch (errorCode) {
      case 'claude_code_unavailable':
        return `请确认：
1. Claude Code CLI 已正确安装
2. claude 命令在 PATH 中可用
3. 或在配置中指定正确的 binaryPath`;
      case 'execution_timeout':
        return `执行超时，可能是任务过于复杂或 Claude Code 响应缓慢
建议：增加 timeoutMs 配置或简化任务描述`;
      case 'auth_failed':
        return `认证失败，请检查 ANTHROPIC_API_KEY 环境变量是否正确设置`;
      default:
        return `请检查 Claude Code 配置和执行环境`;
    }
  }
}

/**
 * Claude Code Executor 工厂
 */
export class ClaudeCodeExecutorFactory implements ExecutorFactory {
  readonly meta = CLAUDE_CODE_META;

  create(config: ExecutorFactoryConfig): TaskExecutor {
    return new ClaudeCodeExecutor(config, config.node || 'worker-unknown');
  }

  validateConfig(config: Record<string, unknown>): { valid: boolean; errors?: string[]; warnings?: string[] } {
    const errors: string[] = [];

    // binaryPath 是可选的，如果提供必须是有效路径
    if (config.binaryPath && typeof config.binaryPath !== 'string') {
      errors.push('binaryPath 必须是字符串');
    }

    // timeoutMs 是可选的，如果提供必须是正整数
    if (config.timeoutMs !== undefined) {
      if (typeof config.timeoutMs !== 'number' || config.timeoutMs <= 0) {
        errors.push('timeoutMs 必须是正整数');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

// 导出工厂实例
export const claudeCodeExecutorFactory = new ClaudeCodeExecutorFactory();
