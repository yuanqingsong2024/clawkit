import * as path from 'path';
import { ControllerFlowServiceImpl } from '../../services/controller-flow-service';
import { DispatchService } from '../../services/dispatch-service';
import { PromptCompilerImpl } from '../../services/prompt-compiler';
import { ProjectRegistry } from '../../services/project-registry';
import { WorkerRegistry } from '../../services/worker-registry';
import { SqliteTaskStore } from '../../persistence/sqlite-task-store';
import { ControllerApiService } from './controller-api-service';
import { OpenClawAdapter } from './openclaw-adapter';
import { SetupManifestService } from './setup-manifest-service';
import { SetupOrchestrator } from './setup-orchestrator';
import { SetupRunService } from './setup-run-service';
import { SetupStreamService } from './setup-stream-service';
import { WebConsoleService } from './web-console-service';
export class ServiceContainer {
  readonly workerRegistry: WorkerRegistry;
  readonly dispatchService: DispatchService;
  readonly flowService: ControllerFlowServiceImpl;
  readonly apiService: ControllerApiService;

  readonly openClawAdapter: OpenClawAdapter;

  readonly projectRegistry: ProjectRegistry;
  readonly promptCompiler: PromptCompilerImpl;
  readonly webConsoleService: WebConsoleService;
  readonly setupManifestService: SetupManifestService;
  readonly setupStreamService: SetupStreamService;
  readonly setupRunService: SetupRunService;
  readonly setupOrchestrator: SetupOrchestrator;
  readonly taskStore: SqliteTaskStore | null;

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
    this.projectRegistry = new ProjectRegistry();
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
    this.openClawAdapter = new OpenClawAdapter(this.apiService);
    this.webConsoleService = new WebConsoleService(
      this.apiService,
      this.workerRegistry,
      this.dispatchService,
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
  }
}
