import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { ManifestSchema, TaskStatus, TaskPriority, type Manifest } from '@clawkit/shared';
import type { TaskDraft } from '../models/task-draft';
import type { TaskMemory } from '../models/task-memory';
import type { PromptDraft } from '../models/prompt-draft';
import type { ApprovalRecord } from '../models/approval-record';
import { CONTROLLER_SCHEMA_SQL_FILE } from './tables';

/**
 * SQLite 持久化存储
 * 
 * 负责将 controller 核心状态持久化到 SQLite 数据库：
 * - TaskDraft: 任务草稿
 * - TaskMemory: 任务记忆
 * - PromptDraft: 提示词草稿
 * - ApprovalRecord: 审批记录
 */
export class SqliteTaskStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    // 确保数据库目录存在
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 初始化数据库连接
    this.db = new Database(dbPath);
    
    // 启用 WAL 模式以支持并发读写
    this.db.pragma('journal_mode = WAL');
    
    // 初始化 schema
    this.initializeSchema();
  }

  /**
   * 初始化数据库 schema
   */
  private initializeSchema(): void {
    const schema = fs.readFileSync(CONTROLLER_SCHEMA_SQL_FILE, 'utf-8');
    this.db.exec(schema);
    this.ensureTaskDraftsPriorityColumn();
  }

  /**
   * 为旧版本遗留的数据库补齐 task_drafts.priority 列。
   * CREATE TABLE IF NOT EXISTS 不会修改已存在的表，因此升级场景下需要单独迁移。
   */
  private ensureTaskDraftsPriorityColumn(): void {
    const columns = this.db.prepare('PRAGMA table_info(task_drafts)').all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === 'priority')) {
      this.db.exec(
        "ALTER TABLE task_drafts ADD COLUMN priority TEXT NOT NULL DEFAULT 'MEDIUM'",
      );
    }
  }

  // ==================== TaskDraft 操作 ====================

  /**
   * 保存任务草稿
   */
  saveTaskDraft(draft: TaskDraft): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO task_drafts (
        task_id, source_text, project_key, intent,
        constraints_json, acceptance_criteria_json,
        status, priority, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      draft.taskId,
      draft.sourceText,
      draft.projectKey,
      draft.intent,
      JSON.stringify(draft.constraints),
      JSON.stringify(draft.acceptanceCriteria),
      draft.status,
      draft.priority,
      draft.createdAt.toISOString(),
      draft.updatedAt.toISOString()
    );
  }

  /**
   * 加载单个任务草稿
   */
  loadTaskDraft(taskId: string): TaskDraft | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM task_drafts WHERE task_id = ?
    `);

    const row = stmt.get(taskId) as any;
    if (!row) return undefined;

    return this.rowToTaskDraft(row);
  }

  /**
   * 加载所有任务草稿
   */
  loadAllTaskDrafts(): TaskDraft[] {
    const stmt = this.db.prepare(`
      SELECT * FROM task_drafts ORDER BY created_at DESC
    `);

    const rows = stmt.all() as any[];
    return rows.map(row => this.rowToTaskDraft(row));
  }

  /**
   * 按状态加载任务草稿
   */
  loadTaskDraftsByStatus(status: string): TaskDraft[] {
    const stmt = this.db.prepare(`
      SELECT * FROM task_drafts WHERE status = ? ORDER BY created_at DESC
    `);

    const rows = stmt.all(status) as any[];
    return rows.map(row => this.rowToTaskDraft(row));
  }

  /**
   * 删除任务草稿
   */
  deleteTaskDraft(taskId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM task_drafts WHERE task_id = ?
    `);
    stmt.run(taskId);
  }

  private rowToTaskDraft(row: any): TaskDraft {
    return {
      taskId: row.task_id,
      sourceText: row.source_text,
      projectKey: row.project_key,
      intent: row.intent,
      constraints: JSON.parse(row.constraints_json),
      acceptanceCriteria: JSON.parse(row.acceptance_criteria_json),
      status: row.status,
      priority: row.priority as TaskPriority,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  // ==================== TaskMemory 操作 ====================

  /**
   * 保存任务记忆
   */
  saveTaskMemory(memory: TaskMemory): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO task_memories (
        task_id, normalized_task_card_json, prompt_draft_history_json,
        user_revision_history_json, execution_summary_json,
        similar_task_refs_json, project_rule_refs_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      memory.taskId,
      JSON.stringify(memory.normalizedTaskCard),
      JSON.stringify(memory.promptDraftHistory),
      JSON.stringify(memory.userRevisionHistory),
      memory.executionSummary ? JSON.stringify(memory.executionSummary) : null,
      JSON.stringify(memory.similarTaskRefs),
      JSON.stringify(memory.projectRuleRefs),
      memory.createdAt.toISOString(),
      memory.updatedAt.toISOString()
    );
  }

  /**
   * 加载任务记忆
   */
  loadTaskMemory(taskId: string): TaskMemory | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM task_memories WHERE task_id = ?
    `);

    const row = stmt.get(taskId) as any;
    if (!row) return undefined;

    return this.rowToTaskMemory(row);
  }

  /**
   * 加载所有任务记忆
   */
  loadAllTaskMemories(): TaskMemory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM task_memories ORDER BY created_at DESC
    `);

    const rows = stmt.all() as any[];
    return rows.map(row => this.rowToTaskMemory(row));
  }

  /**
   * 删除任务记忆
   */
  deleteTaskMemory(taskId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM task_memories WHERE task_id = ?
    `);
    stmt.run(taskId);
  }

  private rowToTaskMemory(row: any): TaskMemory {
    return {
      taskId: row.task_id,
      normalizedTaskCard: JSON.parse(row.normalized_task_card_json),
      promptDraftHistory: JSON.parse(row.prompt_draft_history_json),
      userRevisionHistory: JSON.parse(row.user_revision_history_json),
      executionSummary: row.execution_summary_json ? JSON.parse(row.execution_summary_json) : null,
      similarTaskRefs: JSON.parse(row.similar_task_refs_json),
      projectRuleRefs: JSON.parse(row.project_rule_refs_json),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  // ==================== PromptDraft 操作 ====================

  /**
   * 保存提示词草稿
   */
  savePromptDraft(draft: PromptDraft): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO prompt_drafts (
        task_id, version_generation, version_revision,
        project_key, draft_text, summary_view_json,
        risk_flags_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      draft.taskId,
      draft.version.generation,
      draft.version.revision,
      draft.projectKey,
      draft.draftText,
      JSON.stringify(draft.summaryView),
      JSON.stringify(draft.riskFlags),
      draft.createdAt.toISOString()
    );
  }

  /**
   * 加载任务的所有提示词草稿
   */
  loadPromptDrafts(taskId: string): PromptDraft[] {
    const stmt = this.db.prepare(`
      SELECT * FROM prompt_drafts 
      WHERE task_id = ? 
      ORDER BY version_generation DESC, version_revision DESC
    `);

    const rows = stmt.all(taskId) as any[];
    return rows.map(row => this.rowToPromptDraft(row));
  }

  /**
   * 加载特定版本的提示词草稿
   */
  loadPromptDraft(taskId: string, generation: number, revision: number): PromptDraft | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM prompt_drafts 
      WHERE task_id = ? AND version_generation = ? AND version_revision = ?
    `);

    const row = stmt.get(taskId, generation, revision) as any;
    if (!row) return undefined;

    return this.rowToPromptDraft(row);
  }

  /**
   * 删除任务的所有提示词草稿
   */
  deletePromptDrafts(taskId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM prompt_drafts WHERE task_id = ?
    `);
    stmt.run(taskId);
  }

  private rowToPromptDraft(row: any): PromptDraft {
    return {
      taskId: row.task_id,
      version: {
        generation: row.version_generation,
        revision: row.version_revision,
      },
      projectKey: row.project_key,
      draftText: row.draft_text,
      summaryView: JSON.parse(row.summary_view_json),
      riskFlags: JSON.parse(row.risk_flags_json),
      createdAt: new Date(row.created_at),
    };
  }

  // ==================== ApprovalRecord 操作 ====================

  /**
   * 保存审批记录
   */
  saveApprovalRecord(record: ApprovalRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO approval_records (
        task_id, action, operator, comment, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.taskId,
      record.action,
      record.operator,
      record.comment,
      record.createdAt.toISOString()
    );
  }

  /**
   * 加载任务的所有审批记录
   */
  loadApprovalRecords(taskId: string): ApprovalRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM approval_records 
      WHERE task_id = ? 
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(taskId) as any[];
    return rows.map(row => this.rowToApprovalRecord(row));
  }

  /**
   * 删除任务的所有审批记录
   */
  deleteApprovalRecords(taskId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM approval_records WHERE task_id = ?
    `);
    stmt.run(taskId);
  }

  private rowToApprovalRecord(row: any): ApprovalRecord {
    return {
      taskId: row.task_id,
      action: row.action,
      operator: row.operator,
      comment: row.comment,
      fromStatus: TaskStatus.DRAFT,
      toStatus: TaskStatus.DRAFT,
      createdAt: new Date(row.created_at),
    };
  }

  // ==================== 事务支持 ====================

  /**
   * 在事务中执行操作
   */
  transaction<T>(fn: () => T): T {
    const txn = this.db.transaction(fn);
    return txn();
  }

  // ==================== 清理与关闭 ====================

  /**
   * 关闭数据库连接
   */
  close(): void {
    this.db.close();
  }

  /**
   * 清空所有表（仅用于测试）
   */
  clearAll(): void {
    this.db.exec(`
      DELETE FROM approval_records;
      DELETE FROM prompt_drafts;
      DELETE FROM task_memories;
      DELETE FROM task_drafts;
    `);
  }

  private asObject(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private asString(value: unknown): string {
    if (typeof value !== 'string') {
      throw new Error('SQLite 字段类型非法：期望 string');
    }
    return value;
  }

  private asNumber(value: unknown): number {
    if (typeof value !== 'number') {
      throw new Error('SQLite 字段类型非法：期望 number');
    }
    return value;
  }

  private extractLastInsertRowId(value: unknown): number {
    const obj = this.asObject(value);
    if (!obj) {
      throw new Error('SQLite 插入结果格式非法');
    }

    const id = obj.lastInsertRowid;
    if (typeof id === 'bigint') {
      return Number(id);
    }
    if (typeof id === 'number') {
      return id;
    }
    throw new Error('SQLite 插入结果缺少 lastInsertRowid');
  }
}
