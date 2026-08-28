const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { PlanServiceImpl } = require('../dist/services/plan.service');
const { StepType } = require('@clawkit/shared');

function buildValidManifest(workDir) {
  return `profile:
  name: "cli-plan-test"
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
    apiKey: "plan-test-token"
workers:
  - id: "test-worker"
    node: "local-dev"
    connectMode: "pull"
    tags: ["local"]
    projects:
      - key: "test-project"
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

function buildSimpleManifest(workDir) {
  return `projects:
  - key: "test-project"
    path: "${workDir.replace(/\\/g, '/')}"
    autoExecute: true
openClaw:
  webhookToken: "plan-test-token"
`;
}

function buildInvalidManifest() {
  return `profile:
  name: "invalid-plan"
  version: "1.0.0"
  topology: "invalid-topology"
nodes: {}
services: {}
workers: []
`;
}

function runPlanServiceTests() {
  console.log('开始 PlanService 测试...');

  // 测试加载不存在的文件
  testLoadManifestNotFound();

  // 测试加载无效 YAML
  testLoadManifestInvalidYaml();

  // 测试加载无效 Schema
  testLoadManifestInvalidSchema();

  // 测试加载简化配置
  testLoadSimpleManifest();

  // 测试加载完整配置
  testLoadFullManifest();

  // 测试生成 dry-run 计划
  testGenerateDryRunPlan();

  // 测试部署模式动作
  testDeploymentModeActions();

  console.log('✓ PlanService 测试通过');
}

function testLoadManifestNotFound() {
  const service = new PlanServiceImpl();
  const result = service.loadManifest('/non/existent/path.yaml');

  assert.ok(result.errors);
  assert.equal(result.errors.length > 0, true);
  assert.ok(result.errors[0].includes('不存在'));

  console.log('  ✓ 加载不存在的文件返回错误');
}

function testLoadManifestInvalidYaml() {
  const service = new PlanServiceImpl();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-plan-'));
  const manifestPath = path.join(tempDir, 'invalid.yaml');

  fs.writeFileSync(manifestPath, 'invalid: yaml: broken', 'utf8');

  try {
    const result = service.loadManifest(manifestPath);
    assert.ok(result.errors);
    assert.ok(result.errors[0].includes('解析失败'));

    console.log('  ✓ 加载无效 YAML 返回解析错误');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testLoadManifestInvalidSchema() {
  const service = new PlanServiceImpl();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-plan-'));
  const manifestPath = path.join(tempDir, 'invalid.yaml');

  fs.writeFileSync(manifestPath, buildInvalidManifest(), 'utf8');

  try {
    const result = service.loadManifest(manifestPath);
    assert.ok(result.errors);
    assert.ok(result.errors.length > 0);

    console.log('  ✓ 加载无效 Schema 返回校验错误');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testLoadSimpleManifest() {
  const service = new PlanServiceImpl();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-plan-'));
  const workDir = path.join(tempDir, 'work');
  const manifestPath = path.join(tempDir, 'simple.yaml');

  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(manifestPath, buildSimpleManifest(workDir), 'utf8');

  try {
    const result = service.loadManifest(manifestPath);
    assert.ok(result.manifest);
    assert.equal(result.errors, undefined);
    // 简化配置转换后的 name 可能是 'clawkit-simple' 或其他默认值
    assert.ok(result.manifest.profile.name);

    console.log('  ✓ 加载简化配置成功');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testLoadFullManifest() {
  const service = new PlanServiceImpl();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-plan-'));
  const workDir = path.join(tempDir, 'work');
  const manifestPath = path.join(tempDir, 'full.yaml');

  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(manifestPath, buildValidManifest(workDir), 'utf8');

  try {
    const result = service.loadManifest(manifestPath);
    assert.ok(result.manifest);
    assert.equal(result.errors, undefined);
    assert.equal(result.manifest.profile.name, 'cli-plan-test');
    assert.equal(result.manifest.profile.topology, 'all-in-one');
    assert.equal(result.manifest.workers.length, 1);

    console.log('  ✓ 加载完整配置成功');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testGenerateDryRunPlan() {
  const service = new PlanServiceImpl();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-plan-'));
  const workDir = path.join(tempDir, 'work');
  const manifestPath = path.join(tempDir, 'plan.yaml');

  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(manifestPath, buildValidManifest(workDir), 'utf8');

  try {
    const { manifest } = service.loadManifest(manifestPath);
    const plan = service.generateDryRunPlan(manifest, manifestPath);

    // 验证计划结构
    assert.ok(plan.name);
    assert.ok(plan.topology);
    assert.ok(Array.isArray(plan.nodes));
    assert.ok(Array.isArray(plan.roles));
    assert.ok(Array.isArray(plan.configs));
    assert.ok(Array.isArray(plan.actions));
    assert.ok(Array.isArray(plan.placeholders));
    assert.ok(plan.executionPlan);

    // 验证节点
    assert.equal(plan.nodes.length >= 1, true);
    assert.equal(plan.nodes[0].type, 'local');

    // 验证执行步骤
    assert.ok(Array.isArray(plan.executionPlan.steps));
    assert.ok(plan.executionPlan.steps.length > 0);

    // 验证执行步骤类型
    const stepTypes = plan.executionPlan.steps.map(s => s.type);
    assert.ok(stepTypes.includes(StepType.HEALTH_CHECK));
    assert.ok(stepTypes.includes(StepType.CREATE_DIR));
    assert.ok(stepTypes.includes(StepType.COPY_FILE));
    assert.ok(stepTypes.includes(StepType.START_SERVICE));

    console.log('  ✓ 生成 dry-run 计划成功');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testDeploymentModeActions() {
  const service = new PlanServiceImpl();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-plan-'));
  const workDir = path.join(tempDir, 'work');
  const manifestPath = path.join(tempDir, 'modes.yaml');
  fs.mkdirSync(workDir, { recursive: true });
  const manifest = buildValidManifest(workDir).replace('publicUrl: "http://127.0.0.1:18000"', 'publicUrl: "http://127.0.0.1:18000"\n    deployMode: "skip"');
  fs.writeFileSync(manifestPath, manifest, 'utf8');
  try {
    const loaded = service.loadManifest(manifestPath);
    assert.ok(loaded.manifest);
    const plan = service.generateDryRunPlan(loaded.manifest, manifestPath);
    const action = plan.actions.find(a => a.description.includes('跳过 OpenClaw 部署'));
    assert.ok(action);
    assert.equal(action.implemented, true);
    console.log('  ✓ skip 模式生成正确动作');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = { runPlanServiceTests };
