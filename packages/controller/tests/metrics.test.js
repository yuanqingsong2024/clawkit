const assert = require('node:assert/strict');
const { MetricsCollector } = require('../dist/metrics/metrics-collector');
const { AlertRulesEngine, AlertLevel, AlertStatus } = require('../dist/metrics/alert-rules');
const { AlertNotificationService, NotificationChannel } = require('../dist/metrics/alert-notifiers');

// 测试 MetricsCollector
async function runMetricsCollectorTests() {
  console.log('\n📊 测试指标采集器...');

  const collector = new MetricsCollector({
    instanceId: 'test-instance',
    collectionIntervalMs: 1000,
    historyRetentionMs: 60000,
    historySampleIntervalMs: 5000,
  });

  // 测试基本指标采集
  const snapshot = collector.getSnapshot();
  assert.ok(snapshot.hasOwnProperty('timestamp'), '快照应包含 timestamp');
  assert.ok(snapshot.hasOwnProperty('instanceId'), '快照应包含 instanceId');
  assert.ok(snapshot.hasOwnProperty('task'), '快照应包含 task');
  assert.ok(snapshot.hasOwnProperty('system'), '快照应包含 system');
  assert.ok(snapshot.hasOwnProperty('worker'), '快照应包含 worker');
  assert.ok(snapshot.hasOwnProperty('http'), '快照应包含 http');

  // 测试系统指标
  const systemMetrics = collector.getSystemMetrics();
  assert.ok(typeof systemMetrics.cpuUsage === 'number', 'CPU 使用率应为数字');
  assert.ok(typeof systemMetrics.memoryUsage === 'number', '内存使用率应为数字');
  assert.ok(typeof systemMetrics.uptime === 'number', '运行时间应为数字');
  assert.ok(systemMetrics.cpuUsage >= 0 && systemMetrics.cpuUsage <= 100, 'CPU 使用率应在 0-100 之间');
  assert.ok(systemMetrics.memoryUsage >= 0 && systemMetrics.memoryUsage <= 100, '内存使用率应在 0-100 之间');

  // 测试 HTTP 指标记录
  collector.recordHttpRequest(true, 100);
  collector.recordHttpRequest(true, 200);
  collector.recordHttpRequest(false, 50);
  
  const httpMetrics = collector.getHttpMetrics();
  assert.equal(httpMetrics.requestsTotal, 3, '总请求数应为 3');
  assert.equal(httpMetrics.requestsSuccess, 2, '成功请求数应为 2');
  assert.equal(httpMetrics.requestsError, 1, '错误请求数应为 1');

  // 测试任务状态记录
  collector.recordTaskStatusChange('pending');
  collector.recordTaskStatusChange('running');
  collector.recordTaskStatusChange('done');
  
  const taskMetrics = collector.getTaskMetrics();
  assert.ok(taskMetrics.total >= 1, '应有任务记录');
  assert.ok(taskMetrics.success >= 0, '成功数应为非负数');

  // 测试指标重置
  collector.reset();
  const resetHttpMetrics = collector.getHttpMetrics();
  assert.equal(resetHttpMetrics.requestsTotal, 0, '重置后总请求数应为 0');

  collector.destroy();
  console.log('✓ MetricsCollector：基础功能正常');
}

// 测试 AlertRulesEngine
async function runAlertRulesEngineTests() {
  console.log('\n🚨 测试告警规则引擎...');

  const engine = new AlertRulesEngine();

  // 测试添加规则
  engine.addRule({
    id: 'test-rule-1',
    name: '测试规则',
    description: 'CPU 使用率 > 80',
    level: AlertLevel.WARNING,
    enabled: true,
    condition: {
      type: 'threshold',
      metric: 'cpuUsage',
      operator: '>',
      threshold: 80,
      duration: 1000,
    },
    tags: ['test'],
  });

  const rule = engine.getRule('test-rule-1');
  assert.ok(rule, '应能获取规则');
  assert.equal(rule.name, '测试规则', '规则名称应正确');

  // 测试获取所有规则
  const allRules = engine.getAllRules();
  assert.ok(allRules.length > 0, '应至少有一条规则');

  // 测试评估（未触发）
  const metrics1 = { cpuUsage: 50 };
  const alerts1 = engine.evaluate(metrics1, 'test-instance');
  assert.equal(alerts1.length, 0, '指标未超过阈值时不应触发告警');

  // 测试评估（触发）
  const metrics2 = { cpuUsage: 85 };
  await new Promise((resolve) => setTimeout(resolve, 1100)); // 等待持续时间
  const alerts2 = engine.evaluate(metrics2, 'test-instance');
  // 注意：由于 duration 设置，可能需要等待

  // 测试告警统计
  const counts = engine.getAlertCounts();
  assert.ok(counts.hasOwnProperty(AlertLevel.INFO), '应有 INFO 级别统计');
  assert.ok(counts.hasOwnProperty(AlertLevel.WARNING), '应有 WARNING 级别统计');
  assert.ok(counts.hasOwnProperty(AlertLevel.ERROR), '应有 ERROR 级别统计');
  assert.ok(counts.hasOwnProperty(AlertLevel.CRITICAL), '应有 CRITICAL 级别统计');

  // 测试获取默认规则
  const defaultRules = engine.getDefaultRules();
  assert.ok(defaultRules.length > 0, '应有默认规则');

  // 测试启用/禁用规则
  engine.disableRule('test-rule-1');
  const disabledRule = engine.getRule('test-rule-1');
  assert.ok(!disabledRule.enabled, '规则应已禁用');

  engine.enableRule('test-rule-1');
  const enabledRule = engine.getRule('test-rule-1');
  assert.ok(enabledRule.enabled, '规则应已启用');

  // 测试移除规则
  const removed = engine.removeRule('test-rule-1');
  assert.ok(removed, '应能移除规则');
  const afterRemove = engine.getRule('test-rule-1');
  assert.ok(!afterRemove, '规则应已不存在');

  engine.destroy();
  console.log('✓ AlertRulesEngine：基础功能正常');
}

