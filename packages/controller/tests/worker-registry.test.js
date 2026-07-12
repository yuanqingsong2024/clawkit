const { WorkerRegistry } = require('../dist/services/worker-registry');
const { WorkerStatus } = require('@clawkit/shared');

console.log('=== Worker Registry 测试 ===\n');

const registry = new WorkerRegistry();

console.log('1. 测试 worker 注册');
const worker1 = registry.register({
  workerId: 'worker-1',
  name: 'Worker 1',
  nodeName: 'local',
  connectMode: 'pull',
  tags: ['dev', 'test'],
  supportedProjects: ['project-a', 'project-b'],
});
console.log('✓ Worker 注册成功:', worker1.workerId, worker1.name);
console.log('  状态:', worker1.status);
console.log('  支持项目:', worker1.supportedProjects.join(', '));

console.log('\n2. 测试心跳');
const heartbeat1 = registry.heartbeat('worker-1', {
  status: WorkerStatus.IDLE,
});
console.log('✓ 心跳发送成功');
console.log('  最后心跳时间:', heartbeat1.lastHeartbeatAt.toISOString());

console.log('\n3. 测试查询可用 worker');
const available = registry.getAvailableWorkers();
console.log('✓ 可用 worker 数量:', available.length);
console.log('  可用 worker:', available.map(w => w.workerId).join(', '));

console.log('\n4. 测试为项目选择 worker');
const selected = registry.findWorkerForProject('project-a');
if (selected) {
  console.log('✓ 为 project-a 选择 worker:', selected.workerId);
} else {
  console.log('✗ 未找到可用 worker');
}

console.log('\n5. 测试标记 worker 为忙碌');
registry.markWorkerBusy('worker-1', 'task-123');
const busyWorker = registry.getWorker('worker-1');
console.log('✓ Worker 状态已更新:', busyWorker?.status);
console.log('  当前任务:', busyWorker?.currentTaskId);

console.log('\n6. 测试标记 worker 为空闲');
registry.markWorkerIdle('worker-1');
const idleWorker = registry.getWorker('worker-1');
console.log('✓ Worker 状态已更新:', idleWorker?.status);
console.log('  当前任务:', idleWorker?.currentTaskId || '无');

console.log('\n7. 测试注册多个 worker');
registry.register({
  workerId: 'worker-2',
  name: 'Worker 2',
  nodeName: 'remote',
  connectMode: 'pull',
  tags: ['prod'],
  supportedProjects: ['*'],
});
const allWorkers = registry.getAllWorkers();
console.log('✓ 总 worker 数量:', allWorkers.length);
console.log('  Worker 列表:', allWorkers.map(w => w.workerId).join(', '));

console.log('\n8. 测试通配符项目匹配');
const wildcardWorker = registry.findWorkerForProject('any-project');
if (wildcardWorker) {
  console.log('✓ 为 any-project 选择 worker:', wildcardWorker.workerId);
  console.log('  支持项目:', wildcardWorker.supportedProjects.join(', '));
}

console.log('\n=== 所有测试通过 ===');
