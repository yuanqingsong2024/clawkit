const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { DoctorServiceImpl } = require('../dist/services/doctor.service');
const { CheckStatus } = require('@clawkit/shared');

function buildSimpleManifest(workDir) {
  return `projects:
  - key: "clawkit"
    path: "${workDir.replace(/\\/g, '/')}"
    autoExecute: true
openClaw:
  webhookToken: "doctor-test-token"
  url: "http://127.0.0.1:18000"
`;
}

function buildFullManifest(workDir) {
  return `profile:
  name: "cli-doctor-test"
  version: "1.0.0"
  topology: "all-in-one"
nodes:
  local-dev:
    type: "local"
    workDir: "${workDir.replace(/\\/g, '/')}"
services:
  controller:
    node: "local-dev"
    port: 8787
    apiPrefix: "/api"
    publicUrl: "http://127.0.0.1:8787"
  openClaw:
    node: "local-dev"
    publicUrl: "http://127.0.0.1:18000"
    apiKey: "doctor-test-token"
workers:
  - id: "test-worker"
    node: "local-dev"
    connectMode: "pull"
    tags: ["local"]
    projects:
      - key: "clawkit"
        repoPath: "${workDir.replace(/\\/g, '/')}"
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

function buildInvalidManifest() {
  return `invalid: yaml
  - this is: broken
    format: yes
`;
}

async function runDoctorServiceTests() {
  console.log('开始 DoctorService 测试...');

  // 测试配置文件不存在
  await testFileNotExists();

  // 测试 YAML 语法错误
  await testInvalidYaml();

  // 测试简化配置校验
  await testSimpleManifest();

  // 测试完整配置校验
  await testFullManifest();

  // 测试服务端口冲突
  await testPortConflict();

  console.log('✓ DoctorService 测试通过');
}

async function testFileNotExists() {
  const service = new DoctorServiceImpl();
  const result = await service.diagnose('/non/existent/path.yaml');

  const fileCheck = result.checks.find(c => c.name === 'Manifest 文件存在性');
  assert.ok(fileCheck);
  assert.equal(fileCheck.status, CheckStatus.FAIL);
  assert.ok(fileCheck.message.includes('不存在'));

  console.log('  ✓ 配置文件不存在时正确返回 FAIL 状态');
}

async function testInvalidYaml() {
  const service = new DoctorServiceImpl();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-doctor-'));
  const manifestPath = path.join(tempDir, 'invalid.yaml');

  fs.writeFileSync(manifestPath, buildInvalidManifest(), 'utf8');

  try {
    const result = await service.diagnose(manifestPath);
    const syntaxCheck = result.checks.find(c => c.name === 'YAML 语法检查');
    assert.ok(syntaxCheck);
    assert.equal(syntaxCheck.status, CheckStatus.FAIL);
    assert.ok(syntaxCheck.message.includes('解析失败'));

    console.log('  ✓ YAML 语法错误时正确返回 FAIL 状态');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function testSimpleManifest() {
  const service = new DoctorServiceImpl();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-doctor-'));
  const workDir = path.join(tempDir, 'work');
  const manifestPath = path.join(tempDir, 'simple.yaml');

  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(manifestPath, buildSimpleManifest(workDir), 'utf8');

  try {
    const result = await service.diagnose(manifestPath);

    // 文件存在检查应该通过
    const fileCheck = result.checks.find(c => c.name === 'Manifest 文件存在性');
    assert.ok(fileCheck);
    assert.equal(fileCheck.status, CheckStatus.PASS);

    // YAML 语法检查应该通过
    const syntaxCheck = result.checks.find(c => c.name === 'YAML 语法检查');
    assert.ok(syntaxCheck);
    assert.equal(syntaxCheck.status, CheckStatus.PASS);

    console.log('  ✓ 简化配置校验通过');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function testFullManifest() {
  const service = new DoctorServiceImpl();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-doctor-'));
  const workDir = path.join(tempDir, 'work');
  const manifestPath = path.join(tempDir, 'full.yaml');

  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(manifestPath, buildFullManifest(workDir), 'utf8');

  try {
    const result = await service.diagnose(manifestPath);

    // 文件存在检查应该通过
    const fileCheck = result.checks.find(c => c.name === 'Manifest 文件存在性');
    assert.ok(fileCheck);
    assert.equal(fileCheck.status, CheckStatus.PASS);

    // Schema 校验应该通过
    const schemaCheck = result.checks.find(c => c.name === 'Schema 校验');
    assert.ok(schemaCheck);
    assert.equal(schemaCheck.status, CheckStatus.PASS);

    // Node.js 版本检查应该通过
    const nodeCheck = result.checks.find(c => c.name === 'Node.js 版本检查');
    assert.ok(nodeCheck);
    assert.equal(nodeCheck.status, CheckStatus.PASS);

    console.log('  ✓ 完整配置校验通过');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function testPortConflict() {
  const service = new DoctorServiceImpl();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-doctor-'));
  const manifestPath = path.join(tempDir, 'conflict.yaml');
  const workDir = path.join(tempDir, 'work');
  fs.mkdirSync(workDir, { recursive: true });
  const manifest = buildFullManifest(workDir).replace('port: 4096', 'port: 8787');
  fs.writeFileSync(manifestPath, manifest, 'utf8');
  try {
    const result = await service.diagnose(manifestPath);
    const conflict = result.checks.find(c => c.name === '端口冲突检查');
    assert.ok(conflict);
    assert.equal(conflict.status, CheckStatus.FAIL);
    console.log('  ✓ 端口冲突时正确返回 FAIL 状态');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = { runDoctorServiceTests };
