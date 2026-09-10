import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TaskStatus } from '@clawkit/shared';
import { SqliteTaskStore } from '../../src/persistence/sqlite-task-store';
import type { TaskDraft } from '../../src/models/task-draft';

const TEST_DB_PATH = path.join(__dirname, 'pagination-test.db');

describe('SqliteTaskStore 分页查询', () => {
  let store: SqliteTaskStore;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    store = new SqliteTaskStore(TEST_DB_PATH);
  });

  afterEach(() => {
    store.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    const walPath = `${TEST_DB_PATH}-wal`;
    const shmPath = `${TEST_DB_PATH}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  const createDraft = (taskId: string, projectKey: string, status: TaskStatus, createdAt: Date): TaskDraft => ({
    taskId,
    sourceText: `需求-${taskId}`,
    projectKey,
    intent: `意图-${taskId}`,
    constraints: [],
    acceptanceCriteria: [],
    status,
    createdAt,
    updatedAt: createdAt,
  });

  it('应该支持基本分页查询', () => {
    const now = new Date();
    for (let i = 0; i < 25; i++) {
      const createdAt = new Date(now.getTime() + i * 1000);
      store.saveTaskDraft(createDraft(`task-p1-${i}`, 'project-p1', TaskStatus.DRAFT, createdAt));
    }

    const result = store.queryTaskDrafts({ limit: 10, offset: 0 });
    expect(result.total).toBe(25);
    expect(result.tasks).toHaveLength(10);
    expect(result.tasks[0].taskId).toBe('task-p1-24');
    expect(result.tasks[9].taskId).toBe('task-p1-15');
  });

  it('应该支持按页码分页', () => {
    const now = new Date();
    for (let i = 0; i < 25; i++) {
      const createdAt = new Date(now.getTime() + i * 1000);
      store.saveTaskDraft(createDraft(`task-p2-${i}`, 'project-p2', TaskStatus.DRAFT, createdAt));
    }

    const page2 = store.queryTaskDrafts({ limit: 10, offset: 10 });
    expect(page2.total).toBe(25);
    expect(page2.tasks).toHaveLength(10);
    expect(page2.tasks[0].taskId).toBe('task-p2-14');

    const page3 = store.queryTaskDrafts({ limit: 10, offset: 20 });
    expect(page3.total).toBe(25);
    expect(page3.tasks).toHaveLength(5);
  });

  it('应该支持按状态过滤', () => {
    const now = new Date();
    store.saveTaskDraft(createDraft('task-s1', 'project-s', TaskStatus.DRAFT, now));
    store.saveTaskDraft(createDraft('task-s2', 'project-s', TaskStatus.APPROVED, now));
    store.saveTaskDraft(createDraft('task-s3', 'project-s', TaskStatus.DRAFT, now));
    store.saveTaskDraft(createDraft('task-s4', 'project-s', TaskStatus.DONE, now));

    const draftTasks = store.queryTaskDrafts({ status: TaskStatus.DRAFT, limit: 10, offset: 0 });
    expect(draftTasks.total).toBe(2);
    expect(draftTasks.tasks).toHaveLength(2);
    draftTasks.tasks.forEach(task => expect(task.status).toBe(TaskStatus.DRAFT));
  });

  it('应该支持按项目过滤', () => {
    const now = new Date();
    store.saveTaskDraft(createDraft('task-pk1', 'alpha', TaskStatus.DRAFT, now));
    store.saveTaskDraft(createDraft('task-pk2', 'beta', TaskStatus.DRAFT, now));
    store.saveTaskDraft(createDraft('task-pk3', 'alpha', TaskStatus.DRAFT, now));

    const alphaTasks = store.queryTaskDrafts({ projectKey: 'alpha', limit: 10, offset: 0 });
    expect(alphaTasks.total).toBe(2);
    expect(alphaTasks.tasks).toHaveLength(2);
    alphaTasks.tasks.forEach(task => expect(task.projectKey).toBe('alpha'));
  });

  it('应该支持按日期范围过滤', () => {
    store.saveTaskDraft(createDraft('task-d1', 'proj', TaskStatus.DRAFT, new Date('2026-01-15T10:00:00Z')));
    store.saveTaskDraft(createDraft('task-d2', 'proj', TaskStatus.DRAFT, new Date('2026-01-20T10:00:00Z')));
    store.saveTaskDraft(createDraft('task-d3', 'proj', TaskStatus.DRAFT, new Date('2026-01-25T10:00:00Z')));

    const result = store.queryTaskDrafts({
      startDate: '2026-01-18T00:00:00Z',
      endDate: '2026-01-22T23:59:59Z',
      limit: 10,
      offset: 0,
    });
    expect(result.total).toBe(1);
    expect(result.tasks[0].taskId).toBe('task-d2');
  });

  it('应该支持组合过滤', () => {
    const now = new Date();
    store.saveTaskDraft(createDraft('task-c1', 'proj-a', TaskStatus.DRAFT, now));
    store.saveTaskDraft(createDraft('task-c2', 'proj-a', TaskStatus.APPROVED, now));
    store.saveTaskDraft(createDraft('task-c3', 'proj-b', TaskStatus.DRAFT, now));
    store.saveTaskDraft(createDraft('task-c4', 'proj-b', TaskStatus.APPROVED, now));

    const result = store.queryTaskDrafts({
      status: TaskStatus.DRAFT,
      projectKey: 'proj-a',
      limit: 10,
      offset: 0,
    });
    expect(result.total).toBe(1);
    expect(result.tasks[0].taskId).toBe('task-c1');
  });

  it('应该正确处理空结果', () => {
    const result = store.queryTaskDrafts({ status: TaskStatus.DONE, limit: 10, offset: 0 });
    expect(result.total).toBe(0);
    expect(result.tasks).toHaveLength(0);
  });

  it('应该处理 offset 超出范围', () => {
    const now = new Date();
    store.saveTaskDraft(createDraft('task-o1', 'proj', TaskStatus.DRAFT, now));

    const result = store.queryTaskDrafts({ limit: 10, offset: 100 });
    expect(result.total).toBe(1);
    expect(result.tasks).toHaveLength(0);
  });
});
