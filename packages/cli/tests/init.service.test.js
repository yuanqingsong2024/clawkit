const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { InitService } = require('../dist/services/init.service');

function runInitServiceTests() {
  console.log('开始 InitService 测试...');

  // 测试 generateSimpleManifest
  testGenerateSimpleManifest();

  // 测试 generateManifest (all-in-one 预设)
  testGenerateManifestAllInOne();

  // 测试 generateManifest (hybrid 预设)
  testGenerateManifestHybrid();

  // 测试 writeToFile
  testWriteToFile();

  // 测试 fileExists
  testFileExists();

  console.log('✓ InitService 测试通过');
}

function testGenerateSimpleManifest() {
  const service = new InitService();
  const options = {
    projects: [
      {
        key: 'test-project',
        path: '/path/to/project',
        autoExecute: false,
        dangerousOps: ['delete', 'drop'],
      },
    ],
    webhookToken: 'test-token-123',
    openClawUrl: 'http://127.0.0.1:18000',
  };

  const yaml = service.generateSimpleManifest(options);

  assert.ok(yaml.includes('test-project'));
  assert.ok(yaml.includes('/path/to/project'));
  assert.ok(yaml.includes('test-token-123'));
  assert.ok(yaml.includes('http://127.0.0.1:18000'));
  assert.ok(yaml.includes('delete'));
  assert.ok(yaml.includes('drop'));

  console.log('  ✓ generateSimpleManifest: 正确生成简化配置 YAML');
}

function testGenerateManifestAllInOne() {
  const service = new InitService();
  const options = {
    topology: 'all-in-one',
    name: 'test-allinone',
    enableMemory: true,
    memoryProvider: 'local',
    enableNotify: false,
  };

  const yaml = service.generateManifest(options);

  assert.ok(yaml.includes('test-allinone'));
  assert.ok(yaml.includes('all-in-one'));
  assert.ok(yaml.includes('local-dev'));
  assert.ok(yaml.includes('local'));
  assert.ok(yaml.includes('local') && yaml.includes('provider')); // memory 配置

  console.log('  ✓ generateManifest (all-in-one): 正确生成完整配置 YAML');
}

function testGenerateManifestHybrid() {
  const service = new InitService();
  const options = {
    topology: 'hybrid',
    name: 'test-hybrid',
    enableMemory: true,
    memoryProvider: 'redis',
    enableNotify: true,
  };

  const yaml = service.generateManifest(options);

  assert.ok(yaml.includes('test-hybrid'));
  assert.ok(yaml.includes('hybrid'));
  assert.ok(yaml.includes('cloud-control'));
  assert.ok(yaml.includes('local-dev'));
  assert.ok(yaml.includes('redis'));
  assert.ok(yaml.includes('enabled: true')); // notify enabled

  console.log('  ✓ generateManifest (hybrid): 正确生成混合拓扑配置 YAML');
}

function testWriteToFile() {
  const service = new InitService();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-init-'));
  const outputPath = path.join(tempDir, 'test-output.yaml');
  const yamlContent = 'test: true\n';

  service.writeToFile(yamlContent, outputPath);

  assert.equal(fs.existsSync(outputPath), true);
  assert.equal(fs.readFileSync(outputPath, 'utf8'), yamlContent);

  // 清理
  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log('  ✓ writeToFile: 正确写入文件');
}

function testFileExists() {
  const service = new InitService();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-init-'));
  const existingFile = path.join(tempDir, 'existing.yaml');
  const nonExistingFile = path.join(tempDir, 'non-existing.yaml');

  fs.writeFileSync(existingFile, 'test', 'utf8');

  assert.equal(service.fileExists(existingFile), true);
  assert.equal(service.fileExists(nonExistingFile), false);

  // 清理
  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log('  ✓ fileExists: 正确判断文件是否存在');
}

module.exports = { runInitServiceTests };
