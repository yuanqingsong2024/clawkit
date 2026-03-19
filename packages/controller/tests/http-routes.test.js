const assert = require('node:assert/strict');

const { TaskStatus } = require('@clawkit/shared');
const { buildHttpServer, ControllerApiService, ControllerFlowServiceImpl } = require('../dist');
const { ServiceContainer } = require('../dist/http/services/service-container');

async function run(name, handler) {
  await handler();
  console.log(`✓ ${name}`);
}

async function withPersistenceDisabled(handler) {
  const previous = process.env.CONTROLLER_ENABLE_PERSISTENCE;
  process.env.CONTROLLER_ENABLE_PERSISTENCE = 'false';
  try {
    await handler();
  } finally {
    if (previous === undefined) {
      delete process.env.CONTROLLER_ENABLE_PERSISTENCE;
    } else {
      process.env.CONTROLLER_ENABLE_PERSISTENCE = previous;
    }
  }
}

function createTaskText(goal, acceptance) {
  return `#研发任务
项目: clawkit
目标: ${goal}
约束: 只做审批流；不接 worker；不做真实派发；不调用 OpenCode
验收: ${acceptance}`;
}

async function createWaitingApprovalTask(app, text) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    payload: { text },
  });
  assert.equal(response.statusCode, 201);
  const payload = response.json();
  return payload.data.taskDraft.taskId;
}

async function createOpenClawTask(app, text) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/tasks/from-openclaw',
    payload: {
      requestId: 'oc-create-001',
      source: 'openclaw',
      conversation: {
        sessionId: 'session-001',
        messageId: 'message-001',
      },
      operator: {
        id: 'openclaw',
        name: 'OpenClaw',
      },
      action: 'create_task',
      data: {
        text,
      },
    },
  });

  assert.equal(response.statusCode, 201);
  return response.json();
}

