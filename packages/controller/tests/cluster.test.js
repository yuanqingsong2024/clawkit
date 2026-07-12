const assert = require('node:assert/strict');
const { MembershipService, InstanceStatus } = require('../dist/cluster/membership');
const { SharedStateService } = require('../dist/cluster/shared-state');
const { HealthCheckService } = require('../dist/cluster/health-check');
const { ClusterManager } = require('../dist/cluster/cluster-manager');

// 测试 MembershipService
async function runMembershipServiceTests() {
  console.log('\n📡 测试成员服务...');

  const service = new MembershipService({
    instanceId: 'test-instance-1',
    port: 8787,
    heartbeatIntervalMs: 1000,
    heartbeatTimeoutMs: 3000,
    priority: 100,
    enableLeaderElection: true,
  });

  // 测试注册
  service.register();
  assert.equal(service.getInstanceId(), 'test-instance-1');
  assert.ok(service.getCurrentInstance(), '应获取当前实例信息');

  // 测试心跳
  service.heartbeat();
  const instance = service.getInstance('test-instance-1');
  assert.ok(instance, '应能获取实例');
  assert.equal(instance.status, InstanceStatus.HEALTHY, '实例状态应为 HEALTHY');

  // 测试 leader 选举
  const leader = service.getLeader();
  assert.ok(leader, '应有 leader');
  assert.equal(leader.instanceId, 'test-instance-1', '当前实例应为 leader');
  assert.ok(service.isLeader(), 'isLeader 应返回 true');

  // 测试统计
  const stats = service.getStats();
  assert.equal(stats.totalInstances, 1, '总实例数应为 1');
  assert.equal(stats.healthyInstances, 1, '健康实例数应为 1');
  assert.ok(stats.isLeader, '当前实例应为 leader');

  // 清理
  service.unregister();
  service.destroy();

  console.log('✓ MembershipService：基础功能正常');
}

// 测试 SharedStateService
async function runSharedStateServiceTests() {
  console.log('\n💾 测试共享状态服务...');

  const service = new SharedStateService('test-instance', {
    type: 'memory',
    keyPrefix: 'test:',
    enablePubSub: true,
  });

  // 测试基本操作
  await service.set('key1', 'value1');
  const value1 = await service.get('key1');
  assert.equal(value1, 'value1', '应能获取设置的值');

  // 测试存在性检查
  const exists1 = await service.exists('key1');
  assert.ok(exists1, 'key1 应存在');
  const exists2 = await service.exists('nonexistent');
  assert.ok(!exists2, '不存在的键应返回 false');

  // 测试删除
  await service.delete('key1');
  const deleted = await service.get('key1');
  assert.equal(deleted, undefined, '删除后应无法获取值');

  // 测试递增/递减
  await service.set('counter', 0);
  const inc1 = await service.increment('counter');
  assert.equal(inc1, 1, '递增后应为 1');
  const inc2 = await service.increment('counter', 5);
  assert.equal(inc2, 6, '再递增 5 后应为 6');
  const dec = await service.decrement('counter', 2);
  assert.equal(dec, 4, '递减 2 后应为 4');

  // 测试锁
  const lockAcquired = await service.tryAcquireLock('test-lock', 'owner-1', { timeout: 5000 });
  assert.ok(lockAcquired, '应能获取锁');
  const held = service.isLockHeld('test-lock', 'owner-1');
  assert.ok(held, '应持有锁');
  const released = service.releaseLock('test-lock', 'owner-1');
  assert.ok(released, '应成功释放锁');

  // 测试统计
  const stats = service.getStats();
  assert.equal(stats.storageType, 'memory', '存储类型应为 memory');
  assert.ok(stats.totalKeys > 0, '应有键存在');

  // 清理
  service.destroy();

  console.log('✓ SharedStateService：基础功能正常');
}

// 测试 HealthCheckService
async function runHealthCheckServiceTests() {
  console.log('\n🏥 测试健康检查服务...');

  const service = new HealthCheckService({
    intervalMs: 5000,
    timeoutMs: 3000,
    detailed: false,
  });

  // 注册自定义检查
  service.registerCheck('custom', async () => {
    return {
      name: 'custom',
      healthy: true,
      duration: 10,
    };
  });

  // 测试健康检查
  const health = await service.checkHealth('test-instance');
  assert.ok(health.hasOwnProperty('status'), '应有 status 字段');
  assert.ok(health.hasOwnProperty('timestamp'), '应有 timestamp 字段');
  assert.ok(health.hasOwnProperty('uptime'), '应有 uptime 字段');
  assert.ok(health.hasOwnProperty('memory'), '应有 memory 字段');

  // 测试就绪探针
  const readiness = await service.checkReadiness();
  assert.ok(readiness.hasOwnProperty('ready'), '应有 ready 字段');
  assert.ok(readiness.hasOwnProperty('reasons'), '应有 reasons 字段');

  // 测试存活探针
  const liveness = await service.checkLiveness();
  assert.ok(liveness.hasOwnProperty('alive'), '应有 alive 字段');

  // 测试上一次检查结果
  const lastResult = service.getLastCheckResult();
  assert.ok(lastResult, '应有上次检查结果');

  // 测试摘要生成
  const summary = service.generateSummary(health);
  assert.ok(summary.includes('状态:'), '摘要应包含状态');
  assert.ok(summary.includes('实例:'), '摘要应包含实例');

  // 清理
  service.stopPeriodicCheck();
  service.removeAllListeners();

  console.log('✓ HealthCheckService：基础功能正常');
}

