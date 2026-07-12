import * as fs from 'fs';
import * as yaml from 'yaml';
import { askInput, askSelect, askConfirm } from '../utils/prompt';

/**
 * Init 交互式选项（完整配置）
 */
interface InitOptions {
  /** 拓扑类型 */
  topology: 'all-in-one' | 'hybrid' | 'split';
  /** 配置名称 */
  name: string;
  /** 是否启用 memory */
  enableMemory: boolean;
  /** memory provider */
  memoryProvider: 'local' | 'redis' | 'postgres';
  /** 是否启用 notify（占位） */
  enableNotify: boolean;
}

/**
 * 简化配置选项
 */
interface SimpleInitOptions {
  /** 项目列表 */
  projects: Array<{
    key: string;
    path: string;
    autoExecute: boolean;
    dangerousOps: string[];
  }>;
  /** OpenClaw webhook token */
  webhookToken: string;
  /** OpenClaw URL（可选） */
  openClawUrl?: string;
}

/**
 * InitService
 * 负责交互式生成配置文件（支持简化配置和完整配置）
 */
export class InitService {
  /**
   * 收集简化配置选项
   */
  async collectSimpleOptions(): Promise<SimpleInitOptions> {
    const projects: SimpleInitOptions['projects'] = [];

    // 1. 添加第一个项目
    console.log('\n📦 配置第一个项目：\n');
    const firstProject = await this.collectProjectInfo();
    projects.push(firstProject);

    // 2. 询问是否添加更多项目
    let addMore = await askConfirm('是否添加更多项目？', false);
    while (addMore) {
      console.log('\n📦 配置下一个项目：\n');
      const nextProject = await this.collectProjectInfo();
      projects.push(nextProject);
      addMore = await askConfirm('是否继续添加项目？', false);
    }

    // 3. 配置 OpenClaw
    console.log('\n🔗 配置 OpenClaw 连接：\n');
    const webhookToken = await askInput(
      'OpenClaw Webhook Token（必填）',
      'your-webhook-token-here'
    );

    const configureUrl = await askConfirm('是否配置 OpenClaw URL？', false);
    let openClawUrl: string | undefined;
    if (configureUrl) {
      openClawUrl = await askInput('OpenClaw URL', 'http://127.0.0.1:18000');
    }

    return {
      projects,
      webhookToken,
      openClawUrl,
    };
  }

