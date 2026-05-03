export type SetupInputMode = 'quick' | 'yaml';

export interface QuickSetupFormState {
  name: string;
  mode: 'all-in-one' | 'hybrid';
  projectKey: string;
  repoPath: string;
  publicUrl: string;
  /**
   * OpenClaw 部署方式：本地自动部署 / 使用外部服务 / 暂时跳过。
   * 用于生成 manifest 的 openclaw.deployMode 字段。
   */
  openClawDeployMode: 'local' | 'external' | 'skip';
  promptEngineMode: 'template' | 'llm' | 'hybrid';
  modelProvider: 'openai' | 'anthropic' | 'custom';
  modelBaseUrl: string;
  modelApiKeyEnv: string;
  modelApiKey: string;
  defaultModel: string;
  workerId: string;
  opencodePort: string;
  remoteHost: string;
  remoteUser: string;
  remoteKeyPath: string;
  remoteWorkDir: string;
}

export interface ValidationIssue {
  key: string;
  message: string;
}
