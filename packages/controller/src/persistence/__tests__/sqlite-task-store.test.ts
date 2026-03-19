import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TaskStatus, ApprovalAction } from '@clawkit/shared';
import { SqliteTaskStore } from '../sqlite-task-store';
import type { TaskDraft } from '../../models/task-draft';
import type { TaskMemory } from '../../models/task-memory';
import type { PromptDraft } from '../../models/prompt-draft';
import type { ApprovalRecord } from '../../models/approval-record';

const TEST_DB_PATH = path.join(__dirname, 'test-clawkit.db');

describe('SqliteTaskStore', () => {
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

  describe('TaskDraft', () => {
    it('应该保存并加载任务草稿', () => {
      const draft: TaskDraft = {
        taskId: 'task-001',
        sourceText: '实现用户登录功能',
        projectKey: 'project-alpha',
        intent: '添加用户认证',
        constraints: ['使用 JWT', '密码加密'],
        acceptanceCriteria: ['登录成功返回 token', '密码错误返回 401'],
        status: TaskStatus.DRAFT,
        createdAt: new Date('2026-03-15T10:00:00Z'),
        updatedAt: new Date('2026-03-15T10:00:00Z'),
      };

      store.saveTaskDraft(draft);
      const loaded = store.loadTaskDraft('task-001');

      expect(loaded).toBeDefined();
      expect(loaded?.taskId).toBe('task-001');
      expect(loaded?.sourceText).toBe('实现用户登录功能');
      expect(loaded?.projectKey).toBe('project-alpha');
      expect(loaded?.intent).toBe('添加用户认证');
      expect(loaded?.constraints).toEqual(['使用 JWT', '密码加密']);
      expect(loaded?.acceptanceCriteria).toEqual(['登录成功返回 token', '密码错误返回 401']);
      expect(loaded?.status).toBe(TaskStatus.DRAFT);
    });

    it('应该更新已存在的任务草稿', () => {
      const draft: TaskDraft = {
        taskId: 'task-002',
        sourceText: '原始需求',
        projectKey: 'project-beta',
        intent: '原始意图',
        constraints: [],
        acceptanceCriteria: [],
        status: TaskStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      store.saveTaskDraft(draft);

      const updated: TaskDraft = {
        ...draft,
        sourceText: '更新后的需求',
        status: TaskStatus.APPROVED,
        updatedAt: new Date(),
      };

      store.saveTaskDraft(updated);
      const loaded = store.loadTaskDraft('task-002');

      expect(loaded?.sourceText).toBe('更新后的需求');
      expect(loaded?.status).toBe(TaskStatus.APPROVED);
    });

    it('应该加载所有任务草稿', () => {
      const draft1: TaskDraft = {
        taskId: 'task-003',
        sourceText: '需求1',
        projectKey: 'project-gamma',
        intent: '意图1',
        constraints: [],
        acceptanceCriteria: [],
        status: TaskStatus.DRAFT,
        createdAt: new Date('2026-03-15T10:00:00Z'),
        updatedAt: new Date('2026-03-15T10:00:00Z'),
      };

      const draft2: TaskDraft = {
        taskId: 'task-004',
        sourceText: '需求2',
        projectKey: 'project-gamma',
        intent: '意图2',
        constraints: [],
        acceptanceCriteria: [],
        status: TaskStatus.APPROVED,
        createdAt: new Date('2026-03-15T11:00:00Z'),
        updatedAt: new Date('2026-03-15T11:00:00Z'),
      };

      store.saveTaskDraft(draft1);
      store.saveTaskDraft(draft2);

      const all = store.loadAllTaskDrafts();
      expect(all).toHaveLength(2);
      expect(all.map(d => d.taskId)).toContain('task-003');
      expect(all.map(d => d.taskId)).toContain('task-004');
    });

    it('应该按状态加载任务草稿', () => {
      const draft1: TaskDraft = {
        taskId: 'task-005',
        sourceText: '需求1',
        projectKey: 'project-delta',
        intent: '意图1',
        constraints: [],
        acceptanceCriteria: [],
        status: TaskStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const draft2: TaskDraft = {
        taskId: 'task-006',
        sourceText: '需求2',
        projectKey: 'project-delta',
        intent: '意图2',
        constraints: [],
        acceptanceCriteria: [],
        status: TaskStatus.APPROVED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      store.saveTaskDraft(draft1);
      store.saveTaskDraft(draft2);

      const drafts = store.loadTaskDraftsByStatus(TaskStatus.DRAFT);
      expect(drafts).toHaveLength(1);
      expect(drafts[0].taskId).toBe('task-005');

      const approved = store.loadTaskDraftsByStatus(TaskStatus.APPROVED);
      expect(approved).toHaveLength(1);
      expect(approved[0].taskId).toBe('task-006');
    });

    it('应该删除任务草稿', () => {
      const draft: TaskDraft = {
        taskId: 'task-007',
        sourceText: '需求',
        projectKey: 'project-epsilon',
        intent: '意图',
        constraints: [],
        acceptanceCriteria: [],
        status: TaskStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      store.saveTaskDraft(draft);
      expect(store.loadTaskDraft('task-007')).toBeDefined();

      store.deleteTaskDraft('task-007');
      expect(store.loadTaskDraft('task-007')).toBeUndefined();
    });
  });

  describe('TaskMemory', () => {
    it('应该保存并加载任务记忆', () => {
      const memory: TaskMemory = {
        taskId: 'task-101',
        normalizedTaskCard: {
          title: '用户登录',
          objective: '实现用户认证',
          scope: ['登录接口', '密码验证'],
          outOfScope: ['注册功能'],
          constraints: ['使用 JWT'],
          acceptanceCriteria: ['登录成功返回 token'],
        },
        promptDraftHistory: [
          {
            version: { generation: 1, revision: 0 },
            summary: '初始提示词',
            createdAt: new Date('2026-03-15T10:00:00Z'),
          },
        ],
        userRevisionHistory: [],
        executionSummary: null,
        similarTaskRefs: [],
        projectRuleRefs: [],
        createdAt: new Date('2026-03-15T10:00:00Z'),
        updatedAt: new Date('2026-03-15T10:00:00Z'),
      };

      store.saveTaskMemory(memory);
      const loaded = store.loadTaskMemory('task-101');

      expect(loaded).toBeDefined();
      expect(loaded?.taskId).toBe('task-101');
      expect(loaded?.normalizedTaskCard.title).toBe('用户登录');
      expect(loaded?.promptDraftHistory).toHaveLength(1);
    });

    it('应该保存包含执行摘要的任务记忆', () => {
      const memory: TaskMemory = {
        taskId: 'task-102',
        normalizedTaskCard: {
          title: '测试任务',
          objective: '测试',
          scope: [],
          outOfScope: [],
          constraints: [],
          acceptanceCriteria: [],
        },
        promptDraftHistory: [],
        userRevisionHistory: [],
        executionSummary: {
          status: 'done',
          note: '执行完成',
          summary: '成功实现功能',
          placeholderExecution: false,
          logs: ['日志1', '日志2'],
          changedFiles: ['file1.ts', 'file2.ts'],
          commands: ['npm test'],
          testResult: '所有测试通过',
          lastUpdatedAt: new Date('2026-03-15T12:00:00Z'),
        },
        similarTaskRefs: [],
        projectRuleRefs: [],
        createdAt: new Date('2026-03-15T10:00:00Z'),
        updatedAt: new Date('2026-03-15T12:00:00Z'),
      };

      store.saveTaskMemory(memory);
      const loaded = store.loadTaskMemory('task-102');

      expect(loaded?.executionSummary).toBeDefined();
      expect(loaded?.executionSummary?.status).toBe('done');
      expect(loaded?.executionSummary?.summary).toBe('成功实现功能');
      expect(loaded?.executionSummary?.logs).toEqual(['日志1', '日志2']);
    });
  });

  describe('PromptDraft', () => {
    it('应该保存并加载提示词草稿', () => {
      const draft: PromptDraft = {
        taskId: 'task-201',
        version: { generation: 1, revision: 0 },
        projectKey: 'project-zeta',
        draftText: '请实现用户登录功能...',
        summaryView: {
          goal: '实现登录',
          scope: ['登录接口'],
          constraints: ['使用 JWT'],
          acceptanceCriteria: ['返回 token'],
          confirmationChecklist: ['测试通过'],
        },
        riskFlags: ['需要数据库迁移'],
        createdAt: new Date('2026-03-15T10:00:00Z'),
      };

      store.savePromptDraft(draft);
      const loaded = store.loadPromptDrafts('task-201');

      expect(loaded).toHaveLength(1);
      expect(loaded[0].taskId).toBe('task-201');
      expect(loaded[0].version.generation).toBe(1);
      expect(loaded[0].version.revision).toBe(0);
      expect(loaded[0].draftText).toBe('请实现用户登录功能...');
    });

    it('应该保存同一任务的多个版本', () => {
      const draft1: PromptDraft = {
        taskId: 'task-202',
        version: { generation: 1, revision: 0 },
        projectKey: 'project-eta',
        draftText: '版本 1.0',
        summaryView: {
          goal: '目标',
          scope: [],
          constraints: [],
          acceptanceCriteria: [],
          confirmationChecklist: [],
        },
        riskFlags: [],
        createdAt: new Date('2026-03-15T10:00:00Z'),
      };

      const draft2: PromptDraft = {
        taskId: 'task-202',
        version: { generation: 1, revision: 1 },
        projectKey: 'project-eta',
        draftText: '版本 1.1',
        summaryView: {
          goal: '目标',
          scope: [],
          constraints: [],
          acceptanceCriteria: [],
          confirmationChecklist: [],
        },
        riskFlags: [],
        createdAt: new Date('2026-03-15T11:00:00Z'),
      };

      store.savePromptDraft(draft1);
      store.savePromptDraft(draft2);

      const loaded = store.loadPromptDrafts('task-202');
      expect(loaded).toHaveLength(2);
    });

    it('应该加载特定版本的提示词草稿', () => {
      const draft: PromptDraft = {
        taskId: 'task-203',
        version: { generation: 2, revision: 3 },
        projectKey: 'project-theta',
        draftText: '特定版本',
        summaryView: {
          goal: '目标',
          scope: [],
          constraints: [],
          acceptanceCriteria: [],
          confirmationChecklist: [],
        },
        riskFlags: [],
        createdAt: new Date(),
      };

      store.savePromptDraft(draft);
      const loaded = store.loadPromptDraft('task-203', 2, 3);

      expect(loaded).toBeDefined();
      expect(loaded?.version.generation).toBe(2);
      expect(loaded?.version.revision).toBe(3);
    });
  });

  describe('ApprovalRecord', () => {
    it('应该保存并加载审批记录', () => {
      const record: ApprovalRecord = {
        taskId: 'task-301',
        action: ApprovalAction.APPROVE,
        operator: 'user@example.com',
        comment: '同意执行',
        fromStatus: TaskStatus.WAITING_APPROVAL,
        toStatus: TaskStatus.APPROVED,
        createdAt: new Date('2026-03-15T10:00:00Z'),
      };

      store.saveApprovalRecord(record);
      const loaded = store.loadApprovalRecords('task-301');

      expect(loaded).toHaveLength(1);
      expect(loaded[0].taskId).toBe('task-301');
      expect(loaded[0].action).toBe(ApprovalAction.APPROVE);
      expect(loaded[0].operator).toBe('user@example.com');
      expect(loaded[0].comment).toBe('同意执行');
    });

    it('应该保存同一任务的多条审批记录', () => {
      const record1: ApprovalRecord = {
        taskId: 'task-302',
        action: ApprovalAction.REVISE,
        operator: 'user1@example.com',
        comment: '需要修改',
        fromStatus: TaskStatus.WAITING_APPROVAL,
        toStatus: TaskStatus.DRAFT,
        createdAt: new Date('2026-03-15T10:00:00Z'),
      };

      const record2: ApprovalRecord = {
        taskId: 'task-302',
        action: ApprovalAction.APPROVE,
        operator: 'user2@example.com',
        comment: '修改后同意',
        fromStatus: TaskStatus.WAITING_APPROVAL,
        toStatus: TaskStatus.APPROVED,
        createdAt: new Date('2026-03-15T11:00:00Z'),
      };

      store.saveApprovalRecord(record1);
      store.saveApprovalRecord(record2);

      const loaded = store.loadApprovalRecords('task-302');
      expect(loaded).toHaveLength(2);
    });
  });

  describe('事务支持', () => {
    it('应该支持事务操作', () => {
      const draft: TaskDraft = {
        taskId: 'task-401',
        sourceText: '事务测试',
        projectKey: 'project-iota',
        intent: '测试事务',
        constraints: [],
        acceptanceCriteria: [],
        status: TaskStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const memory: TaskMemory = {
        taskId: 'task-401',
        normalizedTaskCard: {
          title: '事务测试',
          objective: '测试',
          scope: [],
          outOfScope: [],
          constraints: [],
          acceptanceCriteria: [],
        },
        promptDraftHistory: [],
        userRevisionHistory: [],
        executionSummary: null,
        similarTaskRefs: [],
        projectRuleRefs: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      store.transaction(() => {
        store.saveTaskDraft(draft);
        store.saveTaskMemory(memory);
      });

      expect(store.loadTaskDraft('task-401')).toBeDefined();
      expect(store.loadTaskMemory('task-401')).toBeDefined();
    });
  });

  describe('清理操作', () => {
    it('应该清空所有表', () => {
      const draft: TaskDraft = {
        taskId: 'task-501',
        sourceText: '测试',
        projectKey: 'project-kappa',
        intent: '测试',
        constraints: [],
        acceptanceCriteria: [],
        status: TaskStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      store.saveTaskDraft(draft);
      expect(store.loadAllTaskDrafts()).toHaveLength(1);

      store.clearAll();
      expect(store.loadAllTaskDrafts()).toHaveLength(0);
    });
  });
});
