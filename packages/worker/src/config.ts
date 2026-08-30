import { z } from 'zod';
import { getEnvString, getEnvNumber, getEnvBoolean, getEnvArray, validateConfig } from '@clawkit/shared';

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
  labels: Record<string, string | boolean>;
  capabilities: string[];
  supportedProjects: string[];
  controllerUrl: string;
  heartbeatIntervalMs: number;
  pollIntervalMs: number;
  maxConcurrentTasks: number;
  executors?: string[];
  cliPaths: Record<string, string>;
  manifestPath?: string;
  openCode: WorkerOpenCodeConfig;
}

const WorkerConfigSchema = z.object({
  workerId: z.string().min(1, 'Worker ID 不能为空'),
  name: z.string().min(1, 'Worker 名称不能为空'),
  nodeName: z.string().min(1, '节点名称不能为空'),
  connectMode: z.enum(['pull', 'push']),
  tags: z.array(z.string()),
  labels: z.record(z.string(), z.union([z.string(), z.boolean()])).default({}),
  capabilities: z.array(z.string()).default([]),
  supportedProjects: z.array(z.string()).min(1, '至少需要支持一个项目'),
  controllerUrl: z.string().url('Controller URL 格式无效'),
  heartbeatIntervalMs: z.number().int().min(1000, '心跳间隔至少 1 秒'),
  pollIntervalMs: z.number().int().min(1000, '轮询间隔至少 1 秒'),
  maxConcurrentTasks: z.number().int().min(1).max(100, '并发任务数不能超过 100'),
  executors: z.array(z.string()).optional(),
  cliPaths: z.record(z.string(), z.string()).default({}),
  manifestPath: z.string().optional(),
  openCode: z.object({
    server: z.object({
      baseUrl: z.string().optional(),
      username: z.string().optional(),
      passwordEnv: z.string().optional(),
    }),
    mode: z.enum(['sdk', 'cli']),
    timeoutMs: z.number().int().min(1000, '超时时间至少 1 秒'),
    fallbackToPlaceholder: z.boolean(),
  }),
});

export function loadWorkerConfig(): WorkerConfig {
  const rawConfig = {
    workerId: getEnvString('WORKER_ID', 'worker-1'),
    name: getEnvString('WORKER_NAME', 'Worker 1'),
    nodeName: getEnvString('WORKER_NODE_NAME', 'local'),
    connectMode: getEnvString('WORKER_CONNECT_MODE', 'pull') as 'pull' | 'push',
    tags: getEnvArray('WORKER_TAGS', ',', []),
    labels: parseWorkerLabels(getEnvString('WORKER_LABELS_JSON', '') ?? ''),
    capabilities: getEnvArray('WORKER_CAPABILITIES', ',', []),
    supportedProjects: getEnvArray('WORKER_SUPPORTED_PROJECTS', ',', ['*']),
    controllerUrl: getEnvString('CONTROLLER_URL', 'http://localhost:8787'),
    heartbeatIntervalMs: getEnvNumber('WORKER_HEARTBEAT_INTERVAL_MS', 10000),
    pollIntervalMs: getEnvNumber('WORKER_POLL_INTERVAL_MS', 5000),
    maxConcurrentTasks: getEnvNumber('WORKER_MAX_CONCURRENT_TASKS', 3),
    executors: getEnvArray('WORKER_EXECUTORS', ',', []),
    cliPaths: {},
    manifestPath: getEnvString('CLAWKIT_MANIFEST_PATH'),
    openCode: {
      server: {
        baseUrl: getEnvString('OPENCODE_SERVER_BASE_URL'),
        username: getEnvString('OPENCODE_SERVER_USERNAME'),
        passwordEnv: getEnvString('OPENCODE_SERVER_PASSWORD_ENV', 'OPENCODE_SERVER_PASSWORD'),
      },
      mode: getEnvString('OPENCODE_EXECUTION_MODE', 'sdk') as 'sdk' | 'cli',
      timeoutMs: getEnvNumber('OPENCODE_TIMEOUT_MS', 300000),
      fallbackToPlaceholder: getEnvBoolean('WORKER_PLACEHOLDER_FALLBACK', false),
    },
  };

  return validateConfig(WorkerConfigSchema, rawConfig, 'Worker');
}

function parseWorkerLabels(raw: string): Record<string, string | boolean> {
  if (!raw.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string | boolean>;
    }
  } catch {
    return {};
  }

  return {};
}
