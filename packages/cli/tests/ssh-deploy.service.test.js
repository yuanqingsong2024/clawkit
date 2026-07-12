const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// 修正相对路径（测试文件在 tests/ 目录，需要 ../dist/...）
const { SshConnectionPool } = require('../dist/services/ssh-connection-pool');
const { SshCommandExecutor } = require('../dist/services/ssh-command-executor');
const { SshFileSync, TransferMode } = require('../dist/services/ssh-file-sync');
const { SystemdServiceManager, SystemdServiceState } = require('../dist/services/systemd-service-manager');
const { SshDeployService, DeployStatus } = require('../dist/services/ssh-deploy-service');

// 模拟 SSH 节点配置
function buildMockSshNode() {
  return {
    host: '127.0.0.1',
    port: 22,
    user: process.env.USER || 'root',
    keyPath: null, // 使用 ssh-agent 或无密码 SSH
  };
}

async function runSshConnectionPoolTests() {
  console.log('\n📡 测试 SSH 连接池...');

  const pool = new SshConnectionPool({
    connectionTimeout: 5000,
    commandTimeout: 30000,
  });

  // 测试连接池初始状态
  assert.equal(pool.getPoolSize(), 0, '初始连接池大小应为 0');
  assert.equal(pool.getActiveConnections(), 0, '初始活跃连接数应为 0');

  // 测试连接状态
  const status = pool.getStatus();
  assert.ok(status.hasOwnProperty('poolSize'), '状态应包含 poolSize');
  assert.ok(status.hasOwnProperty('activeConnections'), '状态应包含 activeConnections');
  assert.ok(status.hasOwnProperty('connections'), '状态应包含 connections');

  // 关闭连接池
  await pool.close();
  console.log('✓ SshConnectionPool：基础功能正常');
}

async function runSshCommandExecutorTests() {
  console.log('\n🔧 测试命令执行器...');

  const pool = new SshConnectionPool();
  const executor = new SshCommandExecutor(pool);

  // 验证方法存在（类的方法在 prototype 上）
  assert.ok(typeof executor.execute === 'function', '应包含 execute 方法');
  assert.ok(typeof executor.executePipe === 'function', '应包含 executePipe 方法');
  assert.ok(typeof executor.executeScript === 'function', '应包含 executeScript 方法');
  assert.ok(typeof executor.commandExists === 'function', '应包含 commandExists 方法');
  assert.ok(typeof executor.getSystemInfo === 'function', '应包含 getSystemInfo 方法');

  await pool.close();
  console.log('✓ SshCommandExecutor：接口正确');
}

async function runSshFileSyncTests() {
  console.log('\n📁 测试文件同步服务...');

  const pool = new SshConnectionPool();
  const fileSync = new SshFileSync(pool, {
    defaultMode: TransferMode.RSYNC,
    maxParallelTransfers: 2,
  });

  // 验证方法存在
  assert.ok(typeof fileSync.syncDirectory === 'function', '应包含 syncDirectory 方法');
  assert.ok(typeof fileSync.syncFile === 'function', '应包含 syncFile 方法');
  assert.ok(typeof fileSync.isRsyncAvailable === 'function', '应包含 isRsyncAvailable 方法');

  await pool.close();
  console.log('✓ SshFileSync：接口正确');
}

async function runSystemdServiceManagerTests() {
  console.log('\n⚙️ 测试 systemd 服务管理器...');

  const pool = new SshConnectionPool();
  const systemdManager = new SystemdServiceManager(pool);

  // 验证接口存在
  assert.ok(typeof systemdManager.install === 'function', '应包含 install 方法');
  assert.ok(typeof systemdManager.start === 'function', '应包含 start 方法');
  assert.ok(typeof systemdManager.stop === 'function', '应包含 stop 方法');
  assert.ok(typeof systemdManager.restart === 'function', '应包含 restart 方法');
  assert.ok(typeof systemdManager.enable === 'function', '应包含 enable 方法');
  assert.ok(typeof systemdManager.disable === 'function', '应包含 disable 方法');
  assert.ok(typeof systemdManager.getServiceState === 'function', '应包含 getServiceState 方法');
  assert.ok(typeof systemdManager.exists === 'function', '应包含 exists 方法');
  assert.ok(typeof systemdManager.uninstall === 'function', '应包含 uninstall 方法');

  await pool.close();
  console.log('✓ SystemdServiceManager：接口完整');
}