async function runHttpRoutesTests() {
  await run('approve 接口：waiting_approval 可以确认且只改为 approved', async () => {
    await withPersistenceDisabled(async () => {
      const app = await buildHttpServer();
      try {
        const taskId = await createWaitingApprovalTask(app, createTaskText('验证 approve 接口', 'approve 成功返回 approved'));
        const response = await app.inject({
          method: 'POST',
          url: `/api/approval/${taskId}/approve`,
          payload: {
            operator: '审批人',
            comment: '确认通过',
          },
        });

        assert.equal(response.statusCode, 200);
        const payload = response.json();
        assert.equal(payload.success, true);
        assert.equal(payload.code, 'controller.approval.approved');
        assert.equal(payload.data.taskId, taskId);
        assert.equal(payload.data.status, TaskStatus.APPROVED);
        assert.equal(payload.data.latestApprovalAction.action, 'approve');
        assert.equal(payload.data.latestApprovalAction.fromStatus, TaskStatus.WAITING_APPROVAL);
        assert.equal(payload.data.latestApprovalAction.toStatus, TaskStatus.APPROVED);
        assert.equal(payload.data.nextStageHint, '已确认，但当前无法派发，请先处理 worker 或项目配置问题');
        assert.equal(typeof payload.data.dispatchErrorMessage, 'string');
      } finally {
        await app.close();
      }
    });
  });

  await run('OpenClaw 入口：创建任务返回可直接转发的草稿消息对象', async () => {
    await withPersistenceDisabled(async () => {
      const app = await buildHttpServer();
      try {
      const payload = await createOpenClawTask(app, createTaskText('适配 OpenClaw 草稿回传', '返回 draftMessage 与建议回复'));
      assert.equal(payload.success, true);
      assert.equal(payload.code, 'controller.openclaw.task_draft_ready');
      assert.equal(payload.data.status, TaskStatus.WAITING_APPROVAL);
      assert.equal(payload.data.draftMessage.taskId, payload.data.taskId);
      assert.equal(payload.data.draftMessage.projectKey, 'clawkit');
      assert.equal(payload.data.draftMessage.status, TaskStatus.WAITING_APPROVAL);
      assert.deepEqual(payload.data.draftMessage.suggestedReplies, [
        `#确认派发 ${payload.data.taskId}`,
        `#修改草案 ${payload.data.taskId}`,
        `#取消任务 ${payload.data.taskId}`,
        `#任务状态 ${payload.data.taskId}`,
      ]);
      assert.equal(typeof payload.data.draftMessage.summary, 'string');
      assert.equal(typeof payload.data.draftMessage.body, 'string');
      assert.equal(payload.data.statusSnapshot.userSummary.includes('waiting_approval'), true);
      } finally {
        await app.close();
      }
    });
  });

  await run('OpenClaw 入口：修改草稿后返回新版 draftMessage', async () => {
    await withPersistenceDisabled(async () => {
      const app = await buildHttpServer();
      try {
      const created = await createOpenClawTask(app, createTaskText('修改 OpenClaw 草稿', 'revise_draft 返回新版草稿'));
      const taskId = created.data.taskId;
      const reviseResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks/from-openclaw',
        payload: {
          requestId: 'oc-revise-001',
          source: 'openclaw',
          conversation: {
            sessionId: 'session-001',
          },
          operator: {
            id: 'openclaw',
            name: 'OpenClaw',
          },
          action: 'revise_draft',
          data: {
            taskId,
            revisionText: '请补充适合直接回给用户的摘要文案',
          },
        },
      });

      assert.equal(reviseResponse.statusCode, 200);
      const revisePayload = reviseResponse.json();
      assert.equal(revisePayload.success, true);
      assert.equal(revisePayload.code, 'controller.openclaw.task_draft_revised');
      assert.equal(revisePayload.data.taskId, taskId);
      assert.equal(revisePayload.data.status, TaskStatus.WAITING_APPROVAL);
      assert.equal(revisePayload.data.draftMessage.taskId, taskId);
      assert.equal(revisePayload.data.draftMessage.rawDraftSummary.scope.some((item) => item.includes('适合直接回给用户')), true);
      } finally {
        await app.close();
      }
    });
  });

  await run('OpenClaw 入口：确认后返回统一结果，状态查询返回用户可读摘要', async () => {
    await withPersistenceDisabled(async () => {
      const app = await buildHttpServer();
      try {
      const created = await createOpenClawTask(app, createTaskText('确认 OpenClaw 草稿', 'approve_draft 返回 resultMessage'));
      const taskId = created.data.taskId;

      const approveResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks/from-openclaw',
        payload: {
          requestId: 'oc-approve-001',
          source: 'openclaw',
          conversation: {
            sessionId: 'session-approve-001',
          },
          operator: {
            id: 'openclaw',
            name: 'OpenClaw',
          },
          action: 'approve_draft',
          data: {
            taskId,
            comment: '确认草稿',
          },
        },
      });

      assert.equal(approveResponse.statusCode, 200);
      const approvePayload = approveResponse.json();
      assert.equal(approvePayload.success, true);
      assert.equal(approvePayload.code, 'controller.openclaw.task_approved');
      assert.equal(approvePayload.data.taskId, taskId);
      assert.equal(approvePayload.data.status, TaskStatus.APPROVED);
      assert.equal(approvePayload.data.resultMessage.includes('暂时无法开始执行'), true);
      assert.equal(approvePayload.data.nextStageHint, '已确认，但当前无法派发，请先处理 worker 或项目配置问题');
      assert.equal(typeof approvePayload.data.dispatchErrorMessage, 'string');

      const statusResponse = await app.inject({
        method: 'GET',
        url: `/api/tasks/${taskId}/status`,
      });

      assert.equal(statusResponse.statusCode, 200);
      const statusPayload = statusResponse.json();
      assert.equal(statusPayload.success, true);
      assert.equal(statusPayload.data.taskId, taskId);
      assert.equal(statusPayload.data.status, TaskStatus.APPROVED);
      assert.equal(typeof statusPayload.data.userSummary, 'string');
      assert.equal(statusPayload.data.readableSummary.title.includes(taskId), true);
      assert.equal(Array.isArray(statusPayload.data.readableSummary.details), true);
      assert.deepEqual(statusPayload.data.readableSummary.suggestedReplies, [
        `#确认派发 ${taskId}`,
        `#修改草案 ${taskId}`,
        `#取消任务 ${taskId}`,
        `#任务状态 ${taskId}`,
      ]);
      } finally {
        await app.close();
      }
    });
  });

  await run('revise 接口：记录修改意见、生成新版本并可查询历史', async () => {
    await withPersistenceDisabled(async () => {
      const app = await buildHttpServer();
      try {
      const taskId = await createWaitingApprovalTask(app, createTaskText('验证 revise 接口', 'revise 后生成新版本'));
      const reviseResponse = await app.inject({
        method: 'POST',
        url: `/api/drafts/${taskId}/revise`,
        payload: {
          operator: '产品经理',
          revisionText: '补充明确的返回字段和状态提示',
        },
      });

      assert.equal(reviseResponse.statusCode, 200);
      const revisePayload = reviseResponse.json();
      assert.equal(revisePayload.success, true);
      assert.equal(revisePayload.code, 'controller.drafts.revised');
      assert.equal(revisePayload.data.taskId, taskId);
      assert.equal(revisePayload.data.status, TaskStatus.WAITING_APPROVAL);
      assert.equal(revisePayload.data.revisionRecorded, true);
      assert.deepEqual(revisePayload.data.draftVersion, { generation: 1, revision: 1 });
      assert.ok(revisePayload.data.draftSummary.scope.some((item) => item.includes('补充明确的返回字段和状态提示')));

      const historyResponse = await app.inject({
        method: 'GET',
        url: `/api/drafts/${taskId}/history`,
      });

      assert.equal(historyResponse.statusCode, 200);
      const historyPayload = historyResponse.json();
      assert.equal(historyPayload.success, true);
      assert.equal(historyPayload.code, 'controller.drafts.history_fetched');
      assert.equal(historyPayload.data.taskId, taskId);
      assert.equal(historyPayload.data.versions.length, 2);
      assert.deepEqual(historyPayload.data.latestVersion, { generation: 1, revision: 1 });
      assert.ok(historyPayload.data.latestSummary.scope.some((item) => item.includes('补充明确的返回字段和状态提示')));
      } finally {
        await app.close();
      }
    });
  });

  await run('cancel 接口：取消后返回清晰状态，并禁止再次 approve', async () => {
    await withPersistenceDisabled(async () => {
      const app = await buildHttpServer();
      try {
      const taskId = await createWaitingApprovalTask(app, createTaskText('验证 cancel 接口', 'cancel 后不可再次 approve'));
      const cancelResponse = await app.inject({
        method: 'POST',
        url: `/api/approval/${taskId}/cancel`,
        payload: {
          operator: '审批人',
          comment: '需求取消',
        },
      });

      assert.equal(cancelResponse.statusCode, 200);
      const cancelPayload = cancelResponse.json();
      assert.equal(cancelPayload.success, true);
      assert.equal(cancelPayload.code, 'controller.approval.cancelled');
      assert.equal(cancelPayload.data.status, TaskStatus.CANCELLED);
      assert.equal(cancelPayload.data.latestApprovalAction.action, 'cancel');
      assert.equal(cancelPayload.data.latestApprovalAction.toStatus, TaskStatus.CANCELLED);

      const approveAgainResponse = await app.inject({
        method: 'POST',
        url: `/api/approval/${taskId}/approve`,
        payload: {
          operator: '审批人',
        },
      });

      assert.equal(approveAgainResponse.statusCode, 400);
      const approveAgainPayload = approveAgainResponse.json();
      assert.equal(approveAgainPayload.success, false);
      assert.equal(approveAgainPayload.code, 'controller.invalid_approval_action');
      } finally {
        await app.close();
      }
    });
  });

  await run('非法状态流转：approved 后不能 revise，draft 不能直接 approve', async () => {
    await withPersistenceDisabled(async () => {
      const flowService = new ControllerFlowServiceImpl();
      const waitingApprovalTask = flowService.createDraftFromText(createTaskText('验证非法状态流转', '非法状态流转返回统一错误码'));
      await flowService.generatePromptDraft(waitingApprovalTask.taskDraft.taskId);
      flowService.approveDraft({
        taskId: waitingApprovalTask.taskDraft.taskId,
        operator: '审批人',
      });

      const container = new ServiceContainer();
      container.flowService = flowService;
      container.apiService = new ControllerApiService(flowService, container.dispatchService, container.workerRegistry);
      const app = await buildHttpServer({ container });

      try {
      const reviseAfterApproveResponse = await app.inject({
        method: 'POST',
        url: `/api/drafts/${waitingApprovalTask.taskDraft.taskId}/revise`,
        payload: {
          operator: '产品经理',
          revisionText: '审批通过后仍尝试修改',
        },
      });

      assert.equal(reviseAfterApproveResponse.statusCode, 400);
      const reviseAfterApprovePayload = reviseAfterApproveResponse.json();
      assert.equal(reviseAfterApprovePayload.success, false);
      assert.equal(reviseAfterApprovePayload.code, 'controller.invalid_approval_action');

      const draftOnlyFlowService = new ControllerFlowServiceImpl();
      const draftOnlyTask = draftOnlyFlowService.createDraftFromText(createTaskText('验证 draft 直接 approve', 'draft 直接 approve 报错'));
      const draftOnlyContainer = new ServiceContainer();
      draftOnlyContainer.flowService = draftOnlyFlowService;
      draftOnlyContainer.apiService = new ControllerApiService(
        draftOnlyFlowService,
        draftOnlyContainer.dispatchService,
        draftOnlyContainer.workerRegistry,
      );
      const draftOnlyApp = await buildHttpServer({ container: draftOnlyContainer });

      try {
        const approveDraftResponse = await draftOnlyApp.inject({
          method: 'POST',
          url: `/api/approval/${draftOnlyTask.taskDraft.taskId}/approve`,
          payload: {
            operator: '审批人',
          },
        });

        assert.equal(approveDraftResponse.statusCode, 400);
        const approveDraftPayload = approveDraftResponse.json();
        assert.equal(approveDraftPayload.success, false);
        assert.equal(approveDraftPayload.code, 'controller.invalid_approval_action');
      } finally {
        await draftOnlyApp.close();
      }
      } finally {
        await app.close();
      }
    });
  });
}

module.exports = {
  runHttpRoutesTests,
};
