import * as path from 'path';
import { ControllerFlowServiceImpl } from '../../services/controller-flow-service';
import { DispatchService } from '../../services/dispatch-service';
import { PromptCompilerImpl } from '../../services/prompt-compiler';
import { ProjectRegistry } from '../../services/project-registry';
import { ManifestManager } from '../../services/manifest-manager';
import { WorkerRegistry } from '../../services/worker-registry';
import { ConfigReloader, createConfigReloader } from '../../services/config-reloader';
import { LoadBalancerService } from '../../services/load-balancer.service';
import type { LoadBalancerConfig } from '../../services/load-balancer.interface';
import { SqliteTaskStore } from '../../persistence/sqlite-task-store';
import { ControllerApiService } from './controller-api-service';
import { ClaudeCodeAdapter } from './claude-code-adapter';
import { SetupManifestService } from './setup-manifest-service';
import { SetupOrchestrator } from './setup-orchestrator';
import { SetupRunService } from './setup-run-service';
import { SetupStreamService } from './setup-stream-service';
import { WebConsoleService } from './web-console-service';
import { ControllerConfigService } from './controller-config-service';
import { RuntimeService } from './runtime-service';
import { PluginMarketplaceService, createMarketplaceService } from '../../services/plugin-marketplace.service';
import { PipelineService } from '../../services/pipeline-service';

export class ServiceContainer {
  readonly workerRegistry: WorkerRegistry;
  readonly dispatchService: DispatchService;
  readonly flowService: ControllerFlowServiceImpl;
  readonly apiService: ControllerApiService;
  readonly openClawAdapter: ClaudeCodeAdapter;
  readonly controllerConfigService: ControllerConfigService;
  readonly projectRegistry: ProjectRegistry;
  readonly manifestManager: ManifestManager | null;
  readonly promptCompiler: PromptCompilerImpl;
  readonly webConsoleService: WebConsoleService;
  readonly setupManifestService: SetupManifestService;
  readonly setupStreamService: SetupStreamService;
  readonly setupRunService: SetupRunService;
  readonly setupOrchestrator: SetupOrchestrator;
  readonly taskStore: SqliteTaskStore | null;
  readonly configReloader: ConfigReloader | null;
  readonly runtimeService: RuntimeService;
  readonly loadBalancerService: LoadBalancerService;
  readonly marketplaceService: PluginMarketplaceService;
  readonly pipelineService: PipelineService;

