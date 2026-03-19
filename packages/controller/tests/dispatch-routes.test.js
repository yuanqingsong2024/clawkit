const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildHttpServer } = require('../dist');
const { TaskStatus } = require('@clawkit/shared');

async function runDispatchRoutesTests() {
  const previousPersistence = process.env.CONTROLLER_ENABLE_PERSISTENCE;
  process.env.CONTROLLER_ENABLE_PERSISTENCE = 'false';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-manifest-'));
  const manifestPath = path.join(tempDir, 'clawkit.yaml');
  fs.writeFileSync(manifestPath, `profile:\n  name: "test"\n  version: "1.0.0"\n  topology: "all-in-one"\nnodes:\n  local:\n    type: "local"\n    workDir: "."\nservices:\n  controller:\n    node: "local"\n    port: 8787\n    apiPrefix: "/api"\n  openClaw:\n    node: "local"\n    publicUrl: "http://127.0.0.1:3000"\nworkers:\n  - id: "worker-http-1"\n    node: "local"\n    connectMode: "pull"\n    tags: ["test"]\n    projects:\n      - key: "clawkit"\n        repoPath: "${process.cwd().replace(/\\/g, '\\\\')}"\n        baseBranch: "main"\n        openCode:\n          port: 4096\n          agent: "build"\n          mode: "default"\nruntime:\n  promptEngine:\n    mode: "template"\n  memory:\n    enabled: true\n    provider: "local"\n    path: "./data/memory"\n`, 'utf8');
  const previousManifestPath = process.env.CLAWKIT_MANIFEST_PATH;
  process.env.CLAWKIT_MANIFEST_PATH = manifestPath;
  const app = await buildHttpServer();

  try {
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/workers/register',
      payload: {
        workerId: 'worker-http-1',
        name: 'HTTP Worker 1',
        nodeName: 'local',
        connectMode: 'pull',
        tags: ['clawkit'],
        supportedProjects: ['clawkit'],
      },
    });

    assert.equal(registerResponse.statusCode, 201);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: {
        text: '#研发任务\n项目: clawkit\n目标: 验证派发查询接口\n约束: 只做占位执行\n验收: 可以按 taskId 查询 dispatch',
      },
    });

    assert.equal(createResponse.statusCode, 201);
    const taskId = createResponse.json().data.taskDraft.taskId;

    const approveResponse = await app.inject({
      method: 'POST',
      url: `/api/approval/${taskId}/approve`,
      payload: {
        operator: '测试审批人',
        comment: '允许派发',
      },
    });

    assert.equal(approveResponse.statusCode, 200);
    assert.equal(approveResponse.json().data.status, TaskStatus.DISPATCHED);

    const fetchResponse = await app.inject({
      method: 'GET',
      url: `/api/dispatches/${taskId}`,
    });

    assert.equal(fetchResponse.statusCode, 200);
    const fetchPayload = fetchResponse.json();
    assert.equal(fetchPayload.success, true);
    assert.equal(fetchPayload.data.taskId, taskId);
    assert.equal(fetchPayload.data.workerId, 'worker-http-1');

    console.log('✓ dispatch 路由：可以按 /api/dispatches/:taskId 查询派发记录');
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
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = { runDispatchRoutesTests };
