import { invoke } from '@tauri-apps/api/core';

import type {
  OpenCodeStatus,
  ReadOpenCodeLogsResult,
  RevealOpenCodePasswordResult,
  StartOpenCodeResult,
  StartProjectManagerResult,
} from './types';

export interface SaveOpenCodePasswordResult {
  passwordConfigured: boolean;
  configPath: string;
  message: string;
}

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function checkOpenCodeStatus(): Promise<OpenCodeStatus> {
  return invoke<OpenCodeStatus>('check_opencode_status');
}

export async function startOpenCode(): Promise<StartOpenCodeResult> {
  return invoke<StartOpenCodeResult>('start_opencode');
}

export async function saveOpenCodePassword(password: string): Promise<SaveOpenCodePasswordResult> {
  return invoke<SaveOpenCodePasswordResult>('save_opencode_password', { password });
}

export async function revealOpenCodePassword(): Promise<RevealOpenCodePasswordResult> {
  return invoke<RevealOpenCodePasswordResult>('reveal_opencode_password');
}

export async function readOpenCodeLogs(lines = 200): Promise<ReadOpenCodeLogsResult> {
  return invoke<ReadOpenCodeLogsResult>('read_opencode_logs', { lines });
}

export async function startProjectManager(): Promise<StartProjectManagerResult> {
  return invoke<StartProjectManagerResult>('start_project_manager');
}
