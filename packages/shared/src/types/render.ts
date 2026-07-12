import type {
  Controller,
  Manifest,
  Memory,
  OpenClaw,
  OpenCodeConfig,
  PromptEngine,
  Worker,
} from './manifest';

export const RENDER_TARGETS = [
  'openclaw.json',
  'controller.env',
  'worker.env',
  'systemd.service',
  'opencode.launch.yaml',
] as const;

export type RenderTarget = typeof RENDER_TARGETS[number];

export interface TemplateVariables {
  [key: string]: unknown;
}

export interface RenderBoundary {
  manifest: string[];
  defaults: string[];
  derived: string[];
}

export interface OpenClawJsonTemplateInput {
  profileName: string;
  topology: Manifest['profile']['topology'];
  service: OpenClaw;
  promptEngine: PromptEngine;
  memory: Memory;
  defaults: {
    listenHost: string;
    dataDir: string;
    logLevel: string;
  };
  derived: {
    nodeWorkDir: string;
    controllerEndpoint: string;
  };
}

export interface ControllerEnvTemplateInput {
  profileName: string;
  controller: Controller;
  openClaw: OpenClaw;
  defaults: {
    envFileName: string;
    logLevel: string;
    healthCheckPath: string;
  };
  derived: {
    nodeWorkDir: string;
    publicBaseUrl: string;
    runtimeDataDir: string;
  };
}

export interface WorkerEnvTemplateInput {
  profileName: string;
  worker: Worker;
  controller: Controller;
  openClaw: OpenClaw;
  defaults: {
    envFileName: string;
    logLevel: string;
    heartbeatIntervalSeconds: number;
  };
  derived: {
    nodeWorkDir: string;
    controllerBaseUrl: string;
    workerDataDir: string;
  };
}

export interface SystemdServiceTemplateInput {
  unitName: string;
  description: string;
  defaults: {
    restart: 'always' | 'on-failure';
    restartSecSeconds: number;
    wantedBy: string;
  };
  derived: {
    workingDirectory: string;
    execStart: string;
    environmentFile: string;
  };
}

export interface OpenCodeLaunchTemplateInput {
  profileName: string;
  workerId: string;
  project: {
    key: string;
    repoPath: string;
    baseBranch: string;
    openCode: OpenCodeConfig;
  };
  defaults: {
    configVersion: string;
    logLevel: string;
  };
  derived: {
    workspaceDir: string;
  };
}

export interface RenderInputMap {
  'openclaw.json': OpenClawJsonTemplateInput;
  'controller.env': ControllerEnvTemplateInput;
  'worker.env': WorkerEnvTemplateInput;
  'systemd.service': SystemdServiceTemplateInput;
  'opencode.launch.yaml': OpenCodeLaunchTemplateInput;
}

export interface RenderTargetPlan<TTarget extends RenderTarget = RenderTarget> {
  target: TTarget;
  boundary: RenderBoundary;
  input: RenderInputMap[TTarget];
}

export interface RenderPlan {
  manifest: Manifest;
  targets: RenderTargetPlan[];
}
