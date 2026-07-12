import type { Manifest } from '@clawkit/shared';

import type { QuickSetupProfile } from '../types/quick-setup';
import { HttpError } from '../errors/http-error';

export class QuickSetupCompiler {
  compile(profile: QuickSetupProfile): Manifest {
    this.validate(profile);

    if (profile.mode === 'all-in-one') {
      return this.compileAllInOne(profile);
    }

    return this.compileHybrid(profile);
  }

  private compileAllInOne(profile: QuickSetupProfile): Manifest {
    return {
      profile: {
        name: profile.name.trim(),
        version: '1.0.0',
        topology: 'all-in-one',
      },
      nodes: {
        'local-dev': {
          type: 'local',
          workDir: './.clawkit/local-dev',
        },
      },
      services: {
        controller: {
          node: 'local-dev',
          port: 8787,
          apiPrefix: '/api',
          publicUrl: 'http://127.0.0.1:8787',
        },
        openClaw: {
          node: 'local-dev',
          publicUrl: profile.openclaw.publicUrl.trim(),
          deployMode: profile.openclaw.deployMode,
          apiKey: 'replace-me',
        },
      },
      workers: [
        {
          id: profile.worker.id.trim(),
          node: 'local-dev',
          connectMode: 'pull',
          tags: [],
          projects: [
            {
              key: profile.project.key.trim(),
              repoPath: profile.project.repoPath.trim(),
              baseBranch: 'main',
              openCode: {
                port: profile.worker.opencodePort,
                agent: 'build',
                mode: 'default',
              },
            },
          ],
        },
      ],
      runtime: {
        promptEngine: this.buildPromptEngine(profile),
        memory: {
          enabled: true,
          provider: 'local',
          path: './data/memory',
        },
      },
      notify: {
        enabled: false,
        channels: [],
      },
      deploy: {
        timeout: 300,
        retryCount: 2,
        healthCheck: {
          enabled: true,
          interval: 30,
        },
      },
    };
  }

  private compileHybrid(profile: QuickSetupProfile): Manifest {
    const remote = profile.remote!;

    return {
      profile: {
        name: profile.name.trim(),
        version: '1.0.0',
        topology: 'hybrid',
      },
      nodes: {
        'cloud-control': {
          type: 'ssh',
          host: remote.host.trim(),
          port: 22,
          user: remote.user.trim(),
          keyPath: remote.keyPath.trim(),
          workDir: remote.workDir.trim(),
        },
        'local-dev': {
          type: 'local',
          workDir: './.clawkit/local-dev',
        },
      },
      services: {
        controller: {
          node: 'cloud-control',
          port: 8787,
          apiPrefix: '/api',
          publicUrl: `http://${remote.host.trim()}:8787`,
        },
        openClaw: {
          node: 'cloud-control',
          publicUrl: profile.openclaw.publicUrl.trim(),
          deployMode: profile.openclaw.deployMode,
          apiKey: 'replace-me',
        },
      },
      workers: [
        {
          id: profile.worker.id.trim(),
          node: 'local-dev',
          connectMode: 'pull',
          tags: [],
          projects: [
            {
              key: profile.project.key.trim(),
              repoPath: profile.project.repoPath.trim(),
              baseBranch: 'main',
              openCode: {
                port: profile.worker.opencodePort,
                agent: 'build',
                mode: 'default',
              },
            },
          ],
        },
      ],
      runtime: {
        promptEngine: this.buildPromptEngine(profile),
        memory: {
          enabled: true,
          provider: 'local',
          path: './data/memory',
        },
      },
      notify: {
        enabled: false,
        channels: [],
      },
      deploy: {
        timeout: 300,
        retryCount: 2,
        healthCheck: {
          enabled: true,
          interval: 30,
        },
      },
    };
  }

  private validate(profile: QuickSetupProfile): void {
    if (profile.name.trim().length === 0) {
      throw this.createBadRequest('配置名称不能为空');
    }

    if (profile.project.key.trim().length === 0) {
      throw this.createBadRequest('项目 key 不能为空');
    }

    if (profile.project.repoPath.trim().length === 0) {
      throw this.createBadRequest('仓库路径不能为空');
    }

    if (profile.openclaw.publicUrl.trim().length === 0) {
      throw this.createBadRequest('OpenClaw 地址不能为空');
    }

    if (profile.promptEngine.mode === 'llm' || profile.promptEngine.mode === 'hybrid') {
      if (!profile.promptEngine.provider) {
        throw this.createBadRequest('模型供应商不能为空');
      }
      if (!profile.promptEngine.apiKeyEnv || profile.promptEngine.apiKeyEnv.trim().length === 0) {
        throw this.createBadRequest('模型 API Key 环境变量不能为空');
      }
      if (!profile.promptEngine.model || profile.promptEngine.model.trim().length === 0) {
        throw this.createBadRequest('默认模型不能为空');
      }
      if (profile.promptEngine.provider === 'custom' && (!profile.promptEngine.baseUrl || profile.promptEngine.baseUrl.trim().length === 0)) {
        throw this.createBadRequest('自定义模型供应商必须填写 Base URL');
      }
    }

    if (profile.worker.id.trim().length === 0) {
      throw this.createBadRequest('Worker ID 不能为空');
    }

    if (!Number.isInteger(profile.worker.opencodePort) || profile.worker.opencodePort <= 0) {
      throw this.createBadRequest('OpenCode 端口必须是正整数');
    }

    if (profile.mode === 'hybrid') {
      if (!profile.remote) {
        throw this.createBadRequest('hybrid 模式缺少远程控制节点配置');
      }

      if (profile.remote.host.trim().length === 0) {
        throw this.createBadRequest('SSH 主机不能为空');
      }

      if (profile.remote.user.trim().length === 0) {
        throw this.createBadRequest('SSH 用户不能为空');
      }

      if (profile.remote.keyPath.trim().length === 0) {
        throw this.createBadRequest('SSH 私钥路径不能为空');
      }

      if (profile.remote.workDir.trim().length === 0) {
        throw this.createBadRequest('远程工作目录不能为空');
      }
    }
  }

  private createBadRequest(message: string): HttpError {
    return new HttpError({
      statusCode: 400,
      errorCode: 'controller.setup.quick_profile_invalid',
      message,
    });
  }

  private buildPromptEngine(profile: QuickSetupProfile): Manifest['runtime']['promptEngine'] {
    const base = {
      mode: profile.promptEngine.mode,
      temperature: 0.7,
      maxTokens: 4096,
      timeoutMs: 30000,
    } as Manifest['runtime']['promptEngine'];

    if (profile.promptEngine.mode === 'template') {
      return base;
    }

    return {
      ...base,
      provider: profile.promptEngine.provider,
      baseUrl: profile.promptEngine.baseUrl?.trim() || undefined,
      apiKeyEnv: profile.promptEngine.apiKeyEnv?.trim(),
      model: profile.promptEngine.model?.trim(),
    };
  }
}
