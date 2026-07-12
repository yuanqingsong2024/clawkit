const assert = require('node:assert/strict');

const { TaskStatus } = require('@clawkit/shared');
const { OpenClawAdapter } = require('../dist/http/services/openclaw-adapter');

async function runOpenClawAdapterTests() {
  const previousToken = process.env.OPENCLAW_WEBHOOK_TOKEN;
  process.env.OPENCLAW_WEBHOOK_TOKEN = 'test-openclaw-token';

  try {
    const adapter = new OpenClawAdapter({
      async ingestTaskText(text) {
        assert.equal(text.includes('#研发任务'), true);
        return {
          taskDraft: {
            taskId: 'task-adapter-1',
            sourceText: text,
            projectKey: 'clawkit',
            intent: '测试 OpenClawAdapter',
            constraints: ['全部中文'],
            acceptanceCriteria: ['返回结构化摘要'],
            status: TaskStatus.WAITING_APPROVAL,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          promptDraft: {
            version: { generation: 1, revision: 0 },
            taskId: 'task-adapter-1',
            projectKey: 'clawkit',
            draftText: 'draft',
            summaryView: {
              goal: '测试 OpenClawAdapter',
              scope: ['webhook'],
              constraints: ['全部中文'],
              acceptanceCriteria: ['返回结构化摘要'],
              confirmationChecklist: ['确认目标'],
            },
            riskFlags: [],
            createdAt: new Date(),
          },
          status: {
            taskId: 'task-adapter-1',
            projectKey: 'clawkit',
            status: TaskStatus.WAITING_APPROVAL,
            latestPromptDraftSummary: {
              goal: '测试 OpenClawAdapter',
              scope: ['webhook'],
              constraints: ['全部中文'],
              acceptanceCriteria: ['返回结构化摘要'],
              confirmationChecklist: ['确认目标'],
            },
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
          },
        };
      },
    });

    const response = await adapter.handleWebhook({
      source: 'openclaw',
      message: '#研发任务\n项目: clawkit\n目标: 测试 OpenClawAdapter\n约束: 全部中文\n验收: 返回结构化摘要',
      operator: {
        id: 'tester',
        name: '测试用户',
      },
      sessionKey: 'session-adapter-1',
    }, 'Bearer test-openclaw-token');

    assert.equal(response.success, true);
    assert.equal(response.code, 'controller.openclaw.webhook.draft_ready');
    assert.equal(response.data.taskId, 'task-adapter-1');
    assert.equal(response.data.userMessage.includes('研发任务已创建'), true);
    assert.equal(response.data.metadata.sessionKey, 'session-adapter-1');
    console.log('✓ OpenClawAdapter：可将 webhook 文本请求转换为内部任务并返回摘要');
  } finally {
    if (previousToken === undefined) {
      delete process.env.OPENCLAW_WEBHOOK_TOKEN;
    } else {
      process.env.OPENCLAW_WEBHOOK_TOKEN = previousToken;
    }
  }
}

module.exports = { runOpenClawAdapterTests };
