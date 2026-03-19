export interface WorkerOpenCodeServerConfig {
  baseUrl?: string;
  username?: string;
  passwordEnv?: string;
}

export interface WorkerOpenCodeConfig {
  server: WorkerOpenCodeServerConfig;
  mode: 'sdk' | 'cli';
  timeoutMs: number;
  fallbackToPlaceholder: boolean;
}

export interface WorkerConfig {
  workerId: string;
  name: string;
  nodeName: string;
  connectMode: 'pull' | 'push';
  tags: string[];
  supportedProjects: string[];
  controllerUrl: string;
  heartbeatIntervalMs: number;
  pollIntervalMs: number;
  manifestPath?: string;
  openCode: WorkerOpenCodeConfig;
}

export function loadWorkerConfig(): WorkerConfig {
  return {
    workerId: process.env.WORKER_ID || 'worker-1',
    name: process.env.WORKER_NAME || 'Worker 1',
    nodeName: process.env.WORKER_NODE_NAME || 'local',
    connectMode: (process.env.WORKER_CONNECT_MODE as 'pull' | 'push') || 'pull',
    tags: process.env.WORKER_TAGS ? process.env.WORKER_TAGS.split(',') : [],
    supportedProjects: process.env.WORKER_SUPPORTED_PROJECTS
      ? process.env.WORKER_SUPPORTED_PROJECTS.split(',')
      : ['*'],
    controllerUrl: process.env.CONTROLLER_URL || 'http://localhost:3000',
    heartbeatIntervalMs: parseInt(process.env.WORKER_HEARTBEAT_INTERVAL_MS || '10000', 10),
    pollIntervalMs: parseInt(process.env.WORKER_POLL_INTERVAL_MS || '5000', 10),
    manifestPath: process.env.CLAWKIT_MANIFEST_PATH,
    openCode: {
      server: {
        baseUrl: process.env.OPENCODE_SERVER_BASE_URL || undefined,
        username: process.env.OPENCODE_SERVER_USERNAME || undefined,
        passwordEnv: process.env.OPENCODE_SERVER_PASSWORD_ENV || 'OPENCODE_SERVER_PASSWORD',
      },
      mode: (process.env.OPENCODE_EXECUTION_MODE as 'sdk' | 'cli') || 'sdk',
      timeoutMs: parseInt(process.env.OPENCODE_TIMEOUT_MS || '300000', 10),
      fallbackToPlaceholder: process.env.WORKER_PLACEHOLDER_FALLBACK === 'true',
    },
  };
}
