const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { ApplyService } = require('../dist/services/apply.service');

function buildManifest(workDir, repoPath) {
  return `profile:
  name: "cli-apply-test"
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
  openClaw:
    node: "local"
    publicUrl: "http://127.0.0.1:8787"
    apiKey: "cli-test-token"
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

function runApplyServiceTests() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-apply-'));
  const tempHome = path.join(tempDir, 'home');
  const workDir = path.join(tempDir, 'work');
  const manifestPath = path.join(tempDir, 'clawkit.yaml');
  const previousHome = process.env.HOME;
  fs.mkdirSync(tempHome, { recursive: true });
  fs.writeFileSync(manifestPath, buildManifest(workDir, process.cwd()), 'utf8');

  process.env.HOME = tempHome;

  try {
    const service = new ApplyService();
    const result = service.apply(manifestPath, { dryRun: false });
    const controllerEnvPath = path.join(workDir, 'controller.env');
    const workerEnvPath = path.join(workDir, 'worker-local-worker.env');
    const openClawPath = path.join(tempHome, '.openclaw', 'openclaw.json');

    assert.equal(result.generatedFiles.includes(controllerEnvPath), true);
    assert.equal(result.generatedFiles.includes(workerEnvPath), true);
    assert.equal(result.generatedFiles.includes(openClawPath), true);
    assert.equal(fs.existsSync(controllerEnvPath), true);
    assert.equal(fs.existsSync(workerEnvPath), true);
    assert.equal(fs.existsSync(openClawPath), true);
    assert.equal(fs.readFileSync(controllerEnvPath, 'utf8').includes('OPENCLAW_WEBHOOK_TOKEN=cli-test-token'), true);

    const secondResult = service.apply(manifestPath, { dryRun: false });
    assert.equal(secondResult.backupFiles.length > 0, true);
    console.log('✓ ApplyService：可生成文件、真实写入，并在重复写入前自动备份');
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = { runApplyServiceTests };
