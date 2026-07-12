const assert = require('node:assert/strict');

const { TaskStatus } = require('@clawkit/shared');
const { ControllerFlowServiceImpl } = require('../dist');
const { DispatchService } = require('../dist/services/dispatch-service');
const { WorkerRegistry } = require('../dist/services/worker-registry');

async function runExecutionStatusTests() {
  const flowService = new ControllerFlowServiceImpl();
  const workerRegistry = new WorkerRegistry();

  workerRegistry.register({
    workerId: 'worker-status-1',
    name: 'Worker Status 1',
    nodeName: 'local',
    connectMode: 'pull',
    tags: ['test'],
    supportedProjects: ['clawkit'],
  });

  const draftResult = flowService.createDraftFromText(`#研发任务\n项目: clawkit\n目标: 验证真实执行摘要写回\n约束: 不做自动部署\n验收: 查询状态可看到真实摘要`);
  await flowService.generatePromptDraft(draftResult.taskDraft.taskId);
  flowService.approveDraft({
    taskId: draftResult.taskDraft.taskId,
    operator: '测试审批人',
  });

  const dispatchService = new DispatchService(
    workerRegistry,
    {
      getTaskMemory: (taskId) => flowService.inspectTask(taskId).taskMemory,
    },
    {
      getTaskDraft: (taskId) => flowService.inspectTask(taskId).taskDraft,
    },
    {
      updateTaskStatus: (taskId, status) => {
        const taskDraft = flowService.inspectTask(taskId).taskDraft;
        taskDraft.status = status;
        taskDraft.updatedAt = new Date();
      },
    },
    {
      getProject: () => ({
        projectKey: 'clawkit',
        repoPath: process.cwd(),
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

  dispatchService.dispatchTask(draftResult.taskDraft.taskId);
  dispatchService.pullTask('worker-status-1');
  dispatchService.submitResult('worker-status-1', {
    taskId: draftResult.taskDraft.taskId,
    workerId: 'worker-status-1',
    projectKey: 'clawkit',
    status: 'done',
    summary: '真实执行完成：已写回执行摘要',
    placeholderExecution: false,
    logs: ['执行完成'],
    changedFiles: ['packages/worker/src/executors/open-code-executor.ts'],
    commands: ['pnpm build'],
    testResult: '构建通过；测试通过',
    rawOutputSummary: '## 完成清单\n- 真实执行完成',
    parseStatus: 'structured',
    risks: ['无'],
    updatedAt: new Date().toISOString(),
  });

  const status = flowService.getTaskStatus(draftResult.taskDraft.taskId);

  assert.equal(status.status, TaskStatus.DONE);
  assert.equal(status.executionSummary?.summary, '真实执行完成：已写回执行摘要');
  assert.equal(status.executionSummary?.testResult, '构建通过；测试通过');
  assert.equal(status.readableSummary.summary.includes('真实执行完成'), true);
  assert.deepEqual(status.readableSummary.suggestedReplies, [`#任务状态 ${draftResult.taskDraft.taskId}`]);

  console.log('✓ controller 状态查询：执行完成后展示真实执行摘要');
}

module.exports = { runExecutionStatusTests };
