export interface QuickSetupProfile {
  name: string;
  mode: 'all-in-one' | 'hybrid';
  project: {
    key: string;
    repoPath: string;
  };
  openclaw: {
    publicUrl: string;
    deployMode: 'local' | 'external' | 'skip';
  };
  promptEngine: {
    mode: 'template' | 'llm' | 'hybrid';
    provider?: 'openai' | 'anthropic' | 'custom';
    baseUrl?: string;
    apiKeyEnv?: string;
    model?: string;
  };
  worker: {
    id: string;
    opencodePort: number;
  };
  remote?: {
    host: string;
    user: string;
    keyPath: string;
    workDir: string;
  };
}