  /**
   * 收集单个项目信息
   */
  private async collectProjectInfo(): Promise<SimpleInitOptions['projects'][0]> {
    const key = await askInput('项目标识（key）', 'my-project');
    const path = await askInput('项目路径（绝对路径）', '/path/to/your/project');
    const autoExecute = await askConfirm('是否自动执行任务（不需要审批）？', false);

    let dangerousOps: string[] = [];
    if (!autoExecute) {
      const configureDangerous = await askConfirm(
        '是否配置危险操作关键词（强制审批）？',
        true
      );
      if (configureDangerous) {
        const dangerousOpsInput = await askInput(
          '危险操作关键词（逗号分隔）',
          'delete,drop,rm -rf,truncate'
        );
        dangerousOps = dangerousOpsInput.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    return {
      key,
      path,
      autoExecute,
      dangerousOps,
    };
  }

  /**
   * 生成简化配置 YAML
   */
  generateSimpleManifest(options: SimpleInitOptions): string {
    const manifest: Record<string, unknown> = {
      projects: options.projects.map((p) => ({
        key: p.key,
        path: p.path,
        autoExecute: p.autoExecute,
        ...(p.dangerousOps.length > 0 ? { dangerousOps: p.dangerousOps } : {}),
      })),
      openClaw: {
        webhookToken: options.webhookToken,
        ...(options.openClawUrl ? { url: options.openClawUrl } : {}),
      },
    };

    return yaml.stringify(manifest, {
      indent: 2,
      lineWidth: 0,
    });
  }

  /**
   * 运行交互式配置生成流程（完整配置）
   * @param presetTopology 预设的拓扑类型（来自命令行参数）
   * @returns 生成的 YAML 字符串
   */
  async collectOptions(presetTopology?: string): Promise<InitOptions> {
    // 1. 选择拓扑类型
    const topology = await this.selectTopology(presetTopology);

    // 2. 输入配置名称
    const name = await askInput('请输入配置名称', 'my-clawkit');

    // 3. 是否启用 memory
    const enableMemory = await askConfirm('是否启用 Memory（记忆功能）？', true);

    let memoryProvider: 'local' | 'redis' | 'postgres' = 'local';
    if (enableMemory) {
      memoryProvider = await askSelect(
        '选择 Memory Provider：',
        [
          { label: 'Local', value: 'local', description: '本地文件存储' },
          { label: 'Redis', value: 'redis', description: 'Redis 远程存储' },
          { label: 'PostgreSQL', value: 'postgres', description: 'PostgreSQL 远程存储' },
        ],
      ) as 'local' | 'redis' | 'postgres';
    }

    // 4. 是否启用 notify（占位）
    const enableNotify = await askConfirm('是否启用 Notify（通知功能）？', false);

    return {
      topology,
      name,
      enableMemory,
      memoryProvider,
      enableNotify,
    };
  }

  /**
   * 根据选项生成 manifest YAML 字符串
   */
  generateManifest(options: InitOptions): string {
    const manifest = this.buildManifestObject(options);
    return yaml.stringify(manifest, {
      indent: 2,
      lineWidth: 0, // 不自动换行
    });
  }

  /**
   * 将 YAML 写入文件
   */
  writeToFile(yamlContent: string, outputPath: string): void {
    fs.writeFileSync(outputPath, yamlContent, 'utf-8');
  }

  /**
   * 检查输出文件是否已存在
   */
  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * 选择拓扑类型
   * 如果命令行预设了有效值则直接使用，否则交互选择
   */
  private async selectTopology(preset?: string): Promise<'all-in-one' | 'hybrid' | 'split'> {
    const validTopologies = ['all-in-one', 'hybrid', 'split'] as const;

    if (preset && validTopologies.includes(preset as typeof validTopologies[number])) {
      return preset as typeof validTopologies[number];
    }

    const selected = await askSelect(
      '选择部署拓扑类型：',
      [
        { label: 'All-in-One', value: 'all-in-one', description: '所有组件在同一台机器' },
        { label: 'Hybrid', value: 'hybrid', description: '云端控制面 + 本地执行面' },
        { label: 'Split', value: 'split', description: '控制面与执行面完全分离' },
      ],
    );

    return selected as typeof validTopologies[number];
  }

  /**
   * 根据选项构建 manifest 对象
   * 生成最小可用配置，便于后续手工修改
   */
  private buildManifestObject(options: InitOptions): Record<string, unknown> {
    const manifest: Record<string, unknown> = {};

    // profile
    manifest.profile = {
      name: options.name,
      version: '1.0.0',
      topology: options.topology,
      description: this.getTopologyDescription(options.topology),
    };

    // nodes — 根据拓扑生成最小节点配置
    manifest.nodes = this.buildNodes(options.topology);

    // services — 根据拓扑生成服务配置
    manifest.services = this.buildServices(options.topology);

    // workers — 最小 worker 配置
    manifest.workers = this.buildWorkers(options.topology);

    // runtime
    manifest.runtime = this.buildRuntime(options);

    // notify（占位）
    if (options.enableNotify) {
      manifest.notify = {
        enabled: true,
        channels: ['webhook'],
        webhook: 'https://hooks.example.com/clawkit',
      };
    } else {
      manifest.notify = {
        enabled: false,
        channels: [],
      };
    }

    // deploy — 使用默认值
    manifest.deploy = {
      timeout: 300,
      retryCount: 3,
      healthCheck: {
        enabled: true,
        interval: 30,
      },
    };

    return manifest;
  }

  /**
   * 获取拓扑描述文字
   */
  private getTopologyDescription(topology: string): string {
    const descriptions: Record<string, string> = {
      'all-in-one': '单机部署，所有组件运行在同一台机器上',
      'hybrid': '混合部署，云端控制面 + 本地执行面',
      'split': '分离部署，控制面与执行面分别部署在不同机器',
    };
    return descriptions[topology] || '';
  }

  /**
   * 根据拓扑生成节点配置
   */
  private buildNodes(topology: string): Record<string, unknown> {
    switch (topology) {
      case 'all-in-one':
        return {
          'local-dev': {
            type: 'local',
            workDir: './.clawkit/local-dev',
          },
        };
      case 'hybrid':
        return {
          'cloud-control': {
            type: 'ssh',
            host: 'your-server.example.com',
            port: 22,
            user: 'deploy',
            keyPath: '~/.ssh/id_ed25519',
            workDir: '/srv/clawkit/control',
          },
          'local-dev': {
            type: 'local',
            workDir: './.clawkit/local-dev',
          },
        };
      case 'split':
        return {
          'control-plane': {
            type: 'ssh',
            host: '10.10.0.10',
            port: 22,
            user: 'clawkit',
            keyPath: '~/.ssh/id_ed25519',
            workDir: '/srv/clawkit/control',
          },
          'exec-node': {
            type: 'ssh',
            host: '10.10.0.21',
            port: 22,
            user: 'clawkit',
            keyPath: '~/.ssh/id_ed25519',
            workDir: '/srv/clawkit/worker',
          },
        };
      default:
        return {};
    }
  }

  /**
   * 根据拓扑生成服务配置
   */
  private buildServices(topology: string): Record<string, unknown> {
    switch (topology) {
      case 'all-in-one':
        return {
          controller: {
            node: 'local-dev',
            port: 8787,
            apiPrefix: '/api',
          },
          openClaw: {
            node: 'local-dev',
            publicUrl: 'http://127.0.0.1:18000',
            apiKey: 'replace-me',
          },
        };
      case 'hybrid':
        return {
          controller: {
            node: 'cloud-control',
            port: 8080,
            apiPrefix: '/api',
          },
          openClaw: {
            node: 'cloud-control',
            publicUrl: 'https://your-server.example.com',
            apiKey: 'replace-me',
          },
        };
      case 'split':
        return {
          controller: {
            node: 'control-plane',
            port: 8080,
            apiPrefix: '/api',
          },
          openClaw: {
            node: 'control-plane',
            publicUrl: 'https://openclaw.example.com',
            apiKey: 'replace-me',
          },
        };
      default:
        return {};
    }
  }

  /**
   * 根据拓扑生成 Worker 配置
   */
  private buildWorkers(topology: string): unknown[] {
    switch (topology) {
      case 'all-in-one':
        return [
          {
            id: 'local-worker',
            node: 'local-dev',
            connectMode: 'pull',
            tags: ['local', 'dev'],
            projects: [
              {
                key: 'my-project',
                repoPath: '/path/to/your/project',
                baseBranch: 'main',
                openCode: {
                  port: 9901,
                  agent: 'build',
                  mode: 'default',
                },
              },
            ],
          },
        ];
      case 'hybrid':
        return [
          {
            id: 'local-worker',
            node: 'local-dev',
            connectMode: 'pull',
            tags: ['local', 'hybrid'],
            projects: [
              {
                key: 'my-project',
                repoPath: '/path/to/your/project',
                baseBranch: 'main',
                openCode: {
                  port: 9901,
                  agent: 'build',
                  mode: 'default',
                },
              },
            ],
          },
        ];
      case 'split':
        return [
          {
            id: 'worker-1',
            node: 'exec-node',
            connectMode: 'pull',
            tags: ['prod'],
            projects: [
              {
                key: 'my-project',
                repoPath: '/srv/projects/my-project',
                baseBranch: 'main',
                openCode: {
                  port: 9921,
                  agent: 'build',
                  mode: 'default',
                },
              },
            ],
          },
        ];
      default:
        return [];
    }
  }

  /**
   * 根据选项生成运行时配置
   */
  private buildRuntime(options: InitOptions): Record<string, unknown> {
    const runtime: Record<string, unknown> = {};

    runtime.promptEngine = {
      mode: 'template',
    };

    // memory
    if (options.enableMemory) {
      const memoryConfig: Record<string, unknown> = {
        enabled: true,
        provider: options.memoryProvider,
      };

      if (options.memoryProvider === 'local') {
        memoryConfig.path = './data/memory';
      } else {
        const urlExamples: Record<string, string> = {
          redis: 'redis://localhost:6379/0',
          postgres: 'postgresql://user:password@localhost:5432/clawkit',
        };
        memoryConfig.url = urlExamples[options.memoryProvider];
      }

      runtime.memory = memoryConfig;
    } else {
      // memory 是必填的，给一个禁用状态的最小默认值
      runtime.memory = {
        enabled: false,
        provider: 'local',
        path: './data/memory',
      };
    }

    return runtime;
  }
}
