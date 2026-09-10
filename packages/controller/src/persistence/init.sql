CREATE TABLE IF NOT EXISTS task_drafts (
  task_id TEXT PRIMARY KEY,
  source_text TEXT NOT NULL,
  project_key TEXT NOT NULL,
  intent TEXT NOT NULL,
  constraints_json TEXT NOT NULL,
  acceptance_criteria_json TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  execution_timeout_ms INTEGER,
  max_retries INTEGER DEFAULT 0
) STRICT;

CREATE TABLE IF NOT EXISTS task_memories (
  task_id TEXT PRIMARY KEY,
  normalized_task_card_json TEXT NOT NULL,
  prompt_draft_history_json TEXT NOT NULL,
  user_revision_history_json TEXT NOT NULL,
  execution_summary_json TEXT,
  similar_task_refs_json TEXT NOT NULL,
  project_rule_refs_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES task_drafts(task_id)
) STRICT;

CREATE TABLE IF NOT EXISTS prompt_drafts (
  id INTEGER PRIMARY KEY,
  task_id TEXT NOT NULL,
  version_generation INTEGER NOT NULL,
  version_revision INTEGER NOT NULL,
  project_key TEXT NOT NULL,
  draft_text TEXT NOT NULL,
  summary_view_json TEXT NOT NULL,
  risk_flags_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES task_drafts(task_id)
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_drafts_task_version
  ON prompt_drafts(task_id, version_generation, version_revision);

CREATE INDEX IF NOT EXISTS idx_prompt_drafts_task_id
  ON prompt_drafts(task_id);

CREATE TABLE IF NOT EXISTS approval_records (
  id INTEGER PRIMARY KEY,
  task_id TEXT NOT NULL,
  action TEXT NOT NULL,
  operator TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES task_drafts(task_id)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_task_drafts_status
  ON task_drafts(status);

CREATE INDEX IF NOT EXISTS idx_task_drafts_project_key
  ON task_drafts(project_key);

CREATE INDEX IF NOT EXISTS idx_task_drafts_created_at
  ON task_drafts(created_at DESC);

-- 复合索引：支持 status + created_at 组合查询（最常见查询模式）
CREATE INDEX IF NOT EXISTS idx_task_drafts_status_created
  ON task_drafts(status, created_at DESC);

-- 复合索引：支持 project_key + created_at 组合查询
CREATE INDEX IF NOT EXISTS idx_task_drafts_project_created
  ON task_drafts(project_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_records_task_id
  ON approval_records(task_id);

CREATE TABLE IF NOT EXISTS setup_sessions (
  session_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  form_data_json TEXT,
  manifest_yaml TEXT,
  topology TEXT NOT NULL DEFAULT 'all-in-one',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS setup_runs (
  run_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  parent_run_id TEXT,
  status TEXT NOT NULL,
  current_step TEXT,
  manifest_json TEXT NOT NULL,
  manifest_yaml TEXT NOT NULL,
  meta_json TEXT NOT NULL,
  summary_text TEXT,
  error_summary TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES setup_sessions(session_id)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_setup_runs_session_id
  ON setup_runs(session_id);

CREATE INDEX IF NOT EXISTS idx_setup_runs_status
  ON setup_runs(status);

CREATE INDEX IF NOT EXISTS idx_setup_runs_created_at
  ON setup_runs(created_at);

CREATE TABLE IF NOT EXISTS setup_steps (
  id INTEGER PRIMARY KEY,
  run_id TEXT NOT NULL,
  step_name TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT,
  logs_json TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES setup_runs(run_id)
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_setup_steps_run_step
  ON setup_steps(run_id, step_name);

CREATE INDEX IF NOT EXISTS idx_setup_steps_run_id
  ON setup_steps(run_id);