// 测试 ClusterManager
async function runClusterManagerTests() {
  console.log('\n🔗 测试集群管理器...');

  const manager = new ClusterManager({
    enabled: true,
    instanceId: 'test-cluster-instance',
    instancePort: 8787,
    enableLeaderElection: true,
    loadBalanceStrategy: 'leader-first',
  });

  // 测试初始化
  await manager.initialize();
  assert.ok(manager.isHighAvailabilityEnabled(), 'HA 应启用');

  // 测试 leader 判断
  assert.ok(manager.isLeader(), '当前实例应为 leader');
  const leader = manager.getLeader();
  assert.ok(leader, '应有 leader');
  assert.equal(leader.instanceId, 'test-cluster-instance', 'leader 应为当前实例');

  // 测试实例选择
  const selected = manager.selectInstanceForRequest();
  assert.ok(selected, '应能选择实例');

  // 测试集群统计
  const stats = manager.getClusterStats();
  assert.ok(stats.hasOwnProperty('enabled'), '统计应包含 enabled');
  assert.ok(stats.hasOwnProperty('isLeader'), '统计应包含 isLeader');
  assert.ok(stats.hasOwnProperty('healthyInstances'), '统计应包含 healthyInstances');

  // 先执行健康检查，确保有健康状态
  await manager.checkHealth();

  // 测试获取服务
  const membership = manager.getMembershipService();
  assert.ok(membership, '应能获取成员服务');
  const stateService = manager.getSharedStateService();
  assert.ok(stateService, '应能获取状态服务');
  const healthService = manager.getHealthCheckService();
  assert.ok(healthService, '应能获取健康检查服务');

  // 测试 leader 操作
  const leaderOpResult = await manager.executeAsLeader(async () => {
    return 'leader-operation-result';
  });
  assert.equal(leaderOpResult, 'leader-operation-result', 'leader 操作应返回结果');

  // 清理
  await manager.shutdown();

  console.log('✓ ClusterManager：基础功能正常');
}

// 测试 leader 选举
async function runLeaderElectionTests() {
  console.log('\n👑 测试 leader 选举...');

  // 创建多个成员服务模拟选举
  const member1 = new MembershipService({
    instanceId: 'instance-1',
    port: 8787,
    priority: 100,
    enableLeaderElection: true,
  });

  const member2 = new MembershipService({
    instanceId: 'instance-2',
    port: 8788,
    priority: 90,
    enableLeaderElection: true,
  });

  const member3 = new MembershipService({
    instanceId: 'instance-3',
    port: 8789,
    priority: 80,
    enableLeaderElection: true,
  });

  // 注册所有实例
  member1.register();
  member2.register();
  member3.register();

  // 同步实例列表（模拟分布式场景）
  member1.syncInstances([
    member1.getCurrentInstance(),
    member2.getCurrentInstance(),
    member3.getCurrentInstance(),
  ]);

  // 等待选举完成
  await new Promise((resolve) => setTimeout(resolve, 100));

  // 验证优先级最高的成为 leader
  const leader = member1.getLeader();
  assert.ok(leader, '应有 leader');
  assert.equal(leader.instanceId, 'instance-1', '优先级最高的实例应为 leader');
  assert.equal(leader.priority, 100, 'leader 优先级应为 100');

  // 清理
  member1.unregister();
  member2.unregister();
  member3.unregister();
  member1.destroy();
  member2.destroy();
  member3.destroy();

  console.log('✓ Leader 选举：优先级最高的实例成为 leader');
}

// 运行所有测试
async function runAllClusterTests() {
  console.log('\n========================================');
  console.log('高可用集群服务单元测试');
  console.log('========================================');

  try {
    await runMembershipServiceTests();
    await runSharedStateServiceTests();
    await runHealthCheckServiceTests();
    await runClusterManagerTests();
    await runLeaderElectionTests();

    console.log('\n========================================');
    console.log('✅ 所有集群服务测试通过');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ 测试失败：', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 导出测试函数
module.exports = { runAllClusterTests };

// 如果直接运行此文件
if (require.main === module) {
  runAllClusterTests();
}
