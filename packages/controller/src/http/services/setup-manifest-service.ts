import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ControllerErrorCode, ManifestSchema, type Manifest } from '@clawkit/shared';
import { ManifestLoader } from '@clawkit/cli/services';
import * as yaml from 'yaml';

import { HttpError } from '../errors/http-error';
import type { QuickSetupProfile } from '../types/quick-setup';
import { QuickSetupCompiler } from './quick-setup-compiler';

export type SetupSchemaKind =
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'literal'
  | 'record'
  | 'union'
  | 'unknown';

export interface SetupSchemaNode {
  kind: SetupSchemaKind;
  description?: string;
  required: boolean;
  defaultValue?: unknown;
  properties?: Record<string, SetupSchemaNode>;
  items?: SetupSchemaNode;
  enumValues?: string[];
  literalValue?: string | number | boolean;
  recordValue?: SetupSchemaNode;
  unionOptions?: SetupSchemaNode[];
}

export interface SetupDefaultsPreset {
  key: string;
  title: string;
  yamlText: string;
  manifest: Manifest;
}

export interface SetupDefaults {
  presets: SetupDefaultsPreset[];
  schemaDefaults: Record<string, unknown>;
}

export interface SetupManifestPreview {
  manifest: Manifest;
  yamlText: string;
}

export class SetupManifestService {
  private readonly loader = new ManifestLoader();
  private readonly quickSetupCompiler = new QuickSetupCompiler();

