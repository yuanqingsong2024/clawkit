const assert = require('node:assert/strict');

const { ResultSubmitService } = require('../dist/services/result-submit-service');

async function runResultSubmitServiceTests() {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({ success: true }),
      text: async () => '',
    };
  };

  const service = new ResultSubmitService({
    workerId: 'worker-submit-1',
    name: 'worker',
    nodeName: 'local',
    connectMode: 'pull',
    tags: [],
    supportedProjects: ['clawkit'],
    controllerUrl: 'http://localhost:8787',
    heartbeatIntervalMs: 1000,
    pollIntervalMs: 1000,
    manifestPath: undefined,
    openCode: {
      server: {},
      mode: 'sdk',
      timeoutMs: 5000,
      fallbackToPlaceholder: false,
    },
  });

  await service.submitResult({
    taskId: 'task-001',
    workerId: 'worker-submit-1',
    projectKey: 'clawkit',
    status: 'done',
    summary: '执行完成',
    placeholderExecution: false,
    logs: ['done'],
    changedFiles: ['a.ts'],
    commands: ['pnpm build'],
    testResult: '通过',
    rawOutputSummary: 'raw',
    parseStatus: 'structured',
    updatedAt: new Date().toISOString(),
  });

  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.projectKey, 'clawkit');
  assert.deepEqual(body.changedFiles, ['a.ts']);
  console.log('✓ ResultSubmitService：可以回传真实执行结果结构');
}

module.exports = { runResultSubmitServiceTests };