  constructor() {
    const dbPath = process.env.CONTROLLER_DB_PATH ?? path.join(process.cwd(), 'data', 'clawkit.db');
    const enablePersistence = process.env.CONTROLLER_ENABLE_PERSISTENCE !== 'false';
    
    this.taskStore = enablePersistence ? new SqliteTaskStore(dbPath) : null;
    
    if (this.taskStore) {
      console.log(`Controller 持久化已启用：${dbPath}`);
    } else {
      console.log('Controller 持久化已禁用（内存模式）');
    }
    
    this.flowService = new ControllerFlowServiceImpl({
      taskStore: this.taskStore ?? undefined,
    });
    this.workerRegistry = new WorkerRegistry();
    this.controllerConfigService = new ControllerConfigService();
    const manifestPath = this.controllerConfigService.getConfig().manifestPath;
    
    this.projectRegistry = new ProjectRegistry({
      manifestPath: manifestPath ?? undefined,
    });
    
    // 初始化 ManifestManager（仅在有 manifestPath 时）
    this.manifestManager = manifestPath ? new ManifestManager({ manifestPath }) : null;
    
    this.promptCompiler = new PromptCompilerImpl();
    this.dispatchService = new DispatchService(
      this.workerRegistry,
      {
        getTaskMemory: (taskId: string) => this.flowService.inspectTask(taskId).taskMemory,
      },
      {
        getTaskDraft: (taskId: string) => this.flowService.inspectTask(taskId).taskDraft,
      },
      {
        updateTaskStatus: (taskId: string, status) => {
          const taskDraft = this.flowService.inspectTask(taskId).taskDraft;
          taskDraft.status = status;
          taskDraft.updatedAt = new Date();
        },
      },
      this.projectRegistry,
      {
        compileExecutionPrompt: (taskId: string) => {
          const inspected = this.flowService.inspectTask(taskId);
          const compiled = this.promptCompiler.compile({
            taskDraft: inspected.taskDraft,
            taskMemory: inspected.taskMemory,
          });

          return {
            executionVersion: compiled.executionVersion,
            outputContract: compiled.outputContract,
          };
        },
      },
    );
    this.apiService = new ControllerApiService(this.flowService, this.dispatchService, this.workerRegistry);
    this.openClawAdapter = new ClaudeCodeAdapter(this.apiService);
    this.webConsoleService = new WebConsoleService(
      this.apiService,
      this.workerRegistry,
      this.dispatchService,
      this.controllerConfigService,
      this.projectRegistry,
    );
    this.setupManifestService = new SetupManifestService();
    this.setupStreamService = new SetupStreamService();
    this.setupRunService = new SetupRunService(this.setupStreamService, this.taskStore);
    this.setupOrchestrator = new SetupOrchestrator(
      this.setupManifestService,
      this.setupRunService,
      this.webConsoleService,
      this.workerRegistry,
    );
    this.runtimeService = new RuntimeService(this.flowService, this.dispatchService, this.workerRegistry, {
      productionDispatchEnabled: false,
    });

    // 初始化负载均衡服务
    const loadBalancerConfig: LoadBalancerConfig = {
      strategy: process.env.LOAD_BALANCER_STRATEGY as LoadBalancerConfig['strategy'] ?? 'least-load',
      enableProjectAffinity: process.env.LOAD_BALANCER_ENABLE_PROJECT_AFFINITY !== 'false',
      maxRetries: parseInt(process.env.LOAD_BALANCER_MAX_RETRIES ?? '3', 10),
      heartbeatTimeoutMs: parseInt(process.env.LOAD_BALANCER_HEARTBEAT_TIMEOUT ?? '30000', 10),
    };
    this.loadBalancerService = new LoadBalancerService(loadBalancerConfig, this.workerRegistry);
    console.log(`负载均衡服务已初始化：策略=${loadBalancerConfig.strategy}, 项目亲和性=${loadBalancerConfig.enableProjectAffinity}`);

    // 将负载均衡服务注入到 DispatchService
    this.dispatchService.setLoadBalancerService(this.loadBalancerService);

    // 初始化插件市场服务
    this.marketplaceService = createMarketplaceService({
      dataDir: path.join(process.cwd(), 'data', 'marketplace'),
      pluginsDir: path.join(process.cwd(), 'plugins'),
      registryFile: 'registry.json',
      officialPlugins: [
        // ===== 执行器插件 =====
        {
          meta: {
            name: 'simple-executor',
            version: '1.0.0',
            type: 'executor',
            description: '简单命令执行器，支持执行 Shell 命令和脚本',
            author: 'ClawKit Team',
          },
          source: '@clawkit/plugin-simple-executor',
          installed: false,
          downloads: 1250,
          rating: 4.8,
          publishedAt: Date.now() - 86400000 * 90,
          updatedAt: Date.now() - 86400000 * 7,
          keywords: ['executor', 'shell', 'command', 'bash'],
        },
        {
          meta: {
            name: 'code-review',
            version: '1.2.0',
            type: 'executor',
            description: '代码审查插件，自动检查代码质量和安全问题',
            author: 'ClawKit Team',
          },
          source: '@clawkit/plugin-code-review',
          installed: false,
          downloads: 890,
          rating: 4.6,
          publishedAt: Date.now() - 86400000 * 60,
          updatedAt: Date.now() - 86400000 * 3,
          keywords: ['executor', 'code-review', 'lint', 'eslint'],
        },
        {
          meta: {
            name: 'git-commit',
            version: '1.0.0',
            type: 'executor',
            description: '智能 Git 提交插件，根据代码变更生成规范提交信息',
            author: 'ClawKit Team',
          },
          source: '@clawkit/plugin-git-commit',
          installed: false,
          downloads: 650,
          rating: 4.5,
          publishedAt: Date.now() - 86400000 * 45,
          updatedAt: Date.now() - 86400000 * 10,
          keywords: ['executor', 'git', 'commit', 'conventional'],
        },
        {
          meta: {
            name: 'unit-test-generator',
            version: '2.0.0',
            type: 'executor',
            description: '自动生成单元测试，支持 Jest、Mocha 等测试框架',
            author: 'ClawKit Team',
          },
          source: '@clawkit/plugin-unit-test',
          installed: false,
          downloads: 780,
          rating: 4.4,
          publishedAt: Date.now() - 86400000 * 30,
          updatedAt: Date.now() - 86400000 * 2,
          keywords: ['executor', 'testing', 'jest', 'unit-test'],
        },
        {
          meta: {
            name: 'doc-generator',
            version: '1.5.0',
            type: 'executor',
            description: '自动生成 API 文档和代码注释，支持 Swagger、JSDoc',
            author: 'ClawKit Team',
          },
          source: '@clawkit/plugin-doc-generator',
          installed: false,
          downloads: 520,
          rating: 4.3,
          publishedAt: Date.now() - 86400000 * 25,
          updatedAt: Date.now() - 86400000 * 5,
          keywords: ['executor', 'documentation', 'swagger', 'jsdoc'],
        },
        {
          meta: {
            name: 'docker-deploy',
            version: '1.1.0',
            type: 'executor',
            description: 'Docker 容器化部署插件，支持构建镜像和容器管理',
            author: 'ClawKit Team',
          },
          source: '@clawkit/plugin-docker-deploy',
          installed: false,
          downloads: 430,
          rating: 4.7,
          publishedAt: Date.now() - 86400000 * 20,
          updatedAt: Date.now() - 86400000 * 1,
          keywords: ['executor', 'docker', 'deploy', 'container'],
        },
        // ===== 触发器插件 =====
        {
          meta: {
            name: 'webhook-trigger',
            version: '1.0.0',
            type: 'trigger',
            description: 'Webhook 触发器，通过 HTTP 请求触发流水线执行',
            author: 'ClawKit Team',
          },
          source: '@clawkit/plugin-webhook-trigger',
          installed: false,
          downloads: 720,
          rating: 4.6,
          publishedAt: Date.now() - 86400000 * 55,
          updatedAt: Date.now() - 86400000 * 8,
          keywords: ['trigger', 'webhook', 'http', 'api'],
        },
        {
          meta: {
            name: 'schedule-trigger',
            version: '1.2.0',
            type: 'trigger',
            description: '定时触发器，支持 Cron 表达式定义执行计划',
            author: 'ClawKit Team',
          },
          source: '@clawkit/plugin-schedule-trigger',
          installed: false,
          downloads: 580,
          rating: 4.5,
          publishedAt: Date.now() - 86400000 * 40,
          updatedAt: Date.now() - 86400000 * 4,
          keywords: ['trigger', 'schedule', 'cron', 'timer'],
        },
        {
          meta: {
            name: 'git-trigger',
            version: '1.0.0',
            type: 'trigger',
            description: 'Git 事件触发器，在 push、PR、merge 时触发流水线',
            author: 'ClawKit Team',
          },
          source: '@clawkit/plugin-git-trigger',
          installed: false,
          downloads: 490,
          rating: 4.4,
          publishedAt: Date.now() - 86400000 * 35,
          updatedAt: Date.now() - 86400000 * 6,
          keywords: ['trigger', 'git', 'github', 'webhook'],
        },
        {
          meta: {
            name: 'file-watch-trigger',
            version: '1.0.0',
            type: 'trigger',
            description: '文件监控触发器，文件变更时自动触发任务',
            author: 'ClawKit Team',
          },
          source: '@clawkit/plugin-file-watch-trigger',
          installed: false,
          downloads: 350,
          rating: 4.2,
          publishedAt: Date.now() - 86400000 * 15,
          updatedAt: Date.now() - 86400000 * 3,
          keywords: ['trigger', 'watch', 'file', 'chokidar'],
        },
        // ===== 通知器插件 =====
        {
          meta: {
            name: 'dingtalk-notifier',
            version: '1.0.0',
            type: 'notifier',
            description: '钉钉 Webhook 通知器，向钉钉群发送任务状态通知',
            author: 'ClawKit Team',
          },
          source: '@clawkit/plugin-dingtalk-notifier',
          installed: false,
          downloads: 820,
          rating: 4.7,
          publishedAt: Date.now() - 86400000 * 70,
          updatedAt: Date.now() - 86400000 * 5,
          keywords: ['notifier', 'dingtalk', 'webhook', 'notification'],
        },
        {
          meta: {
            name: 'feishu-notifier',
            version: '1.0.0',
            type: 'notifier',
            description: '飞书 Webhook 通知器，向飞书群发送消息通知',
            author: 'ClawKit Team',
          },
          source: '@clawkit/plugin-feishu-notifier',
          installed: false,
          downloads: 680,
          rating: 4.6,
          publishedAt: Date.now() - 86400000 * 50,
          updatedAt: Date.now() - 86400000 * 7,
          keywords: ['notifier', 'feishu', 'lark', 'webhook'],
        },
        {
          meta: {
            name: 'email-notifier',
            version: '1.0.0',
            type: 'notifier',
            description: '邮件通知器，支持 SMTP 发送任务结果邮件',
            author: 'ClawKit Team',
          },
          source: '@clawkit/plugin-email-notifier',
          installed: false,
          downloads: 420,
          rating: 4.3,
          publishedAt: Date.now() - 86400000 * 28,
          updatedAt: Date.now() - 86400000 * 12,
          keywords: ['notifier', 'email', 'smtp', 'mail'],
        },
        {
          meta: {
            name: 'slack-notifier',
            version: '1.0.0',
            type: 'notifier',
            description: 'Slack Webhook 通知器，向 Slack 频道发送通知',
            author: 'ClawKit Team',
          },
          source: '@clawkit/plugin-slack-notifier',
          installed: false,
          downloads: 560,
          rating: 4.5,
          publishedAt: Date.now() - 86400000 * 38,
          updatedAt: Date.now() - 86400000 * 9,
          keywords: ['notifier', 'slack', 'webhook', 'notification'],
        },
        {
          meta: {
            name: 'wecom-notifier',
            version: '1.0.0',
            type: 'notifier',
            description: '企业微信 Webhook 通知器，向企业微信群发送消息',
            author: 'ClawKit Team',
          },
          source: '@clawkit/plugin-wecom-notifier',
          installed: false,
          downloads: 380,
          rating: 4.4,
          publishedAt: Date.now() - 86400000 * 22,
          updatedAt: Date.now() - 86400000 * 6,
          keywords: ['notifier', 'wecom', 'wechat', 'webhook'],
        },
      ],
    });
    console.log(`插件市场服务已初始化，共 ${this.marketplaceService.getAllPlugins().length} 个插件`);

    // 初始化配置热重载（仅在有 manifestPath 时）
    if (this.manifestManager) {
      this.configReloader = createConfigReloader(
        manifestPath!,
        this.manifestManager,
        this.projectRegistry,
        this.workerRegistry,
      );
      // 注册配置变更监听
      this.configReloader.addListener({
        onConfigChange: (manifestPath: string) => {
          console.log(`[ConfigReloader] 配置已自动重载: ${manifestPath}`);
        },
      });
      // 启动文件监听
      this.configReloader.start();
      console.log('Controller 配置热重载已启用');
    } else {
      this.configReloader = null;
      console.log('Controller 配置热重载已禁用（未配置 manifestPath）');
    }

    // 初始化流水线服务
    this.pipelineService = new PipelineService();
    console.log('Pipeline 服务已初始化');
  }

  /**
   * 手动触发配置重载
   */
  async reloadConfig(): Promise<void> {
    if (this.configReloader) {
      await this.configReloader.reload();
    } else {
      throw new Error('配置热重载未启用');
    }
  }

  /**
   * 停止所有服务
   */
  async dispose(): Promise<void> {
    if (this.configReloader) {
      this.configReloader.stop();
    }
    if (this.taskStore) {
      await this.taskStore.close();
    }
  }
}
