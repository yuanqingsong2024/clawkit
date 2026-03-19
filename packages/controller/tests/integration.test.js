const assert = require('node:assert/strict');

const { TaskStatus, ApprovalAction } = require('@clawkit/shared');
const {
  recognizeTaskProtocol,
  TaskProtocolCommandType,
  TaskDraftServiceImpl,
  TaskMemoryServiceImpl,
} = require('../dist');

function run(name, handler) {
  handler();
  console.log(`✓ ${name}`);
}

function runIntegrationTests() {
  run('完整链路：协议 -> TaskDraft -> TaskMemory', () => {
    // 1. 解析协议
    const protocolText = `#研发任务
项目: clawkit
目标: 实现完整的任务处理链路
约束: 不进入真实派发；保持最小可用；全部使用中文
验收: 协议可解析；TaskDraft 可创建；TaskMemory 可初始化`;

    const protocolResult = recognizeTaskProtocol(protocolText);
    assert.equal(protocolResult.ok, true);
    if (!protocolResult.ok) {
      throw new Error('协议解析失败');
    }

    const protocol = protocolResult.data;
    assert.equal(protocol.command, TaskProtocolCommandType.CREATE_TASK);
    assert.equal(protocol.projectKey, 'clawkit');
    assert.equal(protocol.goal, '实现完整的任务处理链路');

    // 2. 创建 TaskDraft
    const draftService = new TaskDraftServiceImpl();
    const draft = draftService.createFromProtocol(protocol);

    assert.equal(draft.projectKey, 'clawkit');
    assert.equal(draft.intent, '实现完整的任务处理链路');
    assert.equal(draft.status, TaskStatus.DRAFT);
    assert.ok(draft.taskId.startsWith('clawkit-'));
    assert.deepEqual(draft.constraints, ['不进入真实派发', '保持最小可用', '全部使用中文']);
    assert.deepEqual(draft.acceptanceCriteria, ['协议可解析', 'TaskDraft 可创建', 'TaskMemory 可初始化']);

    // 3. 初始化 TaskMemory
    const memoryService = new TaskMemoryServiceImpl();
    const memory = memoryService.initializeFromDraft(draft);

    assert.equal(memory.taskId, draft.taskId);
    assert.equal(memory.normalizedTaskCard.objective, draft.intent);
    assert.deepEqual(memory.normalizedTaskCard.constraints, draft.constraints);
    assert.deepEqual(memory.normalizedTaskCard.acceptanceCriteria, draft.acceptanceCriteria);
    assert.ok(memory.normalizedTaskCard.scope.includes(draft.intent));
    assert.deepEqual(memory.promptDraftHistory, []);
    assert.deepEqual(memory.userRevisionHistory, []);
  });

  run('完整链路：支持多种协议类型', () => {
    // 测试确认派发协议
    const confirmResult = recognizeTaskProtocol('#确认派发 task-001');
    assert.equal(confirmResult.ok, true);
    if (!confirmResult.ok) {
      throw new Error('确认派发协议解析失败');
    }
    assert.equal(confirmResult.data.command, TaskProtocolCommandType.CONFIRM_DISPATCH);
    assert.equal(confirmResult.data.taskId, 'task-001');
    assert.equal(confirmResult.data.action, ApprovalAction.APPROVE);

    // 测试修改草案协议
    const reviseResult = recognizeTaskProtocol(`#修改草案 task-002
修改: 补充错误处理逻辑`);
    assert.equal(reviseResult.ok, true);
    if (!reviseResult.ok) {
      throw new Error('修改草案协议解析失败');
    }
    assert.equal(reviseResult.data.command, TaskProtocolCommandType.REVISE_DRAFT);
    assert.equal(reviseResult.data.taskId, 'task-002');
    assert.equal(reviseResult.data.action, ApprovalAction.REVISE);
    assert.equal(reviseResult.data.modification, '补充错误处理逻辑');

    // 测试取消任务协议
    const cancelResult = recognizeTaskProtocol('#取消任务 task-003');
    assert.equal(cancelResult.ok, true);
    if (!cancelResult.ok) {
      throw new Error('取消任务协议解析失败');
    }
    assert.equal(cancelResult.data.command, TaskProtocolCommandType.CANCEL_TASK);
    assert.equal(cancelResult.data.taskId, 'task-003');
    assert.equal(cancelResult.data.action, ApprovalAction.CANCEL);

    // 测试查询状态协议
    const statusResult = recognizeTaskProtocol('#任务状态 task-004');
    assert.equal(statusResult.ok, true);
    if (!statusResult.ok) {
      throw new Error('任务状态协议解析失败');
    }
    assert.equal(statusResult.data.command, TaskProtocolCommandType.VIEW_STATUS);
    assert.equal(statusResult.data.taskId, 'task-004');
    assert.equal(statusResult.data.action, ApprovalAction.VIEW_STATUS);
  });

  run('完整链路：TaskMemory 更新流程', () => {
    // 1. 创建初始 TaskDraft
    const draftService = new TaskDraftServiceImpl();
    const protocol = {
      command: TaskProtocolCommandType.CREATE_TASK,
      projectKey: 'clawkit',
      goal: '测试记忆更新',
      constraints: ['约束1'],
      acceptanceCriteria: ['验收1'],
      rawText: '#研发任务\n项目: clawkit\n目标: 测试记忆更新',
    };
    const draft = draftService.createFromProtocol(protocol);

    // 2. 初始化 TaskMemory
    const memoryService = new TaskMemoryServiceImpl();
    const memory = memoryService.initializeFromDraft(draft);

    // 3. 更新标准化卡片
    const updatedCard = {
      title: '更新后的标题',
      objective: '更新后的目标',
      scope: ['新范围1', '新范围2'],
      outOfScope: ['不做的事情'],
      constraints: ['新约束1', '新约束2'],
      acceptanceCriteria: ['新验收1', '新验收2'],
    };
    const updatedMemory = memoryService.updateNormalizedCard(memory, updatedCard);

    // 4. 验证更新结果
    assert.equal(updatedMemory.taskId, memory.taskId);
    assert.equal(updatedMemory.normalizedTaskCard.title, '更新后的标题');
    assert.equal(updatedMemory.normalizedTaskCard.objective, '更新后的目标');
    assert.deepEqual(updatedMemory.normalizedTaskCard.scope, ['新范围1', '新范围2']);
    assert.deepEqual(updatedMemory.normalizedTaskCard.outOfScope, ['不做的事情']);
    assert.deepEqual(updatedMemory.normalizedTaskCard.constraints, ['新约束1', '新约束2']);
    assert.deepEqual(updatedMemory.normalizedTaskCard.acceptanceCriteria, ['新验收1', '新验收2']);
    assert.ok(updatedMemory.updatedAt >= memory.updatedAt);
  });

  run('完整链路：错误处理', () => {
    // 测试非法协议
    const invalidResult = recognizeTaskProtocol('这不是一个合法的协议');
    assert.equal(invalidResult.ok, false);
    if (invalidResult.ok) {
      throw new Error('应该返回错误');
    }
    assert.ok(invalidResult.error.message.includes('无法识别'));

    // 测试缺少必填字段
    const missingFieldResult = recognizeTaskProtocol(`#研发任务
项目: clawkit`);
    assert.equal(missingFieldResult.ok, false);
    if (missingFieldResult.ok) {
      throw new Error('应该返回错误');
    }
    assert.ok(missingFieldResult.error.message.includes('目标'));
  });
}

module.exports = {
  runIntegrationTests,
};
