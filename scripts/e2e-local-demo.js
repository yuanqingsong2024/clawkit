const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const { buildHttpServer } = require('../packages/controller/dist');
const { Worker } = require('../packages/worker/dist');

function buildManifest(repoPath) {
  return `profile:
  name: "e2e-local-demo"
  version: "1.0.0"
  topology: "all-in-one"
nodes:
  local:
    type: "local"
    workDir: "./.clawkit/e2e"
services:
  controller:
    node: "local"
    port: 8787
    apiPrefix: "/api"
  openClaw:
    node: "local"
    publicUrl: "http://127.0.0.1:8787"
    apiKey: "e2e-local-token"
workers:
  - id: "e2e-worker-1"
    node: "local"
    connectMode: "pull"
    tags: ["e2e"]
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

function requestJson(port, method, pathname, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        raw += chunk;
      });
      response.on('end', () => {
        try {
          resolve({
            statusCode: response.statusCode,
            body: raw.length > 0 ? JSON.parse(raw) : null,
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);
    if (body) {
      request.write(JSON.stringify(body));
    }
    request.end();
  });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-e2e-'));
  const manifestPath = path.join(tempDir, 'clawkit.yaml');
  const port = 18787;
  const previousManifest = process.env.CLAWKIT_MANIFEST_PATH;
  const previousToken = process.env.OPENCLAW_WEBHOOK_TOKEN;

  fs.writeFileSync(manifestPath, buildManifest(process.cwd()), 'utf8');
  process.env.CLAWKIT_MANIFEST_PATH = manifestPath;
  process.env.OPENCLAW_WEBHOOK_TOKEN = 'e2e-local-token';

  const app = await buildHttpServer();
  const worker = new Worker({
    workerId: 'e2e-worker-1',
    name: 'E2E Worker',
    nodeName: 'local',
    connectMode: 'pull',
    tags: ['e2e'],
    supportedProjects: ['clawkit'],
    controllerUrl: `http://127.0.0.1:${port}`,
    heartbeatIntervalMs: 200,
    pollIntervalMs: 200,
    manifestPath,
    openCode: {
      server: {
        baseUrl: 'http://127.0.0.1:1',
        passwordEnv: 'OPENCODE_SERVER_PASSWORD',
      },
      mode: 'sdk',
      timeoutMs: 1000,
      fallbackToPlaceholder: true,
    },
  });

  try {
    await app.listen({ host: '127.0.0.1', port });
    await worker.start();
    await sleep(400);

    const createResponse = await requestJson(port, 'POST', '/api/openclaw/webhook', {
      source: 'openclaw',
      message: '#研发任务\n项目: clawkit\n目标: 验证本地端到端链路\n约束: 使用真实 Worker 与 OpenCodeExecutor，允许 placeholder fallback\n验收: 任务可从 webhook 进入 worker 执行并返回 done',
      operator: {
        id: 'demo-user',
        name: '演示用户',
      },
      sessionKey: 'demo-session',
    }, {
      Authorization: 'Bearer e2e-local-token',
    });

    if (createResponse.statusCode !== 200) {
      throw new Error(`创建任务失败：${JSON.stringify(createResponse.body)}`);
    }

    const taskId = createResponse.body.data.taskId;
    const approveResponse = await requestJson(port, 'POST', '/api/openclaw/webhook', {
      source: 'openclaw',
      message: `#确认派发 ${taskId}`,
      operator: {
        id: 'demo-user',
        name: '演示用户',
      },
      sessionKey: 'demo-session',
    }, {
      Authorization: 'Bearer e2e-local-token',
    });

    if (approveResponse.statusCode !== 200) {
      throw new Error(`确认任务失败：${JSON.stringify(approveResponse.body)}`);
    }

    let finalStatus = null;
    for (let index = 0; index < 40; index += 1) {
      const statusResponse = await requestJson(port, 'GET', `/api/tasks/${taskId}/status`);
      if (statusResponse.statusCode === 200 && ['done', 'failed'].includes(statusResponse.body.data.status)) {
        finalStatus = statusResponse.body.data;
        break;
      }

      await sleep(250);
    }

    if (!finalStatus) {
      throw new Error('等待任务完成超时');
    }

    if (finalStatus.status !== 'done') {
      throw new Error(`任务未成功完成：${JSON.stringify(finalStatus)}`);
    }

    console.log('✓ 单机端到端 demo 通过');
    console.log(`  taskId: ${taskId}`);
    console.log(`  最终状态: ${finalStatus.status}`);
    console.log(`  执行摘要: ${finalStatus.executionSummary?.summary || finalStatus.userSummary}`);
    
    // 明确标注当前执行模式
    if (finalStatus.executionSummary?.placeholderExecution) {
      console.log('');
      console.log('⚠️  注意：当前为占位执行模式（placeholder fallback）');
      console.log('   这只能证明链路打通，不代表真实 OpenCode 执行已验收');
      console.log('   若要验证真实执行能力，请参考 docs/e2e.md 中的严格验收步骤');
    } else {
      console.log('');
      console.log('✓ 真实 OpenCode 执行验证通过');
    }
  } finally {
    await worker.stop();
    await app.close();
    if (previousManifest === undefined) {
      delete process.env.CLAWKIT_MANIFEST_PATH;
    } else {
      process.env.CLAWKIT_MANIFEST_PATH = previousManifest;
    }
    if (previousToken === undefined) {
      delete process.env.OPENCLAW_WEBHOOK_TOKEN;
    } else {
      process.env.OPENCLAW_WEBHOOK_TOKEN = previousToken;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('✗ 单机端到端 demo 失败');
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
