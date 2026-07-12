const assert = require('node:assert/strict');

const { TaskStatus } = require('@clawkit/shared');
const { TaskDraftServiceImpl, TaskProtocolCommandType } = require('../dist');

function run(name, handler) {
  handler();
  console.log(`✓ ${name}`);
}

function runTaskDraftServiceTests() {
  run('可以从创建任务协议生成 TaskDraft', () => {
    const service = new TaskDraftServiceImpl();
    const protocol = {
      command: TaskProtocolCommandType.CREATE_TASK,
      projectKey: 'clawkit',
      goal: '实现任务草稿创建服务',
      constraints: ['不进入真实派发', '保持最小可用'],
      acceptanceCriteria: ['协议可转换为 TaskDraft', '生成唯一 taskId'],
      rawText: '#研发任务\n项目: clawkit\n目标: 实现任务草稿创建服务',
    };

    const draft = service.createFromProtocol(protocol);

    assert.equal(draft.projectKey, 'clawkit');
    assert.equal(draft.intent, '实现任务草稿创建服务');
    assert.deepEqual(draft.constraints, ['不进入真实派发', '保持最小可用']);
    assert.deepEqual(draft.acceptanceCriteria, ['协议可转换为 TaskDraft', '生成唯一 taskId']);
    assert.equal(draft.status, TaskStatus.DRAFT);
    assert.equal(draft.sourceText, protocol.rawText);
    assert.ok(draft.taskId.startsWith('clawkit-'));
    assert.ok(draft.createdAt instanceof Date);
    assert.ok(draft.updatedAt instanceof Date);
  });

  run('生成的 taskId 包含项目标识和时间戳', () => {
    const service = new TaskDraftServiceImpl();
    const protocol = {
      command: TaskProtocolCommandType.CREATE_TASK,
      projectKey: 'test-project',
      goal: '测试任务',
      constraints: [],
      acceptanceCriteria: [],
      rawText: '#研发任务\n项目: test-project\n目标: 测试任务',
    };

    const draft = service.createFromProtocol(protocol);

    assert.ok(draft.taskId.startsWith('test-project-'));
    const parts = draft.taskId.split('-');
    assert.ok(parts.length >= 3);
  });

  run('多次调用生成不同的 taskId', () => {
    const service = new TaskDraftServiceImpl();
    const protocol = {
      command: TaskProtocolCommandType.CREATE_TASK,
      projectKey: 'clawkit',
      goal: '测试唯一性',
      constraints: [],
      acceptanceCriteria: [],
      rawText: '#研发任务\n项目: clawkit\n目标: 测试唯一性',
    };

    const draft1 = service.createFromProtocol(protocol);
    const draft2 = service.createFromProtocol(protocol);

    assert.notEqual(draft1.taskId, draft2.taskId);
  });
}

module.exports = {
  runTaskDraftServiceTests,
};
