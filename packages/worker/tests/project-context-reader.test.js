const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { ProjectContextReader } = require('../dist');

async function runProjectContextReaderTests() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-project-context-'));
  fs.mkdirSync(path.join(tempDir, '.opencode', 'commands'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'skills'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), '# 项目规则\n请使用中文', 'utf8');
  fs.writeFileSync(path.join(tempDir, '.opencode', 'commands', 'fix.md'), 'fix', 'utf8');
  fs.writeFileSync(path.join(tempDir, 'skills', 'custom.md'), 'skill', 'utf8');
  fs.writeFileSync(path.join(tempDir, '.opencode', 'oh-my-opencode.jsonc'), '{"mode":"safe"}', 'utf8');

  try {
    const reader = new ProjectContextReader();
    const result = await reader.read('clawkit', tempDir, 'main');

    assert.equal(result.agentsExists, true);
    assert.equal(result.commandsExists, true);
    assert.equal(result.skillsExists, true);
    assert.equal(result.ohMyOpencodeExists, true);
    assert.deepEqual(result.commandEntries, ['fix.md']);
    assert.deepEqual(result.skillEntries, ['custom.md']);
    console.log('✓ ProjectContextReader：可以读取 AGENTS.md 与项目上下文目录');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = { runProjectContextReaderTests };
