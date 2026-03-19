import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { ManifestSchema, TaskStatus, type Manifest } from '@clawkit/shared';
import type { TaskDraft } from '../models/task-draft';
import type { TaskMemory } from '../models/task-memory';
import type { PromptDraft } from '../models/prompt-draft';
import type { ApprovalRecord } from '../models/approval-record';
import type { SetupRun } from '../models/setup-run';
import type { SetupSession } from '../models/setup-session';
import type { SetupStep } from '../models/setup-step';
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
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      draft.taskId,
      draft.sourceText,
      draft.projectKey,
      draft.intent,
      JSON.stringify(draft.constraints),
      JSON.stringify(draft.acceptanceCriteria),
      draft.status,
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
      DELETE FROM setup_steps;
      DELETE FROM setup_runs;
      DELETE FROM setup_sessions;
    `);
  }

  saveSetupSession(session: SetupSession): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO setup_sessions (
        session_id, status, form_data_json, manifest_yaml, created_at, updated_at, topology
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.sessionId,
      session.status,
      session.formData ? JSON.stringify(session.formData) : null,
      session.manifestPreview,
      session.createdAt.toISOString(),
      session.updatedAt.toISOString(),
      session.topology,
    );
  }

  loadSetupSession(sessionId: string): SetupSession | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM setup_sessions WHERE session_id = ?
    `);
    const row = stmt.get(sessionId) as unknown;
    if (!row) return undefined;

    const obj = this.asObject(row);
    if (!obj) return undefined;

    return {
      sessionId: this.asString(obj.session_id),
      status: this.asString(obj.status) as SetupSession['status'],
      topology: obj.topology ? this.asString(obj.topology) : 'all-in-one',
      formData: obj.form_data_json ? (JSON.parse(this.asString(obj.form_data_json)) as Record<string, unknown>) : null,
      manifestPreview: obj.manifest_yaml ? this.asString(obj.manifest_yaml) : null,
      createdAt: new Date(this.asString(obj.created_at)),
      updatedAt: new Date(this.asString(obj.updated_at)),
    };
  }

  saveSetupRun(run: SetupRun): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO setup_runs (
        run_id, session_id, parent_run_id,
        status, current_step,
        manifest_json, manifest_yaml,
        meta_json, summary_text, error_summary,
        started_at, finished_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      run.runId,
      run.sessionId,
      run.parentRunId,
      run.status,
      run.currentStep,
      JSON.stringify(run.manifest),
      run.manifestYaml,
      JSON.stringify({
        ...(run.meta ?? {}),
        errorSummary: run.errorSummary,
      }),
      run.summary,
      run.errorSummary,
      run.startedAt ? run.startedAt.toISOString() : null,
      run.finishedAt ? run.finishedAt.toISOString() : null,
      run.createdAt.toISOString(),
      run.updatedAt.toISOString(),
    );
  }

  loadSetupRun(runId: string): SetupRun | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM setup_runs WHERE run_id = ?
    `);
    const row = stmt.get(runId) as unknown;
    if (!row) return undefined;

    return this.rowToSetupRun(row);
  }

  loadAllSetupRuns(): SetupRun[] {
    const stmt = this.db.prepare(`
      SELECT * FROM setup_runs ORDER BY created_at DESC
    `);
    const rows = stmt.all() as unknown[];
    return rows.map((row) => this.rowToSetupRun(row));
  }

  insertSetupStep(step: Omit<SetupStep, 'stepId'>): SetupStep {
    const stmt = this.db.prepare(`
      INSERT INTO setup_steps (
        run_id, step_name, title, status, detail, logs_json,
        started_at, finished_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      step.runId,
      step.stepKey,
      step.title,
      step.status,
      step.errorMessage,
      JSON.stringify(step.logSummary ?? []),
      step.startedAt ? step.startedAt.toISOString() : null,
      step.finishedAt ? step.finishedAt.toISOString() : null,
      step.createdAt.toISOString(),
      step.updatedAt.toISOString(),
    ) as unknown;

    const insertedId = this.extractLastInsertRowId(result);
    return {
      ...step,
      stepId: insertedId,
    };
  }

  saveSetupStep(step: SetupStep): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO setup_steps (
        id, run_id, step_name, title, status, detail, logs_json,
        started_at, finished_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      step.stepId,
      step.runId,
      step.stepKey,
      step.title,
      step.status,
      step.errorMessage,
      JSON.stringify(step.logSummary ?? []),
      step.startedAt ? step.startedAt.toISOString() : null,
      step.finishedAt ? step.finishedAt.toISOString() : null,
      step.createdAt.toISOString(),
      step.updatedAt.toISOString(),
    );
  }

  loadSetupSteps(runId: string): SetupStep[] {
    const stmt = this.db.prepare(`
      SELECT * FROM setup_steps WHERE run_id = ? ORDER BY id ASC
    `);
    const rows = stmt.all(runId) as unknown[];
    return rows.map((row) => this.rowToSetupStep(row));
  }

  private rowToSetupRun(row: unknown): SetupRun {
    const obj = this.asObject(row);
    if (!obj) {
      throw new Error('setup_runs 数据行格式非法');
    }

    const manifestJson = this.asString(obj.manifest_json);
    const parsedManifest = JSON.parse(manifestJson) as unknown;
    const manifestParsed = ManifestSchema.safeParse(parsedManifest);
    if (!manifestParsed.success) {
      const first = manifestParsed.error.issues[0];
      throw new Error(`setup_runs manifest_json 校验失败：${first?.message ?? '未知错误'}`);
    }

    return {
      runId: this.asString(obj.run_id),
      sessionId: this.asString(obj.session_id),
      parentRunId: obj.parent_run_id ? this.asString(obj.parent_run_id) : null,
      status: this.asString(obj.status) as SetupRun['status'],
      currentStep: obj.current_step ? this.asString(obj.current_step) : null,
      manifest: manifestParsed.data as Manifest,
      manifestYaml: this.asString(obj.manifest_yaml),
      meta: this.readRunMeta(this.asString(obj.meta_json)).meta,
      summary: obj.summary_text ? this.asString(obj.summary_text) : null,
      errorSummary: obj.error_summary ? this.asString(obj.error_summary) : this.readRunMeta(this.asString(obj.meta_json)).errorSummary,
      startedAt: obj.started_at ? new Date(this.asString(obj.started_at)) : null,
      finishedAt: obj.finished_at ? new Date(this.asString(obj.finished_at)) : null,
      createdAt: new Date(this.asString(obj.created_at)),
      updatedAt: new Date(this.asString(obj.updated_at)),
    };
  }

  private rowToSetupStep(row: unknown): SetupStep {
    const obj = this.asObject(row);
    if (!obj) {
      throw new Error('setup_steps 数据行格式非法');
    }

    return {
      stepId: this.asNumber(obj.id),
      runId: this.asString(obj.run_id),
      stepKey: this.asString(obj.step_name),
      title: this.asString(obj.title),
      status: this.asString(obj.status) as SetupStep['status'],
      logSummary: JSON.parse(this.asString(obj.logs_json)) as string[],
      errorMessage: obj.detail ? this.asString(obj.detail) : null,
      startedAt: obj.started_at ? new Date(this.asString(obj.started_at)) : null,
      finishedAt: obj.finished_at ? new Date(this.asString(obj.finished_at)) : null,
      createdAt: new Date(this.asString(obj.created_at)),
      updatedAt: new Date(this.asString(obj.updated_at)),
    };
  }

  private readRunMeta(metaJson: string): { meta: Record<string, unknown>; errorSummary: string | null } {
    const parsed = JSON.parse(metaJson) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { meta: {}, errorSummary: null };
    }
    const obj = parsed as Record<string, unknown>;
    const errorSummary = typeof obj.errorSummary === 'string' ? obj.errorSummary : null;
    const { errorSummary: _ignored, ...rest } = obj;
    return {
      meta: rest,
      errorSummary,
    };
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
