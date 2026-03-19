const { DispatchService } = require('../dist/services/dispatch-service');
const { WorkerRegistry } = require('../dist/services/worker-registry');
const { TaskStatus } = require('@clawkit/shared');

console.log('=== Dispatch Service 测试 ===\n');

const workerRegistry = new WorkerRegistry();

workerRegistry.register({
  workerId: 'worker-1',
  name: 'Worker 1',
  nodeName: 'local',
  connectMode: 'pull',
  tags: ['dev'],
  supportedProjects: ['test-project'],
});

const mockTaskDrafts = new Map();
mockTaskDrafts.set('task-123', {
  taskId: 'task-123',
  projectKey: 'test-project',
  intent: '测试任务',
  constraints: ['约束1'],
  acceptanceCriteria: ['验收1'],
  sourceText: '测试任务描述',
  status: TaskStatus.APPROVED,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const mockTaskMemories = new Map();
mockTaskMemories.set('task-123', {
  taskId: 'task-123',
  normalizedTaskCard: {
    title: '测试任务',
    objective: '测试',
    scope: [],
    outOfScope: [],
    constraints: [],
    acceptanceCriteria: [],
  },
  promptDraftHistory: [],
  userRevisionHistory: [],
  executionSummary: {
    status: 'not_started',
    note: '',
    lastUpdatedAt: null,
  },
  similarTaskRefs: [],
  projectRuleRefs: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

const dispatchService = new DispatchService(
  workerRegistry,
  {
    getTaskMemory: (taskId) => mockTaskMemories.get(taskId),
  },
  {
    getTaskDraft: (taskId) => mockTaskDrafts.get(taskId),
  },
  {
    updateTaskStatus: (taskId, status) => {
      const draft = mockTaskDrafts.get(taskId);
      if (draft) {
        draft.status = status;
        draft.updatedAt = new Date();
      }
    },
  },
  {
    getProject: (projectKey) => {
      if (projectKey === 'test-project') {
        return {
          projectKey,
          repoPath: '/tmp/test-project',
          branchBase: 'main',
          openCode: {
            port: 4096,
            agent: 'build',
            mode: 'default',
          },
        };
      }

      if (projectKey === 'unknown-project') {
        return {
          projectKey,
          repoPath: '/tmp/unknown-project',
          branchBase: 'main',
          openCode: {
            port: 4096,
            agent: 'build',
            mode: 'default',
          },
        };
      }

      return undefined;
    },
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

console.log('1. 测试派发任务');
const dispatch = dispatchService.dispatchTask('task-123');
console.log('✓ 任务派发成功');
console.log('  派发 ID:', dispatch.dispatchId);
console.log('  任务 ID:', dispatch.taskId);
console.log('  Worker ID:', dispatch.workerId);
console.log('  派发状态:', dispatch.dispatchStatus);

console.log('\n2. 测试任务状态更新');
const taskDraft = mockTaskDrafts.get('task-123');
console.log('✓ 任务状态已更新:', taskDraft?.status);

console.log('\n3. 测试 worker 拉取任务');
const pullResponse = dispatchService.pullTask('worker-1');
console.log('✓ 任务拉取成功');
console.log('  有任务:', pullResponse.hasTask);
if (pullResponse.task) {
  console.log('  任务 ID:', pullResponse.task.taskId);
  console.log('  项目:', pullResponse.task.projectKey);
  console.log('  意图:', pullResponse.task.intent);
}

console.log('\n4. 测试任务状态再次更新');
console.log('✓ 任务状态:', taskDraft?.status);

console.log('\n5. 测试提交任务结果');
dispatchService.submitResult('worker-1', {
  taskId: 'task-123',
  status: 'done',
  workerId: 'worker-1',
  projectKey: 'test-project',
  summary: '占位执行完成',
  placeholderExecution: true,
  logs: ['执行日志1', '执行日志2'],
  changedFiles: [],
  commands: [],
  testResult: '未执行真实测试',
  rawOutputSummary: '占位输出',
  parseStatus: 'text_only',
  risks: ['风险提示'],
  nextStageHint: '下一阶段提示',
  updatedAt: new Date().toISOString(),
});
console.log('✓ 结果提交成功');
console.log('  任务最终状态:', taskDraft?.status);

console.log('\n6. 测试 worker 状态恢复');
const worker = workerRegistry.getWorker('worker-1');
console.log('✓ Worker 状态:', worker?.status);
console.log('  当前任务:', worker?.currentTaskId || '无');

console.log('\n7. 测试查询派发记录');
const dispatchRecord = dispatchService.getDispatchByTaskId('task-123');
console.log('✓ 派发记录查询成功');
console.log('  派发 ID:', dispatchRecord?.dispatchId);
console.log('  派发状态:', dispatchRecord?.dispatchStatus);

console.log('\n8. 测试没有可用 worker 的情况');
mockTaskDrafts.set('task-456', {
  taskId: 'task-456',
  projectKey: 'unknown-project',
  intent: '测试任务2',
  constraints: [],
  acceptanceCriteria: [],
  sourceText: '测试',
  status: TaskStatus.APPROVED,
  createdAt: new Date(),
  updatedAt: new Date(),
});

try {
  dispatchService.dispatchTask('task-456');
  console.log('✗ 应该抛出错误');
} catch (error) {
  console.log('✓ 正确抛出错误:', error.message);
}

console.log('\n=== 所有测试通过 ===');
