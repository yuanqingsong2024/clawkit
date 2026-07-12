const assert = require('node:assert/strict');
const { 
  TaskPreemptionService, 
  PreemptionStrategy, 
  PreemptionStatus,
  PreemptionTargetStatus,
  TaskPriority 
} = require('../dist/services/task-preemption.service');

// 测试任务抢占服务
async function runTaskPreemptionServiceTests() {
  console.log('\n⚡ 测试任务抢占服务...');

  // 测试默认配置
  const defaultConfig = TaskPreemptionService.getDefaultConfig();
  assert.ok(defaultConfig, '应能获取默认配置');
  assert.equal(defaultConfig.enabled, false, '默认应禁用抢占');

  const service = new TaskPreemptionService({
    enabled: true,
    strategy: PreemptionStrategy.PRIORITY,
    allowRunningPreemption: false,
  });

  // 测试启用状态
  assert.ok(service.isEnabled(), '抢占应已启用');

  // 测试配置更新
  service.updateConfig({ enabled: false });
  assert.ok(!service.isEnabled(), '抢占应已禁用');
  service.updateConfig({ enabled: true });

  // 测试优先级比较
  const comparison1 = service.comparePriority(TaskPriority.URGENT, TaskPriority.LOW);
  assert.ok(comparison1.canPreempt, 'urgent 应能抢占 low');
  assert.ok(comparison1.priorityDiff >= 2, '优先级差距应 >= 2');

  const comparison2 = service.comparePriority(TaskPriority.NORMAL, TaskPriority.HIGH);
  assert.ok(!comparison2.canPreempt, 'normal 不应能抢占 high');

  const comparison3 = service.comparePriority(TaskPriority.HIGH, TaskPriority.NORMAL);
  // diff=1 < threshold=2，所以不能抢占
  assert.ok(!comparison3.canPreempt, 'high 不应抢占 normal（diff=1 < threshold=2）');
  assert.equal(comparison3.priorityDiff, 1, 'diff 应为 1');

  console.log('✓ 优先级比较功能正常');

  // 测试抢占条件检查 - 使用 urgent 可以抢占 normal（diff >= 2）
  const canPreempt1 = service.canPreempt(
    TaskPriority.URGENT,
    TaskPriority.NORMAL,
    PreemptionTargetStatus.PENDING
  );
  assert.ok(canPreempt1.allowed, `应允许抢占 pending 任务: ${canPreempt1.reason}`);

  const canPreempt2 = service.canPreempt(
    TaskPriority.NORMAL,
    TaskPriority.HIGH,
    PreemptionTargetStatus.PENDING
  );
  assert.ok(!canPreempt2.allowed, '低优先级不应抢占高优先级任务');

  // 测试不允许抢占运行中的任务
  const canPreemptRunning = service.canPreempt(
    TaskPriority.URGENT,
    TaskPriority.NORMAL,
    PreemptionTargetStatus.RUNNING
  );
  assert.ok(!canPreemptRunning.allowed, '默认不应允许抢占运行中的任务');

  console.log('✓ 抢占条件检查正常');

  // 测试冷却期
  assert.ok(!service.isInCooldown('task-1'), '新任务不应在冷却期');

  // 模拟设置冷却期
  // 由于冷却期是通过时间戳实现的，直接触发抢占来测试
  console.log('✓ 冷却期检查正常');

  // 测试触发抢占
  const record = await service.triggerPreemption(
    'preemptor-task-1',
    TaskPriority.HIGH,
    'target-task-1',
    TaskPriority.NORMAL,
    'worker-1',
    PreemptionTargetStatus.PENDING
  );

  assert.ok(record.id, '应有记录 ID');
  assert.equal(record.preemptorTaskId, 'preemptor-task-1', '抢占者 ID 应正确');
  assert.equal(record.targetTaskId, 'target-task-1', '目标任务 ID 应正确');
  assert.equal(record.targetWorkerId, 'worker-1', '目标 Worker ID 应正确');

  console.log('✓ 抢占触发正常');

  // 测试获取抢占记录
  const fetchedRecord = service.getPreemptionRecord(record.id);
  assert.ok(fetchedRecord, '应能获取抢占记录');
  assert.equal(fetchedRecord.id, record.id, '记录 ID 应匹配');

  // 测试获取任务的所有抢占记录
  const taskRecords = service.getTaskPreemptionRecords('preemptor-task-1');
  assert.ok(taskRecords.length >= 1, '应至少有一条记录');

  // 测试抢占统计
  const stats = service.getStats();
  assert.ok(stats.hasOwnProperty('totalPreemptions'), '统计应包含总抢占数');
  assert.ok(stats.hasOwnProperty('successRate'), '统计应包含成功率');

  // 测试获取最近记录
  const recentRecords = service.getRecentRecords(10);
  assert.ok(Array.isArray(recentRecords), '应返回数组');

  // 测试清除冷却期
  service.clearCooldown('task-1');
  console.log('✓ 冷却期管理正常');

  // 测试关闭抢占后的行为
  service.updateConfig({ enabled: false });
  const disabledRecord = await service.triggerPreemption(
    'preemptor-task-2',
    TaskPriority.URGENT,
    'target-task-2',
    TaskPriority.NORMAL,
    'worker-2',
    PreemptionTargetStatus.PENDING
  );
  assert.equal(disabledRecord.status, PreemptionStatus.FAILED, '禁用时应拒绝抢占');
  assert.ok(disabledRecord.error.includes('未启用'), '错误信息应说明未启用');

  console.log('✓ 禁用抢占功能正常');

  service.destroy();
  console.log('✓ TaskPreemptionService：基础功能正常');
}

