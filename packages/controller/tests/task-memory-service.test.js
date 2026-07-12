const assert = require('node:assert/strict');

const { TaskStatus } = require('@clawkit/shared');
const { TaskMemoryServiceImpl } = require('../dist');

function run(name, handler) {
  handler();
  console.log(`✓ ${name}`);
}

function runTaskMemoryServiceTests() {
  run('可以从 TaskDraft 初始化 TaskMemory', () => {
    const service = new TaskMemoryServiceImpl();
    const draft = {
      taskId: 'clawkit-test-001',
      sourceText: '#研发任务\n项目: clawkit\n目标: 实现任务记忆服务',
      projectKey: 'clawkit',
      intent: '实现任务记忆服务',
      constraints: ['不进入真实派发', '保持最小可用'],
      acceptanceCriteria: ['可初始化记忆', '可更新标准化卡片'],
      status: TaskStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const memory = service.initializeFromDraft(draft);

    assert.equal(memory.taskId, 'clawkit-test-001');
    assert.equal(memory.normalizedTaskCard.objective, '实现任务记忆服务');
    assert.deepEqual(memory.normalizedTaskCard.constraints, ['不进入真实派发', '保持最小可用']);
    assert.deepEqual(memory.normalizedTaskCard.acceptanceCriteria, ['可初始化记忆', '可更新标准化卡片']);
    assert.deepEqual(memory.promptDraftHistory, []);
    assert.deepEqual(memory.userRevisionHistory, []);
    assert.deepEqual(memory.executionSummary, {
      status: 'not_started',
      note: '任务已创建，等待派发',
      placeholderExecution: false,
      changedFiles: [],
      commands: [],
      testResult: '尚未执行',
      rawOutputSummary: '',
      parseStatus: 'text_only',
      lastUpdatedAt: null,
    });
    assert.deepEqual(memory.similarTaskRefs, []);
    assert.deepEqual(memory.projectRuleRefs, []);
    assert.ok(memory.createdAt instanceof Date);
    assert.ok(memory.updatedAt instanceof Date);
  });

  run('标准化卡片包含标题和范围', () => {
    const service = new TaskMemoryServiceImpl();
    const draft = {
      taskId: 'clawkit-test-002',
      sourceText: '#研发任务',
      projectKey: 'clawkit',
      intent: '实现一个非常长的任务意图描述，这个描述超过了五十个字符的限制，需要被截断处理这是额外的内容',
      constraints: ['必须使用中文', '不进入真实派发', '保持代码简洁'],
      acceptanceCriteria: [],
      status: TaskStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const memory = service.initializeFromDraft(draft);
    // 标题应该被截断
    assert.ok(memory.normalizedTaskCard.title.length <= 53); // 50 + '...'
    assert.ok(memory.normalizedTaskCard.title.includes('实现一个非常长的任务意图描述'));
    // 范围应该包含意图和正向约束
    assert.ok(memory.normalizedTaskCard.scope.length >= 1);
    assert.ok(memory.normalizedTaskCard.scope.includes(draft.intent));
    assert.ok(memory.normalizedTaskCard.scope.includes('必须使用中文'));
    assert.ok(memory.normalizedTaskCard.scope.includes('保持代码简洁'));
    // 负向约束不应该在范围内
    assert.ok(!memory.normalizedTaskCard.scope.includes('不进入真实派发'));
  });

  run('可以更新标准化卡片', () => {
    const service = new TaskMemoryServiceImpl();
    const draft = {
      taskId: 'clawkit-test-003',
      sourceText: '#研发任务',
      projectKey: 'clawkit',
      intent: '原始意图',
      constraints: [],
      acceptanceCriteria: [],
      status: TaskStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const memory = service.initializeFromDraft(draft);
    const originalUpdatedAt = memory.updatedAt;

    // 等待一小段时间确保时间戳不同
    const newCard = {
      title: '更新后的标题',
      objective: '更新后的目标',
      scope: ['新范围1', '新范围2'],
      outOfScope: ['不做的事情'],
      constraints: ['新约束'],
      acceptanceCriteria: ['新验收标准'],
    };

    const updatedMemory = service.updateNormalizedCard(memory, newCard);

    assert.equal(updatedMemory.taskId, memory.taskId);
    assert.equal(updatedMemory.normalizedTaskCard.title, '更新后的标题');
    assert.equal(updatedMemory.normalizedTaskCard.objective, '更新后的目标');
    assert.deepEqual(updatedMemory.normalizedTaskCard.scope, ['新范围1', '新范围2']);
    assert.deepEqual(updatedMemory.normalizedTaskCard.outOfScope, ['不做的事情']);
    assert.ok(updatedMemory.updatedAt >= originalUpdatedAt);
  });
}

module.exports = {
  runTaskMemoryServiceTests,
};
