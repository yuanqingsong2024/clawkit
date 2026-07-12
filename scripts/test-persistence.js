#!/usr/bin/env node

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const CONTROLLER_PORT = 18787;
const CONTROLLER_HOST = '127.0.0.1';
const DB_PATH = path.join(__dirname, '..', 'data', 'test-persistence.db');

let controllerProcess = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function httpRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CONTROLLER_HOST,
      port: CONTROLLER_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function startController() {
  console.log('\n[启动] 启动 controller...');
  
  const controllerPath = path.join(__dirname, '..', 'packages', 'controller', 'dist', 'index.js');
  
  controllerProcess = spawn('node', [controllerPath], {
    env: {
      ...process.env,
      CONTROLLER_PORT: String(CONTROLLER_PORT),
      CONTROLLER_HOST: CONTROLLER_HOST,
      CONTROLLER_DB_PATH: DB_PATH,
      CONTROLLER_ENABLE_PERSISTENCE: 'true',
    },
    stdio: 'inherit',
  });

  await sleep(2000);
  console.log('[启动] Controller 已启动');
}

async function stopController() {
  if (controllerProcess) {
    console.log('\n[停止] 停止 controller...');
    controllerProcess.kill('SIGTERM');
    await sleep(1000);
    controllerProcess = null;
    console.log('[停止] Controller 已停止');
  }
}

async function cleanupDatabase() {
  const fs = require('fs');
  const files = [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`];
  
  for (const file of files) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`[清理] 已删除 ${file}`);
    }
  }
}

async function testPersistence() {
  console.log('\n========================================');
  console.log('持久化验证测试');
  console.log('========================================\n');

  try {
    await cleanupDatabase();

    await startController();

    console.log('\n[测试 1] 创建任务...');
    const createResp = await httpRequest('POST', '/api/tasks', {
      text: '#研发任务\n\n项目: test-project\n\n目标: 实现用户登录功能，添加 JWT 认证\n\n约束: 密码必须加密\n\n验收: 登录成功返回 token',
    });

    if (createResp.status !== 200 && createResp.status !== 201) {
      throw new Error(`创建任务失败：${JSON.stringify(createResp)}`);
    }

    const taskId = createResp.body.data.taskDraft.taskId;
    console.log(`[测试 1] 任务已创建：${taskId}`);

    console.log('\n[测试 2] 查询任务（重启前）...');
    const queryResp1 = await httpRequest('GET', `/api/tasks/${taskId}`);
    
    if (queryResp1.status !== 200) {
      throw new Error(`查询任务失败：${JSON.stringify(queryResp1)}`);
    }

    console.log(`[测试 2] 任务状态：${queryResp1.body.data.taskDraft.status}`);
    console.log(`[测试 2] 任务意图：${queryResp1.body.data.taskDraft.intent}`);

    await stopController();

    console.log('\n[测试 3] 重启 controller...');
    await startController();

    console.log('\n[测试 4] 查询任务（重启后）...');
    const queryResp2 = await httpRequest('GET', `/api/tasks/${taskId}`);

    if (queryResp2.status !== 200) {
      throw new Error(`重启后查询任务失败：${JSON.stringify(queryResp2)}`);
    }

    console.log(`[测试 4] 任务状态：${queryResp2.body.data.taskDraft.status}`);
    console.log(`[测试 4] 任务意图：${queryResp2.body.data.taskDraft.intent}`);

    if (queryResp2.body.data.taskDraft.taskId !== taskId) {
      throw new Error('任务 ID 不匹配');
    }

    if (queryResp2.body.data.taskDraft.intent !== queryResp1.body.data.taskDraft.intent) {
      throw new Error('任务意图不匹配');
    }

    console.log('\n[测试 5] 列出所有任务...');
    const listResp = await httpRequest('GET', '/api/tasks');

    if (listResp.status !== 200) {
      throw new Error(`列出任务失败：${JSON.stringify(listResp)}`);
    }

    console.log(`[测试 5] 任务总数：${listResp.body.data.tasks.length}`);

    if (listResp.body.data.tasks.length !== 1) {
      throw new Error(`任务数量不正确，期望 1，实际 ${listResp.body.data.tasks.length}`);
    }

    console.log('\n========================================');
    console.log('✅ 持久化验证测试通过');
    console.log('========================================\n');

    await stopController();
    await cleanupDatabase();

    process.exit(0);
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ 持久化验证测试失败');
    console.error('========================================\n');
    console.error(error);

    await stopController();
    await cleanupDatabase();

    process.exit(1);
  }
}

testPersistence();