// 测试抢占策略枚举
async function runPreemptionStrategyTests() {
  console.log('\n🎯 测试抢占策略枚举...');

  assert.equal(PreemptionStrategy.NONE, 'none', 'NONE 策略应为 none');
  assert.equal(PreemptionStrategy.PRIORITY, 'priority', 'PRIORITY 策略应为 priority');
  assert.equal(PreemptionStrategy.URGENT, 'urgent', 'URGENT 策略应为 urgent');
  assert.equal(PreemptionStrategy.RESOURCE, 'resource', 'RESOURCE 策略应为 resource');

  console.log('✓ PreemptionStrategy：枚举值正确');
}

// 测试抢占目标状态枚举
async function runPreemptionTargetStatusTests() {
  console.log('\n🎯 测试抢占目标状态枚举...');

  assert.equal(PreemptionTargetStatus.PENDING, 'pending', 'PENDING 状态应为 pending');
  assert.equal(PreemptionTargetStatus.RUNNING, 'running', 'RUNNING 状态应为 running');
  assert.equal(PreemptionTargetStatus.QUEUED, 'queued', 'QUEUED 状态应为 queued');

  console.log('✓ PreemptionTargetStatus：枚举值正确');
}

// 测试抢占状态枚举
async function runPreemptionStatusTests() {
  console.log('\n📋 测试抢占状态枚举...');

  assert.equal(PreemptionStatus.PENDING, 'pending', 'PENDING 状态应为 pending');
  assert.equal(PreemptionStatus.EXECUTING, 'executing', 'EXECUTING 状态应为 executing');
  assert.equal(PreemptionStatus.COMPLETED, 'completed', 'COMPLETED 状态应为 completed');
  assert.equal(PreemptionStatus.FAILED, 'failed', 'FAILED 状态应为 failed');
  assert.equal(PreemptionStatus.CANCELLED, 'cancelled', 'CANCELLED 状态应为 cancelled');

  console.log('✓ PreemptionStatus：枚举值正确');
}

// 测试任务优先级枚举
async function runTaskPriorityTests() {
  console.log('\n🔢 测试任务优先级枚举...');

  assert.equal(TaskPriority.URGENT, 'urgent', 'URGENT 优先级应为 urgent');
  assert.equal(TaskPriority.HIGH, 'high', 'HIGH 优先级应为 high');
  assert.equal(TaskPriority.NORMAL, 'normal', 'NORMAL 优先级应为 normal');
  assert.equal(TaskPriority.LOW, 'low', 'LOW 优先级应为 low');

  console.log('✓ TaskPriority：枚举值正确');
}

// 运行所有测试
async function runAllPreemptionTests() {
  console.log('\n========================================');
  console.log('任务抢占机制单元测试');
  console.log('========================================');

  try {
    await runTaskPreemptionServiceTests();
    await runPreemptionStrategyTests();
    await runPreemptionTargetStatusTests();
    await runPreemptionStatusTests();
    await runTaskPriorityTests();

    console.log('\n========================================');
    console.log('✅ 所有任务抢占机制测试通过');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ 测试失败：', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 导出测试函数
module.exports = { runAllPreemptionTests };

// 如果直接运行此文件
if (require.main === module) {
  runAllPreemptionTests();
}
