const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { TaskStatus, ApprovalAction } = require('@clawkit/shared');

const TEST_DB_PATH = path.join(__dirname, 'tmp', 'sqlite-task-store.test.db');

function run(name, handler) {
  handler();
  console.log(`✓ ${name}`);
}

function loadSqliteTaskStore() {
  try {
    return require('../dist/persistence/sqlite-task-store').SqliteTaskStore;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('NODE_MODULE_VERSION')) {
      console.log('○ 跳过 sqlite-task-store 原生测试：better-sqlite3 与当前测试 Node ABI 不匹配，请使用 scripts/test-persistence.js 做真实持久化验收');
      return null;
    }
    throw error;
  }
}

function isSqliteTaskStoreAvailable(SqliteTaskStore) {
  try {
    const probe = new SqliteTaskStore(TEST_DB_PATH);
    probe.close();
    cleanupDb();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('NODE_MODULE_VERSION')) {
      console.log('○ 跳过 sqlite-task-store 原生测试：better-sqlite3 与当前测试 Node ABI 不匹配，请使用 scripts/test-persistence.js 做真实持久化验收');
      cleanupDb();
      return false;
    }
    throw error;
  }
}

function cleanupDb() {
  for (const filePath of [TEST_DB_PATH, `${TEST_DB_PATH}-wal`, `${TEST_DB_PATH}-shm`]) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

function createTaskDraft(taskId, overrides = {}) {
  return {
    taskId,
    sourceText: '#研发任务\n项目: test-project\n目标: 验证 SQLite 持久化',
    projectKey: 'test-project',
    intent: '验证 SQLite 持久化',
    constraints: ['保持最小可用'],
    acceptanceCriteria: ['重启后仍可读取'],
    status: TaskStatus.DRAFT,
    createdAt: new Date('2026-03-16T10:00:00.000Z'),
    updatedAt: new Date('2026-03-16T10:00:00.000Z'),
    ...overrides,
  };
}

function createTaskMemory(taskId, overrides = {}) {
  return {
    taskId,
    normalizedTaskCard: {
      title: '验证 SQLite 持久化',
      objective: '确保 controller 状态可恢复',
      scope: ['taskDraft', 'taskMemory'],
      outOfScope: ['dispatch 持久化'],
      constraints: ['保持最小改动'],
      acceptanceCriteria: ['重启后仍可查询'],
    },
    promptDraftHistory: [],
    userRevisionHistory: [],
    executionSummary: null,
    similarTaskRefs: [],
    projectRuleRefs: [],
    createdAt: new Date('2026-03-16T10:00:00.000Z'),
    updatedAt: new Date('2026-03-16T10:00:00.000Z'),
    ...overrides,
  };
}

function createPromptDraft(taskId, overrides = {}) {
  return {
    taskId,
    version: { generation: 1, revision: 0 },
    projectKey: 'test-project',
    draftText: '请实现 SQLite 持久化并验证重启恢复。',
    summaryView: {
      goal: '验证持久化',
      scope: ['controller 状态恢复'],
      constraints: ['不要扩大改动范围'],
      acceptanceCriteria: ['任务可恢复'],
      confirmationChecklist: ['已重启验证'],
    },
    riskFlags: ['dispatch 尚未持久化'],
    createdAt: new Date('2026-03-16T10:05:00.000Z'),
    ...overrides,
  };
}

function createApprovalRecord(taskId, overrides = {}) {
  return {
    taskId,
    action: ApprovalAction.APPROVE,
    operator: 'tester',
    comment: '确认进入下一阶段',
    fromStatus: TaskStatus.WAITING_APPROVAL,
    toStatus: TaskStatus.APPROVED,
    createdAt: new Date('2026-03-16T10:06:00.000Z'),
    ...overrides,
  };
}

function runSqliteTaskStoreTests() {
  const SqliteTaskStore = loadSqliteTaskStore();
  if (SqliteTaskStore === null) {
    return;
  }

  if (!isSqliteTaskStoreAvailable(SqliteTaskStore)) {
    return;
  }

  cleanupDb();

  run('可以保存并读取任务草稿', () => {
    const store = new SqliteTaskStore(TEST_DB_PATH);
    const draft = createTaskDraft('task-001');

    store.saveTaskDraft(draft);
    const loaded = store.loadTaskDraft('task-001');

    assert.ok(loaded);
    assert.equal(loaded.taskId, 'task-001');
    assert.equal(loaded.intent, '验证 SQLite 持久化');
    assert.deepEqual(loaded.constraints, ['保持最小可用']);

    store.close();
    cleanupDb();
  });

  run('可以保存并读取任务记忆与执行摘要', () => {
    const store = new SqliteTaskStore(TEST_DB_PATH);
    const draft = createTaskDraft('task-002');
    const memory = createTaskMemory('task-002', {
      executionSummary: {
        status: 'done',
        note: '执行完成',
        summary: '已验证持久化恢复',
        placeholderExecution: false,
        logs: ['step-1', 'step-2'],
        lastUpdatedAt: new Date('2026-03-16T10:10:00.000Z'),
      },
    });

    store.saveTaskDraft(draft);
    store.saveTaskMemory(memory);
    const loaded = store.loadTaskMemory('task-002');

    assert.ok(loaded);
    assert.equal(loaded.normalizedTaskCard.title, '验证 SQLite 持久化');
    assert.equal(loaded.executionSummary.status, 'done');
    assert.deepEqual(loaded.executionSummary.logs, ['step-1', 'step-2']);

    store.close();
    cleanupDb();
  });

  run('可以保存并读取提示草稿与审批记录', () => {
    const store = new SqliteTaskStore(TEST_DB_PATH);
    const draft = createTaskDraft('task-003');
    const promptDraft = createPromptDraft('task-003');
    const approvalRecord = createApprovalRecord('task-003');

    store.saveTaskDraft(draft);
    store.savePromptDraft(promptDraft);
    store.saveApprovalRecord(approvalRecord);

    const drafts = store.loadPromptDrafts('task-003');
    const approvals = store.loadApprovalRecords('task-003');

    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].draftText, '请实现 SQLite 持久化并验证重启恢复。');
    assert.equal(approvals.length, 1);
    assert.equal(approvals[0].action, ApprovalAction.APPROVE);
    assert.equal(approvals[0].operator, 'tester');

    store.close();
    cleanupDb();
  });

  run('关闭后重新打开仍可恢复已保存数据', () => {
    const firstStore = new SqliteTaskStore(TEST_DB_PATH);
    const draft = createTaskDraft('task-004', { status: TaskStatus.WAITING_APPROVAL });
    const memory = createTaskMemory('task-004');
    const promptDraft = createPromptDraft('task-004');

    firstStore.saveTaskDraft(draft);
    firstStore.saveTaskMemory(memory);
    firstStore.savePromptDraft(promptDraft);
    firstStore.close();

    const secondStore = new SqliteTaskStore(TEST_DB_PATH);
    const loadedDraft = secondStore.loadTaskDraft('task-004');
    const loadedMemory = secondStore.loadTaskMemory('task-004');
    const loadedPromptDrafts = secondStore.loadPromptDrafts('task-004');

    assert.ok(loadedDraft);
    assert.equal(loadedDraft.status, TaskStatus.WAITING_APPROVAL);
    assert.ok(loadedMemory);
    assert.equal(loadedMemory.taskId, 'task-004');
    assert.equal(loadedPromptDrafts.length, 1);
    assert.deepEqual(loadedPromptDrafts[0].version, { generation: 1, revision: 0 });

    secondStore.close();
    cleanupDb();
  });

  run('事务中保存的数据可以整体提交', () => {
    const store = new SqliteTaskStore(TEST_DB_PATH);
    const draft = createTaskDraft('task-005');
    const memory = createTaskMemory('task-005');

    store.transaction(() => {
      store.saveTaskDraft(draft);
      store.saveTaskMemory(memory);
    });

    assert.ok(store.loadTaskDraft('task-005'));
    assert.ok(store.loadTaskMemory('task-005'));

    store.close();
    cleanupDb();
  });
}

module.exports = {
  runSqliteTaskStoreTests,
};
