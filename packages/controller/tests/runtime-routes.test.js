const assert = require('node:assert/strict');

const { buildHttpServer } = require('../dist');

async function run(name, handler) {
  await handler();
  console.log(`✓ ${name}`);
}

async function withEnv(name, value, handler) {
  const previous = process.env[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }

  try {
    await handler();
  } finally {
    if (previous === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = previous;
    }
  }
}

async function withRuntimeEnv(handler) {
  const previousPersistence = process.env.CONTROLLER_ENABLE_PERSISTENCE;
  process.env.CONTROLLER_ENABLE_PERSISTENCE = 'false';
  try {
    await handler();
  } finally {
    if (previousPersistence === undefined) {
      delete process.env.CONTROLLER_ENABLE_PERSISTENCE;
    } else {
      process.env.CONTROLLER_ENABLE_PERSISTENCE = previousPersistence;
    }
  }
}

async function runRuntimeRoutesTests() {
  await run('runtime 健康检查与版本接口可用', async () => {
    await withRuntimeEnv(async () => {
      const app = await buildHttpServer();
      try {
        const healthResponse = await app.inject({ method: 'GET', url: '/health' });
        assert.equal(healthResponse.statusCode, 200);
        assert.equal(healthResponse.json().success, true);

        const statusResponse = await app.inject({ method: 'GET', url: '/status' });
        assert.equal(statusResponse.statusCode, 200);
        assert.equal(statusResponse.json().data.taskDraftCreateEnabled, true);

        const versionResponse = await app.inject({ method: 'GET', url: '/version' });
        assert.equal(versionResponse.statusCode, 200);
        assert.equal(versionResponse.json().data.name, 'clawkit');

        const capabilityResponse = await app.inject({ method: 'GET', url: '/capabilities' });
        assert.equal(capabilityResponse.statusCode, 200);
        assert.equal(capabilityResponse.json().data.capabilities.taskDraftCreate, true);
      } finally {
        await app.close();
      }
    });
  });

  await run('runtime 任务草稿创建不会自动派发', async () => {
    await withRuntimeEnv(async () => {
      const app = await buildHttpServer();
      try {
        const createResponse = await app.inject({
          method: 'POST',
          url: '/task-drafts',
          payload: {
            requestId: 'req-runtime-001',
            idempotencyKey: 'runtime-idem-001',
            source: 'soloforge-office-os',
            title: '验证 runtime task draft',
            description: '只创建草稿，不自动派发',
            projectName: 'clawkit',
            riskLevel: 'low',
            executionMode: 'sandbox-only',
            acceptanceCriteria: ['只创建草稿', '不自动派发'],
            allowedScopes: ['docs/'],
            forbiddenScopes: ['production'],
          },
        });

        assert.equal(createResponse.statusCode, 201);
        const createPayload = createResponse.json();
        assert.equal(createPayload.success, true);
        assert.equal(createPayload.data.rawResponseSummary.autoDispatched, false);
        const taskId = createPayload.data.remoteDraftId.replace(/^draft_/, '');

        const statusResponse = await app.inject({
          method: 'GET',
          url: `/api/tasks/${taskId}/status`,
        });
        assert.equal(statusResponse.statusCode, 200);
        assert.equal(statusResponse.json().data.status, 'waiting_approval');

        const duplicateCreateResponse = await app.inject({
          method: 'POST',
          url: '/task-drafts',
          payload: {
            requestId: 'req-runtime-001-duplicate',
            idempotencyKey: 'runtime-idem-001',
            source: 'soloforge-office-os',
            title: '验证 runtime task draft',
            description: '只创建草稿，不自动派发',
            projectName: 'clawkit',
            riskLevel: 'low',
            executionMode: 'sandbox-only',
            acceptanceCriteria: ['只创建草稿', '不自动派发'],
            allowedScopes: ['docs/'],
            forbiddenScopes: ['production'],
          },
        });
        assert.equal(duplicateCreateResponse.statusCode, 201);
        const duplicateCreatePayload = duplicateCreateResponse.json();
        assert.equal(duplicateCreatePayload.data.remoteDraftId, createPayload.data.remoteDraftId);
        assert.equal(Array.isArray(duplicateCreatePayload.data.warnings), true);
        assert.equal(duplicateCreatePayload.data.warnings.includes('DUPLICATE_REQUEST'), true);
      } finally {
        await app.close();
      }
    });
  });

  await run('runtime dispatch 必须先审批', async () => {
    await withRuntimeEnv(async () => {
      const app = await buildHttpServer();
      try {
        const createResponse = await app.inject({
          method: 'POST',
          url: '/task-drafts',
          payload: {
            requestId: 'req-runtime-002',
            source: 'soloforge-office-os',
            title: '验证 dispatch 审批前拒绝',
            description: '未审批时不能真实 dispatch',
            projectName: 'clawkit',
            riskLevel: 'low',
            executionMode: 'sandbox-only',
            acceptanceCriteria: ['未审批时拒绝真实派发'],
            allowedScopes: ['docs/'],
            forbiddenScopes: ['production'],
          },
        });

        assert.equal(createResponse.statusCode, 201);
        const taskId = createResponse.json().data.remoteDraftId.replace(/^draft_/, '');

        const registerResponse = await app.inject({
          method: 'POST',
          url: '/api/workers/register',
          payload: {
            workerId: 'worker-sandbox-runtime-1',
            name: 'sandbox-runtime-worker',
            nodeName: 'local',
            connectMode: 'pull',
            tags: ['sandbox', 'test'],
            labels: { env: 'sandbox', role: 'test-worker', sandbox: true },
            capabilities: ['opencode', 'shell'],
            maxConcurrency: 1,
            supportedProjects: ['clawkit'],
          },
        });
        assert.equal(registerResponse.statusCode, 201);

        const dispatchBeforeApprove = await app.inject({
          method: 'POST',
          url: '/dispatch',
          payload: {
            requestId: 'req-runtime-dispatch-before-approve',
            remoteDraftId: `draft_${taskId}`,
            targetWorkerId: 'worker-sandbox-runtime-1',
            dispatchMode: 'sandbox-only',
            riskLevel: 'low',
          },
        });
        assert.equal(dispatchBeforeApprove.statusCode, 400);
        assert.equal(dispatchBeforeApprove.json().code, 'controller.invalid_task_status_transition');

        const approveResponse = await app.inject({
          method: 'POST',
          url: `/api/approval/${taskId}/approve`,
          payload: {
            operator: '审批人',
            comment: '允许 sandbox dispatch',
          },
        });
        assert.equal(approveResponse.statusCode, 200);
        assert.equal(approveResponse.json().data.status, 'approved');

        const dispatchAfterApprove = await app.inject({
          method: 'POST',
          url: '/dispatch',
          payload: {
            requestId: 'req-runtime-dispatch-after-approve',
            idempotencyKey: 'runtime-dispatch-idem-001',
            remoteDraftId: `draft_${taskId}`,
            targetWorkerId: 'worker-sandbox-runtime-1',
            dispatchMode: 'sandbox-only',
            riskLevel: 'low',
          },
        });
        assert.equal(dispatchAfterApprove.statusCode, 201);
        const dispatchPayload = dispatchAfterApprove.json();
        assert.equal(dispatchPayload.success, true);
        assert.equal(typeof dispatchPayload.data.dispatchId, 'string');

        const resultResponse = await app.inject({
          method: 'GET',
          url: `/dispatch/${dispatchPayload.data.dispatchId}/result`,
        });
        assert.equal(resultResponse.statusCode, 200);
        const resultPayload = resultResponse.json();
        assert.equal(resultPayload.success, true);
        assert.equal(resultPayload.data.dispatchId, dispatchPayload.data.dispatchId);
        assert.equal(resultPayload.data.taskId, taskId);
        assert.equal(resultPayload.data.remoteDraftId, `draft_${taskId}`);
        assert.equal(resultPayload.data.workerId, 'worker-sandbox-runtime-1');
        assert.equal(resultPayload.data.workerName, 'sandbox-runtime-worker');
        assert.equal(resultPayload.data.projectKey, 'clawkit');
        assert.equal(resultPayload.data.resultSource === 'runtime-memory' || resultPayload.data.resultSource === 'worker-report', true);
        assert.equal(Array.isArray(resultPayload.data.changedFiles), true);
        assert.equal(typeof resultPayload.data.updatedAt, 'string');

        const workerResultResponse = await app.inject({
          method: 'GET',
          url: `/workers/worker-sandbox-runtime-1/result?dispatchId=${dispatchPayload.data.dispatchId}`,
        });
        assert.equal(workerResultResponse.statusCode, 200);
        const workerResultPayload = workerResultResponse.json();
        assert.equal(workerResultPayload.success, true);
        assert.equal(workerResultPayload.data.dispatchId, dispatchPayload.data.dispatchId);
        assert.equal(workerResultPayload.data.workerId, 'worker-sandbox-runtime-1');

        const duplicateDispatchResponse = await app.inject({
          method: 'POST',
          url: '/dispatch',
          payload: {
            requestId: 'req-runtime-dispatch-after-approve-duplicate',
            idempotencyKey: 'runtime-dispatch-idem-001',
            remoteDraftId: `draft_${taskId}`,
            targetWorkerId: 'worker-sandbox-runtime-1',
            dispatchMode: 'sandbox-only',
            riskLevel: 'low',
          },
        });
        assert.equal(duplicateDispatchResponse.statusCode, 201);
        const duplicateDispatchPayload = duplicateDispatchResponse.json();
        assert.equal(duplicateDispatchPayload.data.dispatchId, dispatchPayload.data.dispatchId);
        assert.equal(duplicateDispatchPayload.data.workerName, dispatchPayload.data.workerName);
        assert.equal(duplicateDispatchPayload.data.acceptedAt, dispatchPayload.data.acceptedAt);
        assert.equal(Array.isArray(duplicateDispatchPayload.data.warnings), true);
        assert.equal(duplicateDispatchPayload.data.warnings.includes('DUPLICATE_REQUEST'), true);
      } finally {
        await app.close();
      }
    });
  });

  await run('runtime token 未配置时允许访问，配置后需要鉴权', async () => {
    await withRuntimeEnv(async () => {
      const app = await buildHttpServer();
      try {
        const response = await app.inject({ method: 'GET', url: '/status' });
        assert.equal(response.statusCode, 200);
      } finally {
        await app.close();
      }
    });

    await withEnv('CLAWKIT_CONTROLLER_TOKEN', 'runtime-test-token', async () => {
      await withRuntimeEnv(async () => {
        const app = await buildHttpServer();
        try {
          const unauthorized = await app.inject({ method: 'GET', url: '/status' });
          assert.equal(unauthorized.statusCode, 401);

          const authorized = await app.inject({
            method: 'GET',
            url: '/status',
            headers: {
              authorization: 'Bearer runtime-test-token',
            },
          });
          assert.equal(authorized.statusCode, 200);
        } finally {
          await app.close();
        }
      });
    });
  });
}

module.exports = {
  runRuntimeRoutesTests,
};
