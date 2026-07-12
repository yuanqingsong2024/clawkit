const assert = require('node:assert/strict');

const { TaskStatus } = require('@clawkit/shared');
const { PromptCompilerImpl } = require('../dist');

function run(name, handler) {
  handler();
  console.log(`✓ ${name}`);
}

function runPromptCompilerTests() {
  run('可以编译 TaskDraft 为 CompiledPrompt', () => {
    const compiler = new PromptCompilerImpl();
    const taskDraft = {
      taskId: 'clawkit-test-001',
      sourceText: '#研发任务\n项目: clawkit\n目标: 实现 PromptCompiler',
      projectKey: 'clawkit',
      intent: '实现 PromptCompiler',
      constraints: ['不进行真实模型调用', '全部使用中文'],
      acceptanceCriteria: ['生成摘要版 prompt', '生成执行版 prompt'],
      status: TaskStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const compiled = compiler.compile({ taskDraft, taskMemory: null });

    assert.ok(compiled.summaryVersion);
    assert.ok(compiled.executionVersion);
    assert.ok(compiled.outputContract);
    assert.ok(compiled.summaryVersion.includes('clawkit'));
    assert.ok(compiled.summaryVersion.includes('实现 PromptCompiler'));
    assert.ok(compiled.executionVersion.includes('clawkit'));
    assert.ok(compiled.executionVersion.includes('实现 PromptCompiler'));
  });

  run('摘要版包含项目名和任务目标', () => {
    const compiler = new PromptCompilerImpl();
    const taskDraft = {
      taskId: 'test-002',
      sourceText: '#研发任务',
      projectKey: 'test-project',
      intent: '测试任务',
      constraints: [],
      acceptanceCriteria: [],
      status: TaskStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const compiled = compiler.compile({ taskDraft, taskMemory: null });

    assert.ok(compiled.summaryVersion.includes('test-project'));
    assert.ok(compiled.summaryVersion.includes('测试任务'));
  });

  run('执行版包含输出契约', () => {
    const compiler = new PromptCompilerImpl();
    const taskDraft = {
      taskId: 'test-003',
      sourceText: '#研发任务',
      projectKey: 'test-project',
      intent: '测试任务',
      constraints: ['约束1'],
      acceptanceCriteria: ['验收1'],
      status: TaskStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const compiled = compiler.compile({ taskDraft, taskMemory: null });

    assert.ok(compiled.executionVersion.includes('输出契约'));
    assert.ok(compiled.executionVersion.includes('完成清单'));
    assert.ok(compiled.executionVersion.includes('改动文件列表'));
    assert.ok(compiled.executionVersion.includes('执行命令'));
    assert.ok(compiled.executionVersion.includes('测试结果'));
    assert.ok(compiled.executionVersion.includes('风险与待确认项'));
  });

  run('输出契约包含固定字段', () => {
    const compiler = new PromptCompilerImpl();
    const taskDraft = {
      taskId: 'test-004',
      sourceText: '#研发任务',
      projectKey: 'test-project',
      intent: '测试任务',
      constraints: [],
      acceptanceCriteria: [],
      status: TaskStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const compiled = compiler.compile({ taskDraft, taskMemory: null });
    const contract = compiled.outputContract;

    assert.ok(Array.isArray(contract.completionChecklist));
    assert.ok(Array.isArray(contract.modifiedFiles));
    assert.ok(Array.isArray(contract.executionCommands));
    assert.ok(Array.isArray(contract.testResults));
    assert.ok(Array.isArray(contract.risksAndConfirmations));
    assert.ok(contract.completionChecklist.length > 0);
  });

  run('带 TaskMemory 时包含范围信息', () => {
    const compiler = new PromptCompilerImpl();
    const taskDraft = {
      taskId: 'test-005',
      sourceText: '#研发任务',
      projectKey: 'test-project',
      intent: '测试任务',
      constraints: ['约束1'],
      acceptanceCriteria: ['验收1'],
      status: TaskStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskMemory = {
      taskId: 'test-005',
      normalizedTaskCard: {
        title: '测试任务',
        objective: '测试任务',
        scope: ['范围1', '范围2'],
        outOfScope: ['不做的事情'],
        constraints: ['约束1'],
        acceptanceCriteria: ['验收1'],
      },
      promptDraftHistory: [],
      userRevisionHistory: [],
      executionSummary: null,
      similarTaskRefs: [],
      projectRuleRefs: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const compiled = compiler.compile({ taskDraft, taskMemory });

    assert.ok(compiled.summaryVersion.includes('范围1'));
    assert.ok(compiled.summaryVersion.includes('范围2'));
    assert.ok(compiled.summaryVersion.includes('不做的事情'));
    assert.ok(compiled.executionVersion.includes('范围1'));
    assert.ok(compiled.executionVersion.includes('不做的事情'));
  });
}

module.exports = {
  runPromptCompilerTests,
};
