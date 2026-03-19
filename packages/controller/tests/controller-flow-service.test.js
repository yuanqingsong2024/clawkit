const assert = require('node:assert/strict');

const { ApprovalAction, TaskStatus } = require('@clawkit/shared');
const { ControllerFlowServiceImpl, PromptDraftServiceImpl } = require('../dist');

async function run(name, handler) {
  await handler();
  console.log(`✓ ${name}`);
}

async function runControllerFlowServiceTests() {
  await run('最小闭环：创建任务 -> 生成草案 -> 修改草案 -> 确认草案 -> 查询状态', async () => {
    const service = new ControllerFlowServiceImpl();
    const created = service.createDraftFromText(`#研发任务
项目: clawkit
目标: 在 controller 内实现最小闭环
约束: 只做 controller 内部；保持可派发准备态；全部使用中文
验收: 可以创建草案；可以修改草案；可以确认草案；可以查询状态`);

    assert.equal(created.taskDraft.projectKey, 'clawkit');
    assert.equal(created.taskDraft.status, TaskStatus.DRAFT);

    const generated = await service.generatePromptDraft(created.taskDraft.taskId);
    assert.equal(generated.taskDraft.status, TaskStatus.WAITING_APPROVAL);
    assert.equal(generated.promptDraft.version.generation, 1);
    assert.equal(generated.promptDraft.version.revision, 0);

    const revisedResult = await service.reviseDraft({
      taskId: created.taskDraft.taskId,
      operator: '产品经理',
      revisionText: '补充状态查询结果中的最近审批动作',
    });

    assert.equal(revisedResult.status, TaskStatus.WAITING_APPROVAL);
    assert.equal(revisedResult.revisionRecorded, true);
    assert.equal(revisedResult.draftVersion.generation, 1);
    assert.equal(revisedResult.draftVersion.revision, 1);
    assert.ok(revisedResult.draftSummary.scope.some((item) => item.includes('补充状态查询结果中的最近审批动作')));

    const approvedStatus = service.approveDraft({
      taskId: created.taskDraft.taskId,
      operator: '负责人',
      comment: '确认进入下一阶段准备态',
    });

    assert.equal(approvedStatus.status, TaskStatus.APPROVED);
    assert.equal(approvedStatus.latestApprovalAction.action, ApprovalAction.APPROVE);
    assert.equal(approvedStatus.nextStageHint, '草稿已确认，等待派发到可用 worker');

    const snapshot = service.getTaskStatus(created.taskDraft.taskId);
    assert.equal(snapshot.taskId, created.taskDraft.taskId);
    assert.equal(snapshot.projectKey, 'clawkit');
    assert.equal(snapshot.status, TaskStatus.APPROVED);
    assert.ok(snapshot.latestPromptDraftSummary);
    assert.equal(snapshot.latestApprovalAction.action, ApprovalAction.APPROVE);
    assert.equal(snapshot.nextStageHint, '草稿已确认，等待派发到可用 worker');

    const inspected = service.inspectTask(created.taskDraft.taskId);
    assert.equal(inspected.taskMemory.promptDraftHistory.length, 2);
    assert.equal(inspected.taskMemory.userRevisionHistory.length, 1);
    assert.equal(inspected.promptDrafts.length, 2);
    assert.deepEqual(inspected.promptDrafts.map((item) => item.version), [
      { generation: 1, revision: 0 },
      { generation: 1, revision: 1 },
    ]);

    const history = service.getDraftHistory(created.taskDraft.taskId);
    assert.equal(history.taskId, created.taskDraft.taskId);
    assert.equal(history.versions.length, 2);
    assert.deepEqual(history.latestVersion, { generation: 1, revision: 1 });
    assert.ok(history.latestSummary.scope.some((item) => item.includes('补充状态查询结果中的最近审批动作')));
  });

  await run('approved 只改状态，不进入 dispatched', async () => {
    const service = new ControllerFlowServiceImpl();
    const created = service.createDraftFromText(`#研发任务
项目: clawkit
目标: 验证 approved 只改状态
约束: 不做 worker 调度
验收: approved 后状态仍然不是 dispatched`);

    await service.generatePromptDraft(created.taskDraft.taskId);
    const snapshot = service.approveDraft({
      taskId: created.taskDraft.taskId,
      operator: '审批人',
    });

    assert.equal(snapshot.status, TaskStatus.APPROVED);
    assert.notEqual(snapshot.status, TaskStatus.DISPATCHED);
  });

  await run('approved 后不能再次 revise', async () => {
    const service = new ControllerFlowServiceImpl();
    const created = service.createDraftFromText(`#研发任务
项目: clawkit
目标: 验证 approved 后不能 revise
约束: 只做审批流
验收: approved 后 revise 报错`);

    await service.generatePromptDraft(created.taskDraft.taskId);
    service.approveDraft({
      taskId: created.taskDraft.taskId,
      operator: '审批人',
    });

    await assert.rejects(
      () => service.reviseDraft({
        taskId: created.taskDraft.taskId,
        operator: '产品经理',
        revisionText: '试图继续修改',
      }),
      /controller\.invalid_approval_action/
    );
  });

  await run('取消任务会记录审批动作并更新状态', async () => {
    const service = new ControllerFlowServiceImpl();
    const created = service.createDraftFromText(`#研发任务
项目: clawkit
目标: 验证取消流程
约束: 不做外部调用
验收: 可以取消任务`);

    await service.generatePromptDraft(created.taskDraft.taskId);
    const snapshot = service.cancelTask({
      taskId: created.taskDraft.taskId,
      operator: '审批人',
      comment: '本次需求取消',
    });

    assert.equal(snapshot.status, TaskStatus.CANCELLED);
    assert.equal(snapshot.latestApprovalAction.action, ApprovalAction.CANCEL);
    assert.equal(snapshot.latestApprovalAction.comment, '本次需求取消');
    assert.equal(snapshot.nextStageHint, '任务已取消，如需继续请重新创建任务');
  });

  await run('已取消任务不能再次确认', async () => {
    const service = new ControllerFlowServiceImpl();
    const created = service.createDraftFromText(`#研发任务
项目: clawkit
目标: 验证取消后不能确认
约束: 只做审批流
验收: cancelled 后 approve 报错`);

    await service.generatePromptDraft(created.taskDraft.taskId);
    service.cancelTask({
      taskId: created.taskDraft.taskId,
      operator: '审批人',
    });

    assert.throws(
      () => service.approveDraft({
        taskId: created.taskDraft.taskId,
        operator: '审批人',
      }),
      /controller\.invalid_approval_action/
    );
  });

  await run('生成失败时不会留下半更新状态', async () => {
    const failingService = new ControllerFlowServiceImpl({
      promptDraftService: {
        async buildPromptDraft() {
          throw new Error('模拟生成失败');
        },
      },
    });

    const created = failingService.createDraftFromText(`#研发任务
项目: clawkit
目标: 验证生成失败回滚
约束: 只做内存闭环
验收: 失败后状态保持 draft`);

    await assert.rejects(() => failingService.generatePromptDraft(created.taskDraft.taskId), /模拟生成失败/);

    const snapshot = failingService.getTaskStatus(created.taskDraft.taskId);
    const inspected = failingService.inspectTask(created.taskDraft.taskId);
    assert.equal(snapshot.status, TaskStatus.DRAFT);
    assert.equal(snapshot.latestPromptDraftSummary, null);
    assert.equal(inspected.promptDrafts.length, 0);
    assert.equal(inspected.taskMemory.promptDraftHistory.length, 0);
  });

  await run('修改重生成失败时保留原状态和原历史', async () => {
    const basePromptDraftService = new PromptDraftServiceImpl();
    let buildCount = 0;
    const service = new ControllerFlowServiceImpl({
      promptDraftService: {
        async buildPromptDraft(input) {
          buildCount += 1;
          if (buildCount === 2) {
            throw new Error('模拟修改后生成失败');
          }
          return basePromptDraftService.buildPromptDraft(input);
        },
      },
    });

    const created = service.createDraftFromText(`#研发任务
项目: clawkit
目标: 验证修改失败回滚
约束: 不进入真实派发
验收: 修改失败后不污染原状态`);

    await service.generatePromptDraft(created.taskDraft.taskId);
    await assert.rejects(
      () => service.reviseDraft({
        taskId: created.taskDraft.taskId,
        operator: '产品经理',
        revisionText: '这次修改会触发失败',
      }),
      /模拟修改后生成失败/
    );

    const snapshot = service.getTaskStatus(created.taskDraft.taskId);
    const inspected = service.inspectTask(created.taskDraft.taskId);
    assert.equal(snapshot.status, TaskStatus.WAITING_APPROVAL);
    assert.equal(inspected.promptDrafts.length, 1);
    assert.equal(inspected.taskMemory.promptDraftHistory.length, 1);
    assert.equal(inspected.taskMemory.userRevisionHistory.length, 0);
    assert.equal(inspected.approvalRecords.length, 0);
  });
}

module.exports = {
  runControllerFlowServiceTests,
};
