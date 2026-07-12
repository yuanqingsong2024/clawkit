export interface OpenCodeStatus {
  online: boolean;
  port: number;
  host: string;
  passwordConfigured: boolean;
  pid?: number;
  logFile?: string;
  detail?: string;
}

export interface StartOpenCodeResult {
  started: boolean;
  port: number;
  pid?: number;
  logFile: string;
  message: string;
  detail?: string;
}

export interface ReadOpenCodeLogsResult {
  logFile: string;
  lines: string[];
}

export interface StartProjectManagerResult {
  started: boolean;
  message: string;
  controllerUrl?: string;
  webUrl?: string;
  opened: boolean;
  openDetail?: string;
}

export interface SaveOpenCodePasswordResult {
  passwordConfigured: boolean;
  configPath: string;
  message: string;
}

export interface RevealOpenCodePasswordResult {
  password: string;
  configPath: string;
  message: string;
}

export interface OpenUrlResult {
  opened: boolean;
  message: string;
  detail?: string;
}

interface RawOpenCodeStatus extends Omit<OpenCodeStatus, 'passwordConfigured' | 'logFile'> {
  passwordConfigured?: boolean;
  password_configured?: boolean;
  logFile?: string;
  log_file?: string;
}

interface RawStartOpenCodeResult extends Omit<StartOpenCodeResult, 'logFile'> {
  logFile?: string;
  log_file?: string;
}

interface RawSaveOpenCodePasswordResult extends Omit<SaveOpenCodePasswordResult, 'passwordConfigured' | 'configPath'> {
  passwordConfigured?: boolean;
  password_configured?: boolean;
  configPath?: string;
  config_path?: string;
}

interface RawRevealOpenCodePasswordResult extends Omit<RevealOpenCodePasswordResult, 'configPath'> {
  configPath?: string;
  config_path?: string;
}

async function invokeDesktop<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function checkOpenCodeStatus(): Promise<OpenCodeStatus> {
  if (!isDesktop()) {
    throw new Error('桌面环境不可用');
  }

  const status = await invokeDesktop<RawOpenCodeStatus>('check_opencode_status');
  return {
    ...status,
    passwordConfigured: status.passwordConfigured ?? status.password_configured ?? false,
    logFile: status.logFile ?? status.log_file,
  };
}

export async function startOpenCode(): Promise<StartOpenCodeResult> {
  if (!isDesktop()) {
    throw new Error('桌面环境不可用');
  }

  const result = await invokeDesktop<RawStartOpenCodeResult>('start_opencode');
  return {
    ...result,
    logFile: result.logFile ?? result.log_file ?? '',
  };
}

export async function saveOpenCodePassword(password: string): Promise<SaveOpenCodePasswordResult> {
  if (!isDesktop()) {
    throw new Error('桌面环境不可用');
  }

  const result = await invokeDesktop<RawSaveOpenCodePasswordResult>('save_opencode_password', { password });
  return {
    ...result,
    passwordConfigured: result.passwordConfigured ?? result.password_configured ?? false,
    configPath: result.configPath ?? result.config_path ?? '',
  };
}

export async function revealOpenCodePassword(): Promise<RevealOpenCodePasswordResult> {
  if (!isDesktop()) {
    throw new Error('桌面环境不可用');
  }

  const result = await invokeDesktop<RawRevealOpenCodePasswordResult>('reveal_opencode_password');
  return {
    ...result,
    configPath: result.configPath ?? result.config_path ?? '',
  };
}

export async function readOpenCodeLogs(_lines = 200): Promise<ReadOpenCodeLogsResult> {
  if (!isDesktop()) {
    throw new Error('桌面环境不可用');
  }

  return invokeDesktop<ReadOpenCodeLogsResult>('read_opencode_logs', { lines: _lines });
}

export async function startProjectManager(): Promise<StartProjectManagerResult> {
  if (!isDesktop()) {
    throw new Error('桌面环境不可用');
  }

  return invokeDesktop<StartProjectManagerResult>('start_project_manager');
}

export async function openUrl(url: string): Promise<OpenUrlResult> {
  if (!isDesktop()) {
    throw new Error('桌面环境不可用');
  }

  return invokeDesktop<OpenUrlResult>('open_url', { url });
}
