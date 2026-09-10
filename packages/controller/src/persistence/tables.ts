import { join } from 'path';

export const CONTROLLER_TABLES = {
  TASK_DRAFTS: 'task_drafts',
  TASK_MEMORIES: 'task_memories',
  PROMPT_DRAFTS: 'prompt_drafts',
  APPROVAL_RECORDS: 'approval_records',
  SETUP_SESSIONS: 'setup_sessions',
  SETUP_RUNS: 'setup_runs',
  SETUP_STEPS: 'setup_steps',
} as const;

export const CONTROLLER_INDEXES = {
  TASK_DRAFTS_STATUS: 'idx_task_drafts_status',
  TASK_DRAFTS_PROJECT_KEY: 'idx_task_drafts_project_key',
  TASK_DRAFTS_CREATED_AT: 'idx_task_drafts_created_at',
  TASK_DRAFTS_STATUS_CREATED: 'idx_task_drafts_status_created',
  TASK_DRAFTS_PROJECT_CREATED: 'idx_task_drafts_project_created',
  PROMPT_DRAFTS_TASK_ID: 'idx_prompt_drafts_task_id',
  PROMPT_DRAFTS_TASK_VERSION: 'idx_prompt_drafts_task_version',
  APPROVAL_RECORDS_TASK_ID: 'idx_approval_records_task_id',
  SETUP_RUNS_SESSION_ID: 'idx_setup_runs_session_id',
  SETUP_RUNS_STATUS: 'idx_setup_runs_status',
  SETUP_RUNS_CREATED_AT: 'idx_setup_runs_created_at',
  SETUP_STEPS_RUN_STEP: 'idx_setup_steps_run_step',
  SETUP_STEPS_RUN_ID: 'idx_setup_steps_run_id',
} as const;

export const CONTROLLER_SCHEMA_SQL_FILE = join(__dirname, 'init.sql');
