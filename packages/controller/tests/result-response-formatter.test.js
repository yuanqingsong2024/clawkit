const assert = require('node:assert/strict');

const { TaskStatus } = require('@clawkit/shared');
const { ResultResponseFormatter } = require('../dist/http/services/result-response-formatter');

function buildSnapshot(status, executionSummary) {
  return {
    taskId: 'task-result-1',
    projectKey: 'clawkit',
    status,
    latestPromptDraftSummary: null,
    latestApprovalAction: null,
    userSummary: 'summary',
    readableSummary: {
      title: '任务状态摘要',
      summary: '任务状态摘要',
      details: [],
      suggestedReplies: [],
    },
    nextStageHint: '请查询状态',
    executionSummary,
  };
}

function runResultResponseFormatterTests() {
  const formatter = new ResultResponseFormatter();

  const doneResult = formatter.format(buildSnapshot(TaskStatus.DONE, {
    status: 'done',
    note: '执行完成',
    summary: '已完成 webhook 接入与结果回传',
    testResult: '测试通过',
    changedFiles: ['packages/controller/src/http/services/openclaw-adapter.ts'],
    commands: ['pnpm test'],
    lastUpdatedAt: new Date(),
  }), {
    requestId: 'req-result-1',
  });

  assert.equal(doneResult.status, TaskStatus.DONE);
  assert.equal(doneResult.userMessage.includes('任务执行完成'), true);
  assert.equal(doneResult.latestSummary, '已完成 webhook 接入与结果回传');
  assert.deepEqual(doneResult.suggestedReplies, ['#任务状态 task-result-1']);

  const failedResult = formatter.format(buildSnapshot(TaskStatus.FAILED, {
    status: 'failed',
    note: '执行失败',
    summary: 'OpenCode server 不可达',
    testResult: '未执行',
    changedFiles: [],
    commands: [],
    nextStageHint: '请先启动 opencode serve',
    lastUpdatedAt: new Date(),
  }), {
    requestId: 'req-result-2',
  });

  assert.equal(failedResult.status, TaskStatus.FAILED);
  assert.equal(failedResult.userMessage.includes('任务执行失败'), true);
  assert.equal(failedResult.userMessage.includes('请先启动 opencode serve'), true);
  assert.equal(failedResult.metadata.phase, 'failed');
  console.log('✓ ResultResponseFormatter：可输出完成与失败两类中文结果摘要');
}

module.exports = { runResultResponseFormatterTests };
