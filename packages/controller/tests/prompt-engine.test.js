const assert = require('node:assert/strict');

const { TaskStatus } = require('@clawkit/shared');
const { TemplatePromptEngine } = require('../dist');

function run(name, handler) {
  handler();
  console.log(`✓ ${name}`);
}

function runPromptEngineTests() {
  run('TemplatePromptEngine 可以生成 PromptDraft', async () => {
    const engine = new TemplatePromptEngine();
    const taskDraft = {
      taskId: 'clawkit-test-001',
      sourceText: '#研发任务\n项目: clawkit\n目标: 测试 PromptEngine',
      projectKey: 'clawkit',
      intent: '测试 PromptEngine',
      constraints: ['不进行真实模型调用'],
      acceptanceCriteria: ['生成 PromptDraft'],
      status: TaskStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const promptDraft = await engine.buildPromptDraft({
      taskDraft,
      taskMemory: null,
    });

    assert.equal(promptDraft.taskId, 'clawkit-test-001');
    assert.equal(promptDraft.projectKey, 'clawkit');
    assert.ok(promptDraft.draftText);
    assert.ok(promptDraft.summaryView);
    assert.ok(Array.isArray(promptDraft.riskFlags));
    assert.ok(promptDraft.createdAt instanceof Date);
  });

  run('PromptDraft 包含正确的版本号', async () => {
    const engine = new TemplatePromptEngine();
    const taskDraft = {
      taskId: 'test-002',
      sourceText: '#研发任务',
      projectKey: 'test-project',
      intent: '测试版本号',
      constraints: [],
      acceptanceCriteria: [],
      status: TaskStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const promptDraft = await engine.buildPromptDraft({
      taskDraft,
      taskMemory: null,
    });

    assert.equal(promptDraft.version.generation, 1);
    assert.equal(promptDraft.version.revision, 0);
  });

  run('PromptDraft.summaryView 包含必要字段', async () => {
    const engine = new TemplatePromptEngine();
    const taskDraft = {
      taskId: 'test-003',
      sourceText: '#研发任务',
      projectKey: 'test-project',
      intent: '测试 summaryView',
      constraints: ['约束1', '约束2'],
      acceptanceCriteria: ['验收1', '验收2'],
      status: TaskStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const promptDraft = await engine.buildPromptDraft({
      taskDraft,
      taskMemory: null,
    });

    const view = promptDraft.summaryView;
    assert.equal(view.goal, '测试 summaryView');
    assert.ok(Array.isArray(view.scope));
    assert.ok(view.scope.length > 0);
    assert.deepEqual(view.constraints, ['约束1', '约束2']);
    assert.deepEqual(view.acceptanceCriteria, ['验收1', '验收2']);
    assert.ok(Array.isArray(view.confirmationChecklist));
    assert.ok(view.confirmationChecklist.length > 0);
  });

  run('可以识别风险标记', async () => {
    const engine = new TemplatePromptEngine();
    const taskDraft = {
      taskId: 'test-004',
      sourceText: '#研发任务',
      projectKey: 'test-project',
      intent: '测试风险标记',
      constraints: [],
      acceptanceCriteria: [],
      status: TaskStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const promptDraft = await engine.buildPromptDraft({
      taskDraft,
      taskMemory: null,
    });

    // 没有验收标准应该有 acceptance_unclear 标记
    assert.ok(promptDraft.riskFlags.includes('acceptance_unclear'));
    // 没有 taskMemory 应该有 missing_context 标记
    assert.ok(promptDraft.riskFlags.includes('missing_context'));
  });

  run('带 TaskMemory 时版本号递增', async () => {
    const engine = new TemplatePromptEngine();
    const taskDraft = {
      taskId: 'test-005',
      sourceText: '#研发任务',
      projectKey: 'test-project',
      intent: '测试版本递增',
      constraints: [],
      acceptanceCriteria: [],
      status: TaskStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskMemory = {
      taskId: 'test-005',
      normalizedTaskCard: {
        title: '测试版本递增',
        objective: '测试版本递增',
        scope: ['范围1'],
        outOfScope: [],
        constraints: [],
        acceptanceCriteria: [],
      },
      promptDraftHistory: [
        {
          version: { generation: 1, revision: 0 },
          summary: '首次生成',
          createdAt: new Date(),
        },
      ],
      userRevisionHistory: [],
      executionSummary: null,
      similarTaskRefs: [],
      projectRuleRefs: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const promptDraft = await engine.buildPromptDraft({
      taskDraft,
      taskMemory,
    });

    assert.equal(promptDraft.version.generation, 1);
    assert.equal(promptDraft.version.revision, 1);
  });

  run('draftText 包含执行版 prompt 内容', async () => {
    const engine = new TemplatePromptEngine();
    const taskDraft = {
      taskId: 'test-006',
      sourceText: '#研发任务',
      projectKey: 'test-project',
      intent: '测试 draftText',
      constraints: ['约束1'],
      acceptanceCriteria: ['验收1'],
      status: TaskStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const promptDraft = await engine.buildPromptDraft({
      taskDraft,
      taskMemory: null,
    });

    assert.ok(promptDraft.draftText.includes('test-project'));
    assert.ok(promptDraft.draftText.includes('测试 draftText'));
    assert.ok(promptDraft.draftText.includes('约束1'));
    assert.ok(promptDraft.draftText.includes('验收1'));
    assert.ok(promptDraft.draftText.includes('输出契约'));
  });
}

module.exports = {
  runPromptEngineTests,
};