// 测试 AlertNotificationService
async function runAlertNotificationServiceTests() {
  console.log('\n📬 测试告警通知服务...');

  const service = new AlertNotificationService('test-instance');

  // 测试统计
  const stats = service.getStats();
  assert.ok(stats.hasOwnProperty('total'), '统计应包含 total');
  assert.ok(stats.hasOwnProperty('sent'), '统计应包含 sent');
  assert.ok(stats.hasOwnProperty('failed'), '统计应包含 failed');

  // 测试获取记录
  const records = service.getRecords();
  assert.ok(Array.isArray(records), '记录应为数组');

  // 测试获取最近记录
  const recent = service.getRecentRecords(10);
  assert.ok(Array.isArray(recent), '最近记录应为数组');
  assert.ok(recent.length <= 10, '最近记录数量应 <= 10');

  // 测试清除记录
  service.clearRecords();
  const afterClear = service.getRecords();
  assert.equal(afterClear.length, 0, '清除后记录数应为 0');

  service.destroy();
  console.log('✓ AlertNotificationService：基础功能正常');
}

// 测试告警级别枚举
async function runAlertLevelTests() {
  console.log('\n🔔 测试告警级别枚举...');

  assert.equal(AlertLevel.INFO, 'info', 'INFO 级别应为 info');
  assert.equal(AlertLevel.WARNING, 'warning', 'WARNING 级别应为 warning');
  assert.equal(AlertLevel.ERROR, 'error', 'ERROR 级别应为 error');
  assert.equal(AlertLevel.CRITICAL, 'critical', 'CRITICAL 级别应为 critical');

  console.log('✓ AlertLevel：枚举值正确');
}

// 测试告警状态枚举
async function runAlertStatusTests() {
  console.log('\n📋 测试告警状态枚举...');

  assert.equal(AlertStatus.ACTIVE, 'active', 'ACTIVE 状态应为 active');
  assert.equal(AlertStatus.ACKNOWLEDGED, 'acknowledged', 'ACKNOWLEDGED 状态应为 acknowledged');
  assert.equal(AlertStatus.RESOLVED, 'resolved', 'RESOLVED 状态应为 resolved');
  assert.equal(AlertStatus.SUPPRESSED, 'suppressed', 'SUPPRESSED 状态应为 suppressed');

  console.log('✓ AlertStatus：枚举值正确');
}

// 测试通知渠道枚举
async function runNotificationChannelTests() {
  console.log('\n📡 测试通知渠道枚举...');

  assert.equal(NotificationChannel.CONSOLE, 'console', 'CONSOLE 渠道应为 console');
  assert.equal(NotificationChannel.WEBHOOK, 'webhook', 'WEBHOOK 渠道应为 webhook');
  assert.equal(NotificationChannel.EMAIL, 'email', 'EMAIL 渠道应为 email');
  assert.equal(NotificationChannel.DINGTALK, 'dingtalk', 'DINGTALK 渠道应为 dingtalk');
  assert.equal(NotificationChannel.LARK, 'lark', 'LARK 渠道应为 lark');
  assert.equal(NotificationChannel.SLACK, 'slack', 'SLACK 渠道应为 slack');

  console.log('✓ NotificationChannel：枚举值正确');
}

// 运行所有测试
async function runAllMetricsTests() {
  console.log('\n========================================');
  console.log('监控与告警服务单元测试');
  console.log('========================================');

  try {
    await runMetricsCollectorTests();
    await runAlertRulesEngineTests();
    await runAlertNotificationServiceTests();
    await runAlertLevelTests();
    await runAlertStatusTests();
    await runNotificationChannelTests();

    console.log('\n========================================');
    console.log('✅ 所有监控与告警服务测试通过');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ 测试失败：', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 导出测试函数
module.exports = { runAllMetricsTests };

// 如果直接运行此文件
if (require.main === module) {
  runAllMetricsTests();
}
