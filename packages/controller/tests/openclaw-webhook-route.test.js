const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { TaskStatus } = require('@clawkit/shared');
const { buildHttpServer } = require('../dist');

function buildManifest(repoPath) {
  return `profile:
  name: "openclaw-webhook-test"
  version: "1.0.0"
  topology: "all-in-one"
nodes:
  local:
    type: "local"
    workDir: "."
services:
  controller:
    node: "local"
    port: 8787
    apiPrefix: "/api"
  openClaw:
    node: "local"
    publicUrl: "http://127.0.0.1:8787"
    apiKey: "test-openclaw-token"
workers:
  - id: "worker-webhook-1"
    node: "local"
    connectMode: "pull"
    tags: ["test"]
    projects:
      - key: "clawkit"
        repoPath: "${repoPath.replace(/\\/g, '\\\\')}"
        baseBranch: "main"
        openCode:
          port: 4096
          agent: "build"
          mode: "default"
runtime:
  promptEngine:
    mode: "template"
  memory:
    enabled: true
    provider: "local"
    path: "./data/memory"
`;
}

async function runOpenClawWebhookRouteTests() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-openclaw-'));
  const manifestPath = path.join(tempDir, 'clawkit.yaml');
  const previousManifestPath = process.env.CLAWKIT_MANIFEST_PATH;
  const previousToken = process.env.OPENCLAW_WEBHOOK_TOKEN;
  const previousPersistence = process.env.CONTROLLER_ENABLE_PERSISTENCE;

  fs.writeFileSync(manifestPath, buildManifest(process.cwd()), 'utf8');
  process.env.CLAWKIT_MANIFEST_PATH = manifestPath;
  process.env.OPENCLAW_WEBHOOK_TOKEN = 'test-openclaw-token';
  process.env.CONTROLLER_ENABLE_PERSISTENCE = 'false';

  const app = await buildHttpServer();

  try {
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/workers/register',
      payload: {
        workerId: 'worker-webhook-1',
        name: 'Webhook Worker',
        nodeName: 'local',
        connectMode: 'pull',
        tags: ['test'],
        supportedProjects: ['clawkit'],
      },
    });
    assert.equal(registerResponse.statusCode, 201);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/openclaw/webhook',
      headers: {
        authorization: 'Bearer test-openclaw-token',
      },
      payload: {
        source: 'openclaw',
        message: '#研发任务\n项目: clawkit\n目标: 验证 OpenClaw webhook 真接入\n约束: 保持最小可用\n验收: 可以创建草稿并进入执行链路',
        operator: {
          id: 'tester',
          name: '测试用户',
        },
        sessionKey: 'session-webhook-1',
      },
    });
    assert.equal(createResponse.statusCode, 200);
    const createPayload = createResponse.json();
    const taskId = createPayload.data.taskId;
    assert.equal(createPayload.data.status, TaskStatus.WAITING_APPROVAL);

    const approveResponse = await app.inject({
      method: 'POST',
      url: '/api/openclaw/webhook',
      headers: {
        authorization: 'Bearer test-openclaw-token',
      },
      payload: {
        source: 'openclaw',
        message: `#确认派发 ${taskId}`,
        operator: {
          id: 'tester',
          name: '测试用户',
        },
        sessionKey: 'session-webhook-1',
      },
    });
    assert.equal(approveResponse.statusCode, 200);
    const approvePayload = approveResponse.json();
    assert.equal(approvePayload.data.status, TaskStatus.DISPATCHED);
    assert.equal(approvePayload.data.userMessage.includes('开始执行'), true);

    const pullResponse = await app.inject({
      method: 'GET',
      url: '/api/workers/worker-webhook-1/pull',
    });
    assert.equal(pullResponse.statusCode, 200);
    const pullPayload = pullResponse.json();
    assert.equal(pullPayload.data.hasTask, true);
    assert.equal(pullPayload.data.task.taskId, taskId);

    const submitResponse = await app.inject({
      method: 'POST',
      url: '/api/workers/worker-webhook-1/result',
      payload: {
        taskId,
        status: 'done',
        workerId: 'worker-webhook-1',
        projectKey: 'clawkit',
        summary: '已完成 OpenClaw webhook 真接入',
        placeholderExecution: false,
        logs: ['执行完成'],
        changedFiles: ['packages/controller/src/http/services/openclaw-adapter.ts'],
        commands: ['pnpm --filter @clawkit/controller test'],
        testResult: '控制器测试通过',
        rawOutputSummary: '执行完成',
        parseStatus: 'structured',
        updatedAt: new Date().toISOString(),
      },
    });
    assert.equal(submitResponse.statusCode, 200);

    const statusResponse = await app.inject({
      method: 'POST',
      url: '/api/openclaw/webhook',
      headers: {
        authorization: 'Bearer test-openclaw-token',
      },
      payload: {
        source: 'openclaw',
        message: `#任务状态 ${taskId}`,
        operator: {
          id: 'tester',
          name: '测试用户',
        },
        sessionKey: 'session-webhook-1',
      },
    });
    assert.equal(statusResponse.statusCode, 200);
    const statusPayload = statusResponse.json();
    assert.equal(statusPayload.data.status, TaskStatus.DONE);
    assert.equal(statusPayload.data.userMessage.includes('任务执行完成'), true);
    assert.equal(statusPayload.data.latestSummary, '已完成 OpenClaw webhook 真接入');
    console.log('✓ OpenClaw webhook 路由：可完成创建草稿、确认派发、结果回查最小链路');
  } finally {
    await app.close();
    if (previousPersistence === undefined) {
      delete process.env.CONTROLLER_ENABLE_PERSISTENCE;
    } else {
      process.env.CONTROLLER_ENABLE_PERSISTENCE = previousPersistence;
    }
    if (previousManifestPath === undefined) {
      delete process.env.CLAWKIT_MANIFEST_PATH;
    } else {
      process.env.CLAWKIT_MANIFEST_PATH = previousManifestPath;
    }
    if (previousToken === undefined) {
      delete process.env.OPENCLAW_WEBHOOK_TOKEN;
    } else {
      process.env.OPENCLAW_WEBHOOK_TOKEN = previousToken;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = { runOpenClawWebhookRouteTests };
