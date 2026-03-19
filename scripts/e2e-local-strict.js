const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const { buildHttpServer } = require('../packages/controller/dist');
const { Worker } = require('../packages/worker/dist');

function buildManifest(repoPath) {
  return `profile:
  name: "e2e-strict-demo"
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
    apiKey: "e2e-strict-token"
workers:
  - id: "e2e-strict-worker-1"
    node: "local"
    connectMode: "pull"
    tags: ["e2e-strict"]
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

function checkPrerequisites() {
  console.log('检查前置条件...');
  
  const opencodeCheck = spawnSync('which', ['opencode']);
  if (opencodeCheck.status !== 0) {
    throw new Error('❌ 未找到 opencode 命令\n   请先安装 OpenCode CLI: npm install -g @opencode-ai/cli');
  }
  console.log('✓ opencode 命令可用');
  
  if (!process.env.OPENCODE_SERVER_PASSWORD) {
    throw new Error('❌ 未设置 OPENCODE_SERVER_PASSWORD 环境变量\n   请先设置: export OPENCODE_SERVER_PASSWORD="your-password"');
  }
  console.log('✓ OPENCODE_SERVER_PASSWORD 已设置');
}

function startOpenCodeServer() {
  console.log('启动 OpenCode server...');
  
  const server = spawn('opencode', ['serve', '--hostname', '127.0.0.1', '--port', '4096'], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      OPENCODE_SERVER_USERNAME: 'opencode',
    },
  });
  
  server.unref();
  
  return server;
}

async function waitForServer(url, timeoutMs) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const request = http.get(url, (response) => {
          if (response.statusCode === 200 || response.statusCode === 404) {
            resolve();
          } else {
            reject(new Error(`Server returned ${response.statusCode}`));
          }
        });
        request.on('error', reject);
        request.setTimeout(1000);
      });
      
      return true;
    } catch (error) {
      await sleep(500);
    }
  }
  
  return false;
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
  checkPrerequisites();
  
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-e2e-strict-'));
  const manifestPath = path.join(tempDir, 'clawkit.yaml');
  const port = 18788;
  const previousManifest = process.env.CLAWKIT_MANIFEST_PATH;
  const previousToken = process.env.OPENCLAW_WEBHOOK_TOKEN;
  
  let opencodeServer = null;
  let app = null;
  let worker = null;

  try {
    opencodeServer = startOpenCodeServer();
    
    console.log('等待 OpenCode server 就绪...');
    const serverReady = await waitForServer('http://127.0.0.1:4096', 30000);
    if (!serverReady) {
      throw new Error('OpenCode server 启动超时');
    }
    console.log('✓ OpenCode server 已就绪');

    fs.writeFileSync(manifestPath, buildManifest(process.cwd()), 'utf8');
    process.env.CLAWKIT_MANIFEST_PATH = manifestPath;
    process.env.OPENCLAW_WEBHOOK_TOKEN = 'e2e-strict-token';

    app = await buildHttpServer();
    worker = new Worker({
      workerId: 'e2e-strict-worker-1',
      name: 'E2E Strict Worker',
      nodeName: 'local',
      connectMode: 'pull',
      tags: ['e2e-strict'],
      supportedProjects: ['clawkit'],
      controllerUrl: `http://127.0.0.1:${port}`,
      heartbeatIntervalMs: 200,
      pollIntervalMs: 200,
      manifestPath,
      openCode: {
        server: {
          baseUrl: 'http://127.0.0.1:4096',
          passwordEnv: 'OPENCODE_SERVER_PASSWORD',
        },
        mode: 'sdk',
        timeoutMs: 30000,
        fallbackToPlaceholder: false,
      },
    });

    await app.listen({ host: '127.0.0.1', port });
    await worker.start();
    await sleep(400);

    const createResponse = await requestJson(port, 'POST', '/api/openclaw/webhook', {
      source: 'openclaw',
      message: '#研发任务\n项目: clawkit\n目标: 验证真实 OpenCode 执行\n约束: 必须使用真实 OpenCode，不允许 placeholder fallback\n验收: placeholderExecution 必须为 false',
      operator: {
        id: 'strict-user',
        name: '严格验证用户',
      },
      sessionKey: 'strict-session',
    }, {
      Authorization: 'Bearer e2e-strict-token',
    });

    if (createResponse.statusCode !== 200) {
      throw new Error(`创建任务失败：${JSON.stringify(createResponse.body)}`);
    }

    const taskId = createResponse.body.data.taskId;
    const approveResponse = await requestJson(port, 'POST', '/api/openclaw/webhook', {
      source: 'openclaw',
      message: `#确认派发 ${taskId}`,
      operator: {
        id: 'strict-user',
        name: '严格验证用户',
      },
      sessionKey: 'strict-session',
    }, {
      Authorization: 'Bearer e2e-strict-token',
    });

    if (approveResponse.statusCode !== 200) {
      throw new Error(`确认任务失败：${JSON.stringify(approveResponse.body)}`);
    }

    let finalStatus = null;
    for (let index = 0; index < 80; index += 1) {
      const statusResponse = await requestJson(port, 'GET', `/api/tasks/${taskId}/status`);
      if (statusResponse.statusCode === 200 && ['done', 'failed'].includes(statusResponse.body.data.status)) {
        finalStatus = statusResponse.body.data;
        break;
      }

      await sleep(500);
    }

    if (!finalStatus) {
      throw new Error('等待任务完成超时（40 秒）');
    }

    if (finalStatus.status !== 'done') {
      throw new Error(`任务未成功完成：${JSON.stringify(finalStatus)}`);
    }

    if (finalStatus.executionSummary?.placeholderExecution !== false) {
      throw new Error(`❌ 验证失败：placeholderExecution=${finalStatus.executionSummary?.placeholderExecution}\n   当前仍为占位执行模式，不是真实 OpenCode 执行`);
    }

    console.log('');
    console.log('✓ 严格真实执行验证通过');
    console.log(`  taskId: ${taskId}`);
    console.log(`  最终状态: ${finalStatus.status}`);
    console.log(`  placeholderExecution: ${finalStatus.executionSummary?.placeholderExecution}`);
    console.log(`  执行摘要: ${finalStatus.executionSummary?.summary || finalStatus.userSummary}`);
    console.log('');
    console.log('✓ 真实 OpenCode 执行能力验证完成');
  } finally {
    if (worker) {
      await worker.stop();
    }
    if (app) {
      await app.close();
    }
    if (opencodeServer) {
      try {
        process.kill(-opencodeServer.pid);
      } catch (error) {
      }
    }
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
  console.error('');
  console.error('✗ 严格真实执行验证失败');
  console.error(error.message || error.stack);
  console.error('');
  process.exitCode = 1;
});
