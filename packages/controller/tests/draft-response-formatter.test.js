const assert = require('node:assert/strict');

const { TaskStatus } = require('@clawkit/shared');
const { DraftResponseFormatter } = require('../dist/http/services/draft-response-formatter');

function runDraftResponseFormatterTests() {
  const formatter = new DraftResponseFormatter();
  const taskDraft = {
    taskId: 'task-draft-1',
    sourceText: '#研发任务',
    projectKey: 'clawkit',
    intent: '实现 OpenClaw 草稿摘要',
    constraints: ['全部中文'],
    acceptanceCriteria: ['可返回建议回复'],
    status: TaskStatus.WAITING_APPROVAL,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const promptDraft = {
    version: { generation: 1, revision: 0 },
    taskId: 'task-draft-1',
    projectKey: 'clawkit',
    draftText: 'draft',
    summaryView: {
      goal: '实现 OpenClaw 草稿摘要',
      scope: ['controller webhook', '草稿回传'],
      constraints: ['全部中文'],
      acceptanceCriteria: ['可返回建议回复'],
      confirmationChecklist: ['确认任务目标', '确认范围'],
    },
    riskFlags: [],
    createdAt: new Date(),
  };
  const statusSnapshot = {
    taskId: 'task-draft-1',
    projectKey: 'clawkit',
    status: TaskStatus.WAITING_APPROVAL,
    latestPromptDraftSummary: promptDraft.summaryView,
    latestApprovalAction: null,
    userSummary: 'waiting approval',
    readableSummary: {
      title: '任务状态摘要',
      summary: '等待确认',
      details: [],
      suggestedReplies: [],
    },
    nextStageHint: '请继续确认、修改或取消当前草稿',
    executionSummary: null,
  };

  const result = formatter.formatCreated(taskDraft, promptDraft, statusSnapshot, {
    requestId: 'req-draft-1',
    sessionKey: 'session-draft-1',
  });

  assert.equal(result.taskId, 'task-draft-1');
  assert.equal(result.status, TaskStatus.WAITING_APPROVAL);
  assert.equal(result.userMessage.includes('研发任务已创建'), true);
  assert.deepEqual(result.suggestedReplies, [
    '#确认派发 task-draft-1',
    '#修改草案 task-draft-1',
    '#取消任务 task-draft-1',
    '#任务状态 task-draft-1',
  ]);
  assert.equal(result.latestSummary.includes('目标：实现 OpenClaw 草稿摘要'), true);
  assert.equal(result.metadata.phase, 'draft');
  console.log('✓ DraftResponseFormatter：可输出中文草稿摘要与建议回复');
}

module.exports = { runDraftResponseFormatterTests };
