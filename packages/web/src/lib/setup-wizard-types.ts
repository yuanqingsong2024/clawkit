export type SetupInputMode = 'quick' | 'yaml';

export interface QuickSetupFormState {
  name: string;
  mode: 'all-in-one' | 'hybrid';
  projectKey: string;
  repoPath: string;
  publicUrl: string;
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