async function runSshDeployServiceTests() {
  console.log('\n🚀 测试 SSH 部署服务...');

  const deployService = new SshDeployService({
    maxParallelTransfers: 2,
  });

  // 验证接口
  assert.ok(typeof deployService.deploy === 'function', '应包含 deploy 方法');
  assert.ok(typeof deployService.rollback === 'function', '应包含 rollback 方法');
  assert.ok(typeof deployService.listDeployRecords === 'function', '应包含 listDeployRecords 方法');
  assert.ok(typeof deployService.close === 'function', '应包含 close 方法');
  assert.ok(typeof deployService.getConnectionPoolStatus === 'function', '应包含 getConnectionPoolStatus 方法');

  // 验证枚举
  assert.ok(DeployStatus.PENDING === 'pending', 'DeployStatus.PENDING 应为 pending');
  assert.ok(DeployStatus.IN_PROGRESS === 'in_progress', 'DeployStatus.IN_PROGRESS 应为 in_progress');
  assert.ok(DeployStatus.SUCCESS === 'success', 'DeployStatus.SUCCESS 应为 success');
  assert.ok(DeployStatus.FAILED === 'failed', 'DeployStatus.FAILED 应为 failed');
  assert.ok(DeployStatus.ROLLED_BACK === 'rolled_back', 'DeployStatus.ROLLED_BACK 应为 rolled_back');

  // 测试部署记录列表（初始应为空）
  const records = deployService.listDeployRecords();
  assert.ok(Array.isArray(records), 'listDeployRecords 应返回数组');

  await deployService.close();
  console.log('✓ SshDeployService：接口完整');
}

async function runTransferModeTests() {
  console.log('\n📡 测试传输模式枚举...');

  assert.equal(TransferMode.RSYNC, 'rsync', 'TransferMode.RSYNC 应为 rsync');
  assert.equal(TransferMode.SCP, 'scp', 'TransferMode.SCP 应为 scp');
  assert.equal(TransferMode.SFTP, 'sftp', 'TransferMode.SFTP 应为 sftp');

  console.log('✓ TransferMode：枚举值正确');
}

async function runSystemdServiceStateTests() {
  console.log('\n🔄 测试 systemd 服务状态枚举...');

  assert.equal(SystemdServiceState.RUNNING, 'running', 'SystemdServiceState.RUNNING 应为 running');
  assert.equal(SystemdServiceState.STOPPED, 'stopped', 'SystemdServiceState.STOPPED 应为 stopped');
  assert.equal(SystemdServiceState.FAILED, 'failed', 'SystemdServiceState.FAILED 应为 failed');
  assert.equal(SystemdServiceState.INACTIVE, 'inactive', 'SystemdServiceState.INACTIVE 应为 inactive');
  assert.equal(SystemdServiceState.UNKNOWN, 'unknown', 'SystemdServiceState.UNKNOWN 应为 unknown');

  console.log('✓ SystemdServiceState：枚举值正确');
}

async function runAllSshDeployServiceTests() {
  console.log('\n========================================');
  console.log('SSH 部署服务单元测试');
  console.log('========================================');

  try {
    await runSshConnectionPoolTests();
    await runSshCommandExecutorTests();
    await runSshFileSyncTests();
    await runSystemdServiceManagerTests();
    await runSshDeployServiceTests();
    await runTransferModeTests();
    await runSystemdServiceStateTests();

    console.log('\n========================================');
    console.log('✅ 所有 SSH 部署服务测试通过');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ 测试失败：', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 导出测试函数
module.exports = { runAllSshDeployServiceTests };

// 如果直接运行此文件
if (require.main === module) {
  runAllSshDeployServiceTests();
}
