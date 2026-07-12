#!/usr/bin/env node

const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

const CONTROLLER_PORT = 18788;
const BASE_URL = `http://127.0.0.1:${CONTROLLER_PORT}`;

let controllerProcess = null;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: CONTROLLER_PORT,
      path,
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function startController() {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      CONTROLLER_PORT: String(CONTROLLER_PORT),
      CONTROLLER_ENABLE_PERSISTENCE: 'false',
      CLAWKIT_MANIFEST_PATH: path.join(__dirname, '../examples/all-in-one.yaml'),
    };

    controllerProcess = spawn('node', ['./packages/controller/dist/index.js'], {
      cwd: path.join(__dirname, '..'),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    controllerProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server listening')) {
        setTimeout(resolve, 500);
      }
    });

    controllerProcess.stderr.on('data', (data) => {
      console.error('Controller stderr:', data.toString());
    });

    controllerProcess.on('error', reject);
    controllerProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Controller 退出，代码: ${code}`));
      }
    });

    setTimeout(() => reject(new Error('Controller 启动超时')), 10000);
  });
}

function stopController() {
  if (controllerProcess) {
    controllerProcess.kill('SIGTERM');
    controllerProcess = null;
  }
}

async function testSetupWizardFlow() {
  console.log('=== Setup 向导流程测试 ===\n');

  try {
    console.log('1. 启动 controller...');
    await startController();
    console.log('✓ Controller 已启动\n');

    console.log('2. 获取 schema...');
    const schemaRes = await request('GET', '/api/setup/schema');
    if (schemaRes.status !== 200 || !schemaRes.data.success) {
      throw new Error('获取 schema 失败');
    }
    console.log('✓ Schema 获取成功\n');

    console.log('3. 获取默认配置...');
    const defaultsRes = await request('GET', '/api/setup/defaults');
    if (defaultsRes.status !== 200 || !defaultsRes.data.success) {
      throw new Error('获取默认配置失败');
    }
    const presets = defaultsRes.data.data.presets;
    console.log(`✓ 获取到 ${presets.length} 个预设配置\n`);

    console.log('4. 解析 all-in-one 预设...');
    const allInOnePreset = presets.find((p) => p.key === 'all-in-one');
    if (!allInOnePreset) {
      throw new Error('未找到 all-in-one 预设');
    }
    const yaml = require('yaml');
    const manifestObj = yaml.parse(allInOnePreset.yamlText);
    console.log('✓ YAML 解析成功\n');

    console.log('5. 启动 setup run...');
    const startRes = await request('POST', '/api/setup/runs', {
      formData: manifestObj,
    });
    if (startRes.status !== 201 || !startRes.data.success) {
      console.error('启动失败响应:', JSON.stringify(startRes, null, 2));
      throw new Error('启动 setup run 失败');
    }
    const runId = startRes.data.data.run.runId;
    console.log(`✓ Setup run 已启动: ${runId}\n`);

    console.log('6. 查询 run 详情...');
    const detailRes = await request('GET', `/api/setup/runs/${runId}`);
    if (detailRes.status !== 200 || !detailRes.data.success) {
      throw new Error('查询 run 详情失败');
    }
    const detail = detailRes.data.data;
    console.log(`✓ Run 状态: ${detail.run.status}`);
    console.log(`✓ 步骤数量: ${detail.steps.length}\n`);

    console.log('7. 等待执行完成...');
    let finalStatus = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const statusRes = await request('GET', `/api/setup/runs/${runId}`);
      const currentStatus = statusRes.data.data.run.status;
      
      if (currentStatus !== 'running' && currentStatus !== 'ready') {
        finalStatus = currentStatus;
        break;
      }
      
      const runningStep = statusRes.data.data.run.currentStep;
      if (runningStep) {
        console.log(`  当前步骤: ${runningStep}`);
      }
    }

    if (!finalStatus) {
      throw new Error('执行超时（30秒）');
    }

    console.log(`\n✓ 执行完成，最终状态: ${finalStatus}\n`);

    console.log('8. 查询最终结果...');
    const finalRes = await request('GET', `/api/setup/runs/${runId}`);
    const finalDetail = finalRes.data.data;
    
    console.log('步骤执行结果:');
    for (const step of finalDetail.steps) {
      const icon = step.status === 'success' ? '✓' : step.status === 'failed' ? '✗' : '○';
      console.log(`  ${icon} ${step.title}: ${step.status}`);
      if (step.errorMessage) {
        console.log(`    错误: ${step.errorMessage}`);
      }
    }

    if (finalDetail.run.summary) {
      console.log('\n执行摘要:');
      console.log(finalDetail.run.summary);
    }

    console.log('\n=== 测试完成 ===');
    
    if (finalStatus === 'success' || finalStatus === 'partial_success') {
      console.log('✓ Setup 向导流程验证通过');
      return true;
    } else {
      console.log('✗ Setup 执行失败');
      return false;
    }

  } catch (error) {
    console.error('\n✗ 测试失败:', error.message);
    return false;
  } finally {
    stopController();
  }
}

testSetupWizardFlow()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('未捕获错误:', error);
    stopController();
    process.exit(1);
  });
