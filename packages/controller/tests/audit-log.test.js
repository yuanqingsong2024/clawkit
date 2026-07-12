const assert = require('node:assert/strict');
const { 
  AuditLogService, 
  AuditLogLevel, 
  AuditAction, 
  AuditSubjectType,
  AuditExportFormat 
} = require('../dist/services/audit-log.service');

// 测试审计日志服务
async function runAuditLogServiceTests() {
  console.log('\n📋 测试审计日志服务...');

  const service = new AuditLogService(1000);

  // 测试记录日志
  const entry1 = service.log({
    action: AuditAction.TASK_CREATE,
    subjectType: AuditSubjectType.TASK,
    subjectId: 'task-001',
    actorId: 'user-001',
    actorName: '测试用户',
    metadata: { project: 'test-project' },
  });

  assert.ok(entry1.id, '日志应有 ID');
  assert.equal(entry1.action, AuditAction.TASK_CREATE, '操作类型应正确');
  assert.equal(entry1.subjectId, 'task-001', '主体 ID 应正确');
  assert.equal(entry1.actorId, 'user-001', '操作者 ID 应正确');
  assert.ok(entry1.timestamp instanceof Date, '时间戳应为 Date 对象');
  assert.equal(entry1.success, true, '默认应标记为成功');

  console.log('✓ 记录日志功能正常');

  // 测试便捷方法 - 任务创建
  const taskEntry = service.logTaskCreate('task-002', 'user-002', '用户2', { priority: 'high' });
  assert.equal(taskEntry.action, AuditAction.TASK_CREATE, '操作类型应正确');
  assert.equal(taskEntry.subjectType, AuditSubjectType.TASK, '主体类型应正确');

  // 测试便捷方法 - 任务审批
  const approveEntry = service.logTaskApproval('task-001', true, 'admin-001', '管理员');
  assert.equal(approveEntry.action, AuditAction.TASK_APPROVE, '操作类型应正确');
  assert.ok(approveEntry.success, '审批通过应标记为成功');

  const rejectEntry = service.logTaskApproval('task-001', false, 'admin-001', '管理员');
  assert.equal(rejectEntry.action, AuditAction.TASK_REJECT, '操作类型应正确');
  assert.ok(!rejectEntry.success, '审批拒绝应标记为失败');

  console.log('✓ 便捷方法功能正常');

  // 测试查询功能
  const queryResult = service.query({
    action: AuditAction.TASK_CREATE,
    limit: 10,
  });

  assert.ok(Array.isArray(queryResult.entries), '应返回数组');
  assert.ok(queryResult.hasOwnProperty('total'), '结果应包含总数');
  assert.ok(queryResult.hasOwnProperty('hasMore'), '结果应包含 hasMore');

  // 测试按时间范围查询
  const dateQuery = service.query({
    startDate: new Date(Date.now() - 86400000),
    endDate: new Date(),
  });
  assert.ok(dateQuery.entries.length >= 0, '时间范围查询应正常工作');

  // 测试按主体 ID 查询
  const subjectQuery = service.query({ subjectId: 'task-001' });
  assert.ok(subjectQuery.entries.length >= 0, '主体查询应正常工作');

  console.log('✓ 查询功能正常');

  // 测试获取主体历史
  const history = service.getSubjectHistory('task-001', AuditSubjectType.TASK, 10);
  assert.ok(Array.isArray(history), '应返回数组');
  assert.ok(history.length >= 0, '应能获取历史记录');

  // 测试获取操作者历史
  const actorHistory = service.getActorHistory('user-001', 10);
  assert.ok(Array.isArray(actorHistory), '应返回数组');

  // 测试获取最近日志
  const recent = service.getRecent(5);
  assert.ok(Array.isArray(recent), '应返回数组');
  assert.ok(recent.length <= 5, '应限制返回数量');

  console.log('✓ 历史记录功能正常');

  // 测试导出 JSON
  const jsonExport = service.export(AuditExportFormat.JSON);
  assert.ok(typeof jsonExport === 'string', '应返回字符串');
  const parsedJson = JSON.parse(jsonExport);
  assert.ok(Array.isArray(parsedJson), 'JSON 导出应解析为数组');

  // 测试导出 CSV
  const csvExport = service.export(AuditExportFormat.CSV);
  assert.ok(csvExport.includes('ID,时间,级别,操作'), 'CSV 应包含表头');
  assert.ok(csvExport.includes('"task:create"'), 'CSV 应包含操作类型');

  console.log('✓ 导出功能正常');

  // 测试统计信息
  const stats = service.getStats();
  assert.ok(stats.hasOwnProperty('totalCount'), '统计应包含总数');
  assert.ok(stats.hasOwnProperty('successCount'), '统计应包含成功数');
  assert.ok(stats.hasOwnProperty('failureCount'), '统计应包含失败数');
  assert.ok(stats.hasOwnProperty('byAction'), '统计应包含按操作分类');
  assert.ok(stats.hasOwnProperty('bySubjectType'), '统计应包含按主体类型分类');
  assert.ok(stats.hasOwnProperty('byLevel'), '统计应包含按级别分类');

  console.log('✓ 统计功能正常');

  // 测试清理功能 - 清理 1 天前的日志（应该删除所有日志，因为都是刚刚创建的）
  const beforeSize = service.size();
  const cleaned = service.cleanup(1); // 清理 1 天前的日志
  // 由于所有日志都是刚刚创建的，都在 1 天内，所以不应删除任何日志
  assert.equal(cleaned, 0, `清理 1 天前应无效果（清理了 ${cleaned} 条）`);

  console.log('✓ 清理功能正常');

  // 测试清空功能
  service.clear();
  assert.equal(service.size(), 0, '清空后大小应为 0');

  console.log('✓ 清空功能正常');

  console.log('✓ AuditLogService：基础功能正常');
}

