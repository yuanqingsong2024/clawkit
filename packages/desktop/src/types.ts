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

export interface OpenUrlResult {
  opened: boolean;
  message: string;
  detail?: string;
}
