const assert = require('node:assert/strict');

const { ApprovalAction, ControllerErrorCode } = require('@clawkit/shared');
const {
  TaskProtocolCommandType,
  parseCreateTaskProtocol,
  recognizeTaskProtocol,
  recognizeTaskProtocolCommand,
} = require('../dist');

function run(name, handler) {
  handler();
  console.log(`✓ ${name}`);
}

function runProtocolParserTests() {
  run('可以识别创建研发任务协议并提取字段', () => {
    const result = parseCreateTaskProtocol(`#研发任务\n项目: clawkit\n目标: 实现任务协议解析\n约束: 不进入真实派发；全部使用中文\n验收: 五种协议可解析；非法输入有中文报错`);

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.data.command, TaskProtocolCommandType.CREATE_TASK);
    assert.equal(result.data.projectKey, 'clawkit');
    assert.equal(result.data.goal, '实现任务协议解析');
    assert.deepEqual(result.data.constraints, ['不进入真实派发', '全部使用中文']);
    assert.deepEqual(result.data.acceptanceCriteria, ['五种协议可解析', '非法输入有中文报错']);
  });

  run('可以识别确认派发协议', () => {
    const result = recognizeTaskProtocol('#确认派发 task-001');

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.data.command, TaskProtocolCommandType.CONFIRM_DISPATCH);
    assert.equal(result.data.taskId, 'task-001');
    assert.equal(result.data.action, ApprovalAction.APPROVE);
  });

  run('可以识别修改草案协议', () => {
    const result = recognizeTaskProtocol(`#修改草案 task-002\n修改: 补充审批边界与错误提示`);

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.data.command, TaskProtocolCommandType.REVISE_DRAFT);
    assert.equal(result.data.taskId, 'task-002');
    assert.equal(result.data.action, ApprovalAction.REVISE);
    assert.equal(result.data.modification, '补充审批边界与错误提示');
  });

  run('可以识别取消任务协议', () => {
    const result = recognizeTaskProtocol('#取消任务 task-003');

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.data.command, TaskProtocolCommandType.CANCEL_TASK);
    assert.equal(result.data.taskId, 'task-003');
    assert.equal(result.data.action, ApprovalAction.CANCEL);
  });

  run('可以识别任务状态协议', () => {
    const result = recognizeTaskProtocol('#任务状态 task-004');

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.data.command, TaskProtocolCommandType.VIEW_STATUS);
    assert.equal(result.data.taskId, 'task-004');
    assert.equal(result.data.action, ApprovalAction.VIEW_STATUS);
  });

  run('缺少必填字段时返回中文错误', () => {
    const result = parseCreateTaskProtocol(`#研发任务\n项目: clawkit`);

    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }

    assert.equal(result.error.code, ControllerErrorCode.TASK_PROTOCOL_FIELD_MISSING);
    assert.match(result.error.message, /目标/);
  });

  run('非法协议返回错误码', () => {
    const result = recognizeTaskProtocol('随便说一句话');

    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }

    assert.equal(result.error.code, ControllerErrorCode.INVALID_TASK_PROTOCOL);
  });

  run('协议识别器可以只识别命令类型', () => {
    const result = recognizeTaskProtocolCommand('#修改草案 task-005\n修改: 重新整理验收');

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.data, TaskProtocolCommandType.REVISE_DRAFT);
  });
}

module.exports = {
  runProtocolParserTests,
};