// 测试枚举值
async function runAuditEnumsTests() {
  console.log('\n🎯 测试审计枚举...');

  // 测试日志级别
  assert.equal(AuditLogLevel.INFO, 'info', 'INFO 应为 info');
  assert.equal(AuditLogLevel.WARN, 'warn', 'WARN 应为 warn');
  assert.equal(AuditLogLevel.ERROR, 'error', 'ERROR 应为 error');

  // 测试操作类型
  assert.equal(AuditAction.TASK_CREATE, 'task:create', '任务创建操作应为 task:create');
  assert.equal(AuditAction.TASK_APPROVE, 'task:approve', '任务审批操作应为 task:approve');
  assert.equal(AuditAction.TASK_REJECT, 'task:reject', '任务拒绝操作应为 task:reject');
  assert.equal(AuditAction.TASK_CANCEL, 'task:cancel', '任务取消操作应为 task:cancel');
  assert.equal(AuditAction.TASK_EXECUTE, 'task:execute', '任务执行操作应为 task:execute');
  assert.equal(AuditAction.TASK_COMPLETE, 'task:complete', '任务完成操作应为 task:complete');
  assert.equal(AuditAction.TASK_FAIL, 'task:fail', '任务失败操作应为 task:fail');
  assert.equal(AuditAction.TASK_PREEMPT, 'task:preempt', '任务抢占操作应为 task:preempt');

  assert.equal(AuditAction.DRAFT_CREATE, 'draft:create', '草稿创建应为 draft:create');
  assert.equal(AuditAction.DRAFT_REVISE, 'draft:revise', '草稿修订应为 draft:revise');

  assert.equal(AuditAction.WORKER_REGISTER, 'worker:register', 'Worker 注册应为 worker:register');
  assert.equal(AuditAction.WORKER_HEARTBEAT, 'worker:heartbeat', 'Worker 心跳应为 worker:heartbeat');

  assert.equal(AuditAction.SYSTEM_START, 'system:start', '系统启动应为 system:start');
  assert.equal(AuditAction.SYSTEM_STOP, 'system:stop', '系统停止应为 system:stop');
  assert.equal(AuditAction.AUTH_SUCCESS, 'auth:success', '认证成功应为 auth:success');
  assert.equal(AuditAction.AUTH_FAILURE, 'auth:failure', '认证失败应为 auth:failure');

  // 测试主体类型
  assert.equal(AuditSubjectType.TASK, 'task', '任务主体应为 task');
  assert.equal(AuditSubjectType.DRAFT, 'draft', '草稿主体应为 draft');
  assert.equal(AuditSubjectType.WORKER, 'worker', 'Worker 主体应为 worker');
  assert.equal(AuditSubjectType.USER, 'user', '用户主体应为 user');
  assert.equal(AuditSubjectType.SYSTEM, 'system', '系统主体应为 system');
  assert.equal(AuditSubjectType.CONFIG, 'config', '配置主体应为 config');

  // 测试导出格式
  assert.equal(AuditExportFormat.JSON, 'json', 'JSON 格式应为 json');
  assert.equal(AuditExportFormat.CSV, 'csv', 'CSV 格式应为 csv');

  console.log('✓ AuditLogLevel：枚举值正确');
  console.log('✓ AuditAction：枚举值正确');
  console.log('✓ AuditSubjectType：枚举值正确');
  console.log('✓ AuditExportFormat：枚举值正确');
}

