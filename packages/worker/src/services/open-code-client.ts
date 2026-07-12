import { spawn } from 'node:child_process';

import type { TaskExecutionBoundary, TaskExecutionStructuredError } from '@clawkit/shared';

import type { WorkerOpenCodeConfig } from '../config';

interface OpenCodeSdkSessionInfo {
  id: string;
}

interface OpenCodeSdkPromptPart {
  type: string;
  text?: string;
}

interface OpenCodeSdkMessage {
  parts: OpenCodeSdkPromptPart[];
}

interface OpenCodeSdkClient {
  global: {
    health(): Promise<{ data?: { healthy: true; version: string } }>;
  };
  session: {
    create(parameters: {
      directory: string;
      title: string;
      permission: Array<{ permission: string; pattern: string; action: 'ask' | 'allow' | 'deny' }>;
    }): Promise<{ data?: OpenCodeSdkSessionInfo }>;
    prompt(parameters: {
      sessionID: string;
      directory: string;
      agent?: string;
      parts: Array<{ type: 'text'; text: string }>;
    }): Promise<{ data?: { info: { id: string }; parts: OpenCodeSdkPromptPart[] } }>;
    messages(parameters: { sessionID: string; directory: string; limit?: number }): Promise<{ data?: OpenCodeSdkMessage[] }>;
    status(parameters: { directory: string }): Promise<{ data?: Record<string, unknown> }>;
  };
}

interface OpenCodeSdkModule {
  createOpencodeClient(config: {
    baseUrl: string;
    headers?: Record<string, string>;
    throwOnError?: boolean;
  }): OpenCodeSdkClient;
}

export interface OpenCodeRunInput {
  repoPath: string;
  taskId: string;
  prompt: string;
  agent?: string;
  baseUrl: string;
  permission: TaskExecutionBoundary;
}

export interface OpenCodeRunOutput {
  rawOutput: string;
  logs: string[];
  sessionId?: string;
}

export class OpenCodeClient {
  constructor(private readonly config: WorkerOpenCodeConfig) {}

  async checkAvailability(baseUrl: string): Promise<void> {
    if (this.config.mode === 'cli') {
      return;
    }

    const client = await this.createSdkClient(baseUrl);
    const response = await client.global.health();

    if (!response.data?.healthy) {
      throw this.buildError('opencode.server_unavailable', 'OpenCode server 不可用，请先启动服务', 'server_check');
    }
  }

  async run(input: OpenCodeRunInput): Promise<OpenCodeRunOutput> {
    if (this.config.mode === 'cli') {
      return this.runWithCli(input);
    }

    return this.runWithSdk(input);
  }

  buildServerUnavailableHint(baseUrl: string): string {
    return `请先在本机启动 OpenCode server：opencode serve --hostname 127.0.0.1 --port ${this.extractPort(baseUrl)}`;
  }

  private async runWithSdk(input: OpenCodeRunInput): Promise<OpenCodeRunOutput> {
    const client = await this.createSdkClient(input.baseUrl);
    const permission = this.toPermissionRules(input.permission);
    const sessionResponse = await client.session.create({
      directory: input.repoPath,
      title: `clawkit-${input.taskId}`,
      permission,
    });

    const sessionId = sessionResponse.data?.id;

    if (!sessionId) {
      throw this.buildError('opencode.session_create_failed', 'OpenCode 会话创建失败', 'execute');
    }

    const promptResponse = await client.session.prompt({
      sessionID: sessionId,
      directory: input.repoPath,
      agent: input.agent,
      parts: [{ type: 'text', text: input.prompt }],
    });

    await client.session.status({ directory: input.repoPath });
    const messages = await client.session.messages({
      sessionID: sessionId,
      directory: input.repoPath,
      limit: 20,
    });

    const rawOutput = this.extractText([
      ...(messages.data ?? []),
      promptResponse.data ? { parts: promptResponse.data.parts } : { parts: [] },
    ]);

    return {
      rawOutput,
      logs: [`[${new Date().toISOString()}] OpenCode SDK 执行完成`],
      sessionId,
    };
  }

  private async runWithCli(input: OpenCodeRunInput): Promise<OpenCodeRunOutput> {
    const password = this.readPassword();
    const args = [
      'run',
      '--format',
      'json',
      '--attach',
      input.baseUrl,
      '--dir',
      input.repoPath,
      '--title',
      `clawkit-${input.taskId}`,
    ];

    if (input.agent) {
      args.push('--agent', input.agent);
    }

    if (password) {
      args.push('--password', password);
    }

    args.push(input.prompt);

    const result = await this.spawnCommand('opencode', args);
    return {
      rawOutput: result.stdout.trim(),
      logs: result.stderr.trim().length > 0 ? [result.stderr.trim()] : [],
    };
  }

  private async createSdkClient(baseUrl: string): Promise<OpenCodeSdkClient> {
    const module = await this.loadSdkModule();
    const password = this.readPassword();
    const username = this.config.server.username ?? 'opencode';
    const headers = password
      ? { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` }
      : undefined;

    return module.createOpencodeClient({
      baseUrl,
      headers,
      throwOnError: false,
    });
  }

  private async loadSdkModule(): Promise<OpenCodeSdkModule> {
    const importer = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<unknown>;
    const module = await importer('@opencode-ai/sdk/v2');

    return module as OpenCodeSdkModule;
  }

  private toPermissionRules(boundary: TaskExecutionBoundary): Array<{ permission: string; pattern: string; action: 'ask' | 'allow' | 'deny' }> {
    return [
      { permission: 'edit', pattern: '*', action: 'allow' },
      { permission: 'bash', pattern: 'git push*', action: 'deny' },
      { permission: 'bash', pattern: '*deploy*', action: 'deny' },
      { permission: 'bash', pattern: 'rm -rf *', action: 'deny' },
      { permission: 'bash', pattern: '*', action: 'ask' },
      { permission: 'webfetch', pattern: '*', action: 'allow' },
      { permission: 'external_directory', pattern: '*', action: 'deny' },
      ...boundary.forbiddenActions.map((item) => ({ permission: 'policy', pattern: item, action: 'deny' as const })),
    ];
  }

  private extractText(messages: OpenCodeSdkMessage[]): string {
    const parts: string[] = [];

    for (const message of messages) {
      for (const part of message.parts) {
        if (part.type === 'text' && typeof part.text === 'string' && part.text.trim().length > 0) {
          parts.push(part.text.trim());
        }
      }
    }

    return parts.join('\n\n');
  }

  private readPassword(): string | undefined {
    const passwordEnv = this.config.server.passwordEnv;

    if (!passwordEnv) {
      return undefined;
    }

    const password = process.env[passwordEnv];
    return password && password.length > 0 ? password : undefined;
  }

  private extractPort(baseUrl: string): string {
    try {
      return String(new URL(baseUrl).port || '4096');
    } catch {
      return '4096';
    }
  }

  private buildError(
    errorCode: string,
    message: string,
    stage: TaskExecutionStructuredError['stage'],
    rawErrorSummary = '',
  ): Error {
    const error = new Error(message) as Error & { structuredError?: TaskExecutionStructuredError };
    error.structuredError = {
      errorCode,
      message,
      stage,
      rawErrorSummary,
    };
    return error;
  }

  private async spawnCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: process.cwd(),
        env: process.env,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`OpenCode CLI 执行失败：${stderr || stdout}`));
          return;
        }

        resolve({ stdout, stderr });
      });
    });
  }
}
