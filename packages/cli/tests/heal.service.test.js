const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { ApplyService } = require('../dist/services/apply.service');
const { HealService } = require('../dist/services/heal.service');

function buildManifest(workDir, repoPath) {
  return `profile:
  name: "cli-heal-test"
  version: "1.0.0"
  topology: "all-in-one"
nodes:
  local:
    type: "local"
    workDir: "${workDir.replace(/\\/g, '/')}"
services:
  controller:
    node: "local"
    port: 8787
    apiPrefix: "/api"
    publicUrl: "http://127.0.0.1:8787"
  openClaw:
    node: "local"
    publicUrl: "http://127.0.0.1:8787"
    apiKey: "heal-test-token"
workers:
  - id: "local-worker"
    node: "local"
    connectMode: "pull"
    tags: ["local"]
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

async function runHealServiceTests() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-heal-'));
  const tempHome = path.join(tempDir, 'home');
  const workDir = path.join(tempDir, 'work');
  const manifestPath = path.join(tempDir, 'clawkit.yaml');
  const previousHome = process.env.HOME;
  fs.mkdirSync(tempHome, { recursive: true });
  fs.writeFileSync(manifestPath, buildManifest(workDir, process.cwd()), 'utf8');
  process.env.HOME = tempHome;

  try {
    const applyService = new ApplyService();
    applyService.apply(manifestPath, { dryRun: false });

    const controllerEnvPath = path.join(workDir, 'controller.env');
    const workerEnvPath = path.join(workDir, 'worker-local-worker.env');
    fs.rmSync(controllerEnvPath, { force: true });
    fs.writeFileSync(workerEnvPath, 'BROKEN=1\n', 'utf8');

    const healService = new HealService();
    const dryRunResult = await healService.heal(manifestPath, { dryRun: true });
    assert.equal(dryRunResult.issues.some((issue) => issue.code === 'heal.config.missing'), true);
    assert.equal(dryRunResult.issues.some((issue) => issue.code === 'heal.config.incompatible'), true);
    assert.equal(dryRunResult.plannedFixes.length > 0, true);

    const forceResult = await healService.heal(manifestPath, { force: true });
    assert.equal(forceResult.appliedFixes.length > 0, true);
    assert.equal(fs.existsSync(controllerEnvPath), true);
    assert.equal(fs.readFileSync(workerEnvPath, 'utf8').includes('WORKER_ID=local-worker'), true);
    console.log('✓ HealService：可输出修复计划，并自动修复缺失或损坏的本地配置文件');
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = { runHealServiceTests };