  private readonly schema: SetupSchemaNode = {
    kind: 'object',
    required: true,
    properties: {
      profile: {
        kind: 'object',
        required: true,
        properties: {
          name: { kind: 'string', required: true, description: '配置名称' },
          version: { kind: 'string', required: true, defaultValue: '1.0.0', description: '配置版本' },
          topology: {
            kind: 'enum',
            required: true,
            enumValues: ['all-in-one', 'hybrid', 'split'],
            description: '部署拓扑类型',
          },
          description: { kind: 'string', required: false, description: '配置描述' },
        },
      },
      nodes: {
        kind: 'record',
        required: true,
        description: '节点配置映射',
        recordValue: {
          kind: 'union',
          required: true,
          unionOptions: [
            {
              kind: 'object',
              required: true,
              properties: {
                type: { kind: 'literal', required: true, literalValue: 'local' },
                workDir: { kind: 'string', required: false, description: '工作目录' },
              },
            },
            {
              kind: 'object',
              required: true,
              properties: {
                type: { kind: 'literal', required: true, literalValue: 'ssh' },
                host: { kind: 'string', required: true, description: 'SSH 主机地址' },
                port: { kind: 'number', required: true, defaultValue: 22, description: 'SSH 端口' },
                user: { kind: 'string', required: true, description: 'SSH 用户名' },
                keyPath: { kind: 'string', required: false, description: 'SSH 私钥路径' },
                password: { kind: 'string', required: false, description: 'SSH 密码' },
                workDir: { kind: 'string', required: true, description: '远程工作目录' },
              },
            },
          ],
        },
      },
      services: {
        kind: 'object',
        required: true,
        properties: {
          controller: {
            kind: 'object',
            required: true,
            properties: {
              node: { kind: 'string', required: true, description: 'Controller 节点引用' },
              port: { kind: 'number', required: true, defaultValue: 8080, description: 'Controller 端口' },
              apiPrefix: { kind: 'string', required: true, defaultValue: '/api', description: 'API 前缀' },
            },
          },
          openClaw: {
            kind: 'object',
            required: true,
            properties: {
              node: { kind: 'string', required: true, description: 'OpenClaw 节点引用' },
              publicUrl: { kind: 'string', required: true, description: 'OpenClaw 对外地址' },
              apiKey: { kind: 'string', required: false, description: 'OpenClaw API Key' },
            },
          },
        },
      },
      workers: {
        kind: 'array',
        required: true,
        items: {
          kind: 'object',
          required: true,
          properties: {
            id: { kind: 'string', required: true, description: 'Worker ID' },
            node: { kind: 'string', required: true, description: '节点引用' },
            connectMode: {
              kind: 'enum',
              required: true,
              enumValues: ['pull', 'push'],
              defaultValue: 'pull',
              description: '连接模式',
            },
            tags: { kind: 'array', required: true, items: { kind: 'string', required: true }, defaultValue: [] },
            projects: {
              kind: 'array',
              required: true,
              items: {
                kind: 'object',
                required: true,
                properties: {
                  key: { kind: 'string', required: true, description: '项目 key' },
                  repoPath: { kind: 'string', required: true, description: '仓库路径' },
                  baseBranch: { kind: 'string', required: true, defaultValue: 'main', description: '基础分支' },
                  openCode: {
                    kind: 'object',
                    required: true,
                    properties: {
                      port: { kind: 'number', required: true, description: 'OpenCode 端口' },
                      agent: { kind: 'string', required: true, defaultValue: 'build', description: '代理类型' },
                      mode: { kind: 'string', required: true, defaultValue: 'default', description: '运行模式' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      runtime: {
        kind: 'object',
        required: true,
        properties: {
          promptEngine: {
            kind: 'object',
            required: true,
            properties: {
              mode: {
                kind: 'enum',
                required: true,
                enumValues: ['template', 'llm', 'hybrid'],
                defaultValue: 'template',
              },
              provider: {
                kind: 'enum',
                required: false,
                enumValues: ['openai', 'anthropic', 'custom'],
              },
              baseUrl: { kind: 'string', required: false },
              apiKeyEnv: { kind: 'string', required: false },
              model: { kind: 'string', required: false },
              temperature: { kind: 'number', required: true, defaultValue: 0.7 },
              maxTokens: { kind: 'number', required: true, defaultValue: 4096 },
              timeoutMs: { kind: 'number', required: true, defaultValue: 30000 },
            },
          },
          memory: {
            kind: 'object',
            required: true,
            properties: {
              enabled: { kind: 'boolean', required: true, defaultValue: true },
              provider: {
                kind: 'enum',
                required: true,
                enumValues: ['local', 'redis', 'postgres'],
                defaultValue: 'local',
              },
              path: { kind: 'string', required: false },
              url: { kind: 'string', required: false },
            },
          },
        },
      },
    },
  };

  private readonly schemaDefaults: Record<string, unknown> = {
    profile: {
      version: '1.0.0',
    },
    services: {
      controller: {
        port: 8080,
        apiPrefix: '/api',
      },
    },
    workers: [
      {
        connectMode: 'pull',
        tags: [],
        projects: [
          {
            baseBranch: 'main',
            openCode: {
              agent: 'build',
              mode: 'default',
            },
          },
        ],
      },
    ],
    runtime: {
      promptEngine: {
        mode: 'template',
        temperature: 0.7,
        maxTokens: 4096,
        timeoutMs: 30000,
      },
      memory: {
        enabled: true,
        provider: 'local',
      },
    },
  };

  getSchema(): SetupSchemaNode {
    return this.schema;
  }

  getDefaults(): SetupDefaults {
    const presets: SetupDefaultsPreset[] = [
      this.loadExamplePreset('all-in-one', '单机模式（all-in-one）', path.join('examples', 'all-in-one.yaml')),
      this.loadExamplePreset('hybrid', '混合模式（hybrid）', path.join('examples', 'hybrid.yaml')),
    ];

    return {
      presets,
      schemaDefaults: this.schemaDefaults,
    };
  }

  preview(formData: unknown): SetupManifestPreview {
    const parsed = ManifestSchema.safeParse(formData);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw new HttpError({
        statusCode: 400,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_INVALID,
        message: `manifest 校验失败：${firstIssue?.message ?? '未知错误'}`,
        details: parsed.error.issues,
      });
    }

    const yamlText = this.stringifyYaml(parsed.data);

    return {
      manifest: this.validateViaManifestLoader(yamlText),
      yamlText,
    };
  }

  compileQuickProfile(profile: QuickSetupProfile): SetupManifestPreview {
    const manifest = this.quickSetupCompiler.compile(profile);
    return this.preview(manifest);
  }

  private loadExamplePreset(key: string, title: string, relativePath: string): SetupDefaultsPreset {
    const absPath = path.resolve(process.cwd(), relativePath);
    const yamlText = fs.readFileSync(absPath, 'utf8');
    const loaded = this.loader.load(absPath);

    return {
      key,
      title,
      yamlText,
      manifest: loaded.manifest,
    };
  }

  private stringifyYaml(manifest: Manifest): string {
    const yamlText = yaml.stringify(manifest);
    return yamlText.endsWith('\n') ? yamlText : `${yamlText}\n`;
  }

  /**
   * 通过现有 ManifestLoader 二次校验，确保与 CLI 读取链路一致。
   */
  private validateViaManifestLoader(yamlText: string): Manifest {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-setup-'));
    const manifestPath = path.join(tempDir, 'clawkit.setup.preview.yaml');

    try {
      fs.writeFileSync(manifestPath, yamlText, 'utf8');
      return this.loader.load(manifestPath).manifest;
    } catch (error) {
      throw new HttpError({
        statusCode: 400,
        errorCode: ControllerErrorCode.TASK_PROTOCOL_FIELD_INVALID,
        message: `manifest 预览校验失败：${error instanceof Error ? error.message : '未知错误'}`,
      });
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
      }
    }
  }

}
