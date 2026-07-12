const assert = require('node:assert/strict');

const { ApprovalAction, TaskStatus } = require('@clawkit/shared');
const {
  applyApprovalAction,
  canApplyApprovalAction,
  canTransitionTaskStatus,
  getAllowedTaskTransitions,
  getNextTaskStatusForAction,
  transitionTaskStatus,
} = require('../dist');

function run(name, handler) {
  handler();
  console.log(`✓ ${name}`);
}

function runStateMachineTests() {
  run('支持当前阶段的基础合法流转', () => {
    assert.equal(canTransitionTaskStatus(TaskStatus.DRAFT, TaskStatus.PROMPT_GENERATED), true);
    assert.equal(canTransitionTaskStatus(TaskStatus.PROMPT_GENERATED, TaskStatus.WAITING_APPROVAL), true);
    assert.equal(canTransitionTaskStatus(TaskStatus.WAITING_APPROVAL, TaskStatus.APPROVED), true);
    assert.equal(canTransitionTaskStatus(TaskStatus.APPROVED, TaskStatus.CANCELLED), true);
  });

  run('可以阻止非法流转', () => {
    assert.equal(canTransitionTaskStatus(TaskStatus.DRAFT, TaskStatus.APPROVED), false);
    assert.throws(() => transitionTaskStatus(TaskStatus.DRAFT, TaskStatus.APPROVED), /controller\.invalid_task_status_transition/);
  });

  run('审批动作可以映射到下一状态', () => {
    assert.equal(getNextTaskStatusForAction(TaskStatus.WAITING_APPROVAL, ApprovalAction.APPROVE), TaskStatus.APPROVED);
    assert.equal(getNextTaskStatusForAction(TaskStatus.WAITING_APPROVAL, ApprovalAction.REVISE), TaskStatus.DRAFT);
    assert.equal(getNextTaskStatusForAction(TaskStatus.APPROVED, ApprovalAction.CANCEL), TaskStatus.CANCELLED);
    assert.equal(getNextTaskStatusForAction(TaskStatus.APPROVED, ApprovalAction.VIEW_STATUS), TaskStatus.APPROVED);
    assert.equal(getNextTaskStatusForAction(TaskStatus.APPROVED, ApprovalAction.REVISE), null);
  });

  run('非法审批动作会报错', () => {
    assert.equal(canApplyApprovalAction(TaskStatus.DRAFT, ApprovalAction.APPROVE), false);
    assert.equal(canApplyApprovalAction(TaskStatus.CANCELLED, ApprovalAction.APPROVE), false);
    assert.throws(() => applyApprovalAction(TaskStatus.DRAFT, ApprovalAction.APPROVE), /controller\.invalid_approval_action/);
    assert.throws(() => applyApprovalAction(TaskStatus.APPROVED, ApprovalAction.REVISE), /controller\.invalid_approval_action/);
  });

  run('预留执行态流转已定义但不会影响当前阶段', () => {
    assert.deepEqual(getAllowedTaskTransitions(TaskStatus.APPROVED), [
      TaskStatus.DRAFT,
      TaskStatus.DISPATCHED,
      TaskStatus.CANCELLED,
    ]);
    assert.equal(canTransitionTaskStatus(TaskStatus.DISPATCHED, TaskStatus.RUNNING), true);
    assert.equal(canTransitionTaskStatus(TaskStatus.RUNNING, TaskStatus.DONE), true);
    assert.equal(canTransitionTaskStatus(TaskStatus.DONE, TaskStatus.CANCELLED), false);
  });
}

module.exports = {
  runStateMachineTests,
};
