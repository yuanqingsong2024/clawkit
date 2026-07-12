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
import { PipelineService } from '@clawkit/pipeline';

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
        {
          meta: {
            name: 'simple-executor',
            version: '1.0.0',
            type: 'executor',
            description: '简单命令执行器',
            author: 'ClawKit Team',
          },
          source: '@clawkit/plugin-simple-executor',
          installed: false,
          downloads: 100,
          rating: 4.5,
          publishedAt: Date.now() - 86400000 * 30,
          updatedAt: Date.now() - 86400000 * 7,
          keywords: ['executor', 'shell', 'command'],
        },
        {
          meta: {
            name: 'dingtalk-notifier',
            version: '1.0.0',
            type: 'notifier',
            description: '钉钉 Webhook 通知器',
            author: 'ClawKit Team',
          },
          source: '@clawkit/plugin-dingtalk-notifier',
          installed: false,
          downloads: 80,
          rating: 4.2,
          publishedAt: Date.now() - 86400000 * 25,
          updatedAt: Date.now() - 86400000 * 5,
          keywords: ['notifier', 'dingtalk', 'webhook'],
        },
      ],
    });
    console.log('插件市场服务已初始化');

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
