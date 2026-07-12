const { DispatchService } = require('../dist/services/dispatch-service');
const { WorkerRegistry } = require('../dist/services/worker-registry');
const { TaskStatus } = require('@clawkit/shared');

console.log('=== 无可用 Worker 错误测试 ===\n');

const workerRegistry = new WorkerRegistry();

workerRegistry.register({
  workerId: 'worker-1',
  name: 'Worker 1',
  nodeName: 'local',
  connectMode: 'pull',
  tags: ['dev'],
  supportedProjects: ['project-a'],
});

const mockTaskDrafts = new Map();
mockTaskDrafts.set('task-unknown', {
  taskId: 'task-unknown',
  projectKey: 'unknown-project',
  intent: '测试任务',
  constraints: [],
  acceptanceCriteria: [],
  sourceText: '测试',
  status: TaskStatus.APPROVED,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const dispatchService = new DispatchService(
  workerRegistry,
  { getTaskMemory: () => null },
  { getTaskDraft: (taskId) => mockTaskDrafts.get(taskId) },
  { updateTaskStatus: () => {} },
  {
    getProject: (projectKey) => ({
      projectKey,
      repoPath: '/tmp/unknown-project',
      branchBase: 'main',
      openCode: {
        port: 4096,
        agent: 'build',
        mode: 'default',
      },
    }),
  },
  {
    compileExecutionPrompt: () => ({
      executionVersion: '# 执行版 prompt',
      outputContract: {
        completionChecklist: ['完成清单'],
        modifiedFiles: ['改动文件列表'],
        executionCommands: ['执行命令'],
        testResults: ['测试结果'],
        risksAndConfirmations: ['风险与待确认项'],
      },
    }),
  },
);

console.log('1. 测试派发到不支持的项目');
try {
  dispatchService.dispatchTask('task-unknown');
  console.log('✗ 应该抛出错误');
  process.exit(1);
} catch (error) {
  if (error.message.includes('controller.no_available_worker')) {
    console.log('✓ 正确抛出错误:', error.message);
  } else {
    console.log('✗ 错误类型不正确:', error.message);
    process.exit(1);
  }
}

console.log('\n=== 测试通过 ===');