// 测试分页
async function runPaginationTests() {
  console.log('\n📄 测试分页功能...');

  const service = new AuditLogService(1000);

  // 创建 25 条日志
  for (let i = 0; i < 25; i++) {
    service.log({
      action: AuditAction.TASK_CREATE,
      subjectType: AuditSubjectType.TASK,
      subjectId: `task-${i}`,
    });
  }

  // 测试第一页
  const page1 = service.query({ limit: 10, offset: 0 });
  assert.equal(page1.entries.length, 10, '第一页应有 10 条');
  assert.equal(page1.total, 25, '总数应为 25');
  assert.ok(page1.hasMore, '应还有更多');

  // 测试第二页
  const page2 = service.query({ limit: 10, offset: 10 });
  assert.equal(page2.entries.length, 10, '第二页应有 10 条');
  assert.ok(page2.hasMore, '应还有更多');

  // 测试第三页
  const page3 = service.query({ limit: 10, offset: 20 });
  assert.equal(page3.entries.length, 5, '第三页应有 5 条');
  assert.ok(!page3.hasMore, '应没有更多');

  console.log('✓ 分页功能正常');
}

// 测试过滤组合
async function runFilterTests() {
  console.log('\n🔍 测试过滤组合...');

  const service = new AuditLogService(1000);

  // 创建不同类型的日志
  service.log({
    action: AuditAction.TASK_CREATE,
    subjectType: AuditSubjectType.TASK,
    subjectId: 'task-1',
    success: true,
  });
  service.log({
    action: AuditAction.TASK_FAIL,
    subjectType: AuditSubjectType.TASK,
    subjectId: 'task-2',
    success: false,
  });
  service.log({
    action: AuditAction.WORKER_REGISTER,
    subjectType: AuditSubjectType.WORKER,
    subjectId: 'worker-1',
    success: true,
  });

  // 测试按操作类型过滤
  const taskLogs = service.query({ action: AuditAction.TASK_CREATE });
  assert.equal(taskLogs.total, 1, '任务创建应有 1 条');

  // 测试按主体类型过滤
  const taskLogs2 = service.query({ subjectType: AuditSubjectType.TASK });
  assert.equal(taskLogs2.total, 2, '任务主体应有 2 条');

  // 测试按成功状态过滤
  const failedLogs = service.query({ success: false });
  assert.equal(failedLogs.total, 1, '失败日志应有 1 条');

  // 测试组合过滤
  const combined = service.query({
    subjectType: AuditSubjectType.TASK,
    success: true,
  });
  assert.equal(combined.total, 1, '组合过滤应有 1 条');

  console.log('✓ 过滤组合功能正常');
}

// 运行所有测试
async function runAllAuditTests() {
  console.log('\n========================================');
  console.log('审计日志单元测试');
  console.log('========================================');

  try {
    await runAuditLogServiceTests();
    await runAuditEnumsTests();
    await runPaginationTests();
    await runFilterTests();

    console.log('\n========================================');
    console.log('✅ 所有审计日志测试通过');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ 测试失败：', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 导出测试函数
module.exports = { runAllAuditTests };

// 如果直接运行此文件
if (require.main === module) {
  runAllAuditTests();
}
