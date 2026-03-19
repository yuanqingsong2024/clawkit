export interface QuickSetupProfile {
  name: string;
  mode: 'all-in-one' | 'hybrid';
  project: {
    key: string;
    repoPath: string;
  };
  openclaw: {
    publicUrl: string;
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
