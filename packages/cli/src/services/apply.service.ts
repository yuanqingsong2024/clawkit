import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import type { Manifest, Node, SshNode, Worker } from '@clawkit/shared';

import { ManifestLoader } from './manifest-loader';

export interface ApplyOptions {
  dryRun?: boolean;
  onlyLocal?: boolean;
}

export interface ApplyFilePlan {
  nodeName: string;
  nodeType: Node['type'];
  sshNode?: SshNode;
  targetPath: string;
  description: string;
  content: string;
}

export interface ApplyResult {
  manifestPath: string;
  dryRun: boolean;
  generatedFiles: string[];
  backupFiles: string[];
  skippedFiles: string[];
  notes: string[];
  filePlans: ApplyFilePlan[];
}

interface LoadedApplyContext {
  manifest: Manifest;
  manifestPath: string;
  manifestDir: string;
}

export class ApplyService {
  private readonly loader = new ManifestLoader();

  createPlan(filePath: string, options: ApplyOptions = {}): ApplyResult {
    const context = this.loader.load(filePath);
    const filePlans = this.buildFilePlans(context, options.onlyLocal ?? false);
    const notes = this.buildNotes(context.manifest, context.manifestPath, filePlans);

    return {
      manifestPath: context.manifestPath,
      dryRun: options.dryRun ?? true,
      generatedFiles: [],
      backupFiles: [],
      skippedFiles: [],
      notes,
      filePlans,
    };
  }

  apply(filePath: string, options: ApplyOptions = {}): ApplyResult {
    const plan = this.createPlan(filePath, options);

    if (options.dryRun) {
      return plan;
    }

    const generatedFiles: string[] = [];
    const backupFiles: string[] = [];
    const skippedFiles: string[] = [];

    for (const filePlan of plan.filePlans) {
      if (options.onlyLocal && filePlan.nodeType !== 'local') {
        skippedFiles.push(`${filePlan.targetPath}（仅本地修复模式跳过）`);
        continue;
      }

      if (filePlan.nodeType === 'local') {
        const backup = this.writeLocalFile(filePlan.targetPath, filePlan.content);
        if (backup) {
          backupFiles.push(backup);
        }
        generatedFiles.push(filePlan.targetPath);
        continue;
      }

      const backup = this.writeRemoteFile(filePlan);
      if (backup) {
        backupFiles.push(backup);
      }
      generatedFiles.push(filePlan.targetPath);
    }

    return {
      ...plan,
      dryRun: false,
      generatedFiles,
      backupFiles,
      skippedFiles,
    };
  }

  private buildFilePlans(context: LoadedApplyContext, onlyLocal: boolean): ApplyFilePlan[] {
    const plans: ApplyFilePlan[] = [];
    const touchedNodes = new Set<string>();

    plans.push(...this.buildControllerPlans(context));
    plans.push(...this.buildOpenClawPlans(context));

    for (const worker of context.manifest.workers) {
      plans.push(...this.buildWorkerPlans(context, worker));
      touchedNodes.add(worker.node);
    }

    touchedNodes.add(context.manifest.services.controller.node);
    touchedNodes.add(context.manifest.services.openClaw.node);

    for (const nodeName of touchedNodes) {
      const node = context.manifest.nodes[nodeName];
      if (!node) {
        continue;
      }

      if (onlyLocal && node.type !== 'local') {
        continue;
      }

      plans.push({
        nodeName,
        nodeType: node.type,
        sshNode: node.type === 'ssh' ? node : undefined,
        targetPath: this.resolveNodeFilePath(context, nodeName, 'clawkit.yaml', false),
        description: '节点本地 manifest 副本',
        content: fs.readFileSync(context.manifestPath, 'utf8'),
      });
    }

    return plans;
  }

  private buildControllerPlans(context: LoadedApplyContext): ApplyFilePlan[] {
    const nodeName = context.manifest.services.controller.node;
    const node = context.manifest.nodes[nodeName];
    const envFile = this.resolveNodeFilePath(context, nodeName, 'controller.env', false);
    const serviceFile = this.resolveNodeFilePath(context, nodeName, 'systemd/clawkit-controller.service', false);
    const startScript = this.resolveNodeFilePath(context, nodeName, 'scripts/start-controller.sh', false);
    const controllerEnv = this.renderControllerEnv(context.manifest, context.manifestPath, nodeName);

    return [
      {
        nodeName,
        nodeType: node.type,
        sshNode: node.type === 'ssh' ? node : undefined,
        targetPath: envFile,
        description: 'Controller 环境变量文件',
        content: controllerEnv,
      },
      {
        nodeName,
        nodeType: node.type,
        sshNode: node.type === 'ssh' ? node : undefined,
        targetPath: serviceFile,
        description: 'Controller systemd service 文件',
        content: this.renderSystemdService({
          description: 'ClawKit Controller',
          workingDirectory: this.resolveRuntimeDirectory(context.manifest, nodeName),
          execStart: this.resolveExecStart('controller'),
          environmentFile: envFile,
        }),
      },
      {
        nodeName,
        nodeType: node.type,
        sshNode: node.type === 'ssh' ? node : undefined,
        targetPath: startScript,
        description: 'Controller 本地启动脚本',
        content: this.renderStartScript(envFile, this.resolveExecStart('controller')),
      },
    ];
  }

  private buildOpenClawPlans(context: LoadedApplyContext): ApplyFilePlan[] {
    const nodeName = context.manifest.services.openClaw.node;
    const node = context.manifest.nodes[nodeName];
    const openClawPath = this.resolveOpenClawConfigPath(node.type === 'local');

    return [
      {
        nodeName,
        nodeType: node.type,
        sshNode: node.type === 'ssh' ? node : undefined,
        targetPath: openClawPath,
        description: 'OpenClaw webhook 配置文件',
        content: this.renderOpenClawJson(context.manifest),
      },
    ];
  }

  private buildWorkerPlans(context: LoadedApplyContext, worker: Worker): ApplyFilePlan[] {
    const node = context.manifest.nodes[worker.node];
    const envFile = this.resolveNodeFilePath(context, worker.node, `worker-${worker.id}.env`, false);
    const serviceFile = this.resolveNodeFilePath(context, worker.node, `systemd/clawkit-worker-${worker.id}.service`, false);
    const startScript = this.resolveNodeFilePath(context, worker.node, `scripts/start-worker-${worker.id}.sh`, false);
    const plans: ApplyFilePlan[] = [
      {
        nodeName: worker.node,
        nodeType: node.type,
        sshNode: node.type === 'ssh' ? node : undefined,
        targetPath: envFile,
        description: `Worker ${worker.id} 环境变量文件`,
        content: this.renderWorkerEnv(context.manifest, context.manifestPath, worker),
      },
      {
        nodeName: worker.node,
        nodeType: node.type,
        sshNode: node.type === 'ssh' ? node : undefined,
        targetPath: serviceFile,
        description: `Worker ${worker.id} systemd service 文件`,
        content: this.renderSystemdService({
          description: `ClawKit Worker ${worker.id}`,
          workingDirectory: this.resolveRuntimeDirectory(context.manifest, worker.node),
          execStart: this.resolveExecStart('worker'),
          environmentFile: envFile,
        }),
      },
      {
        nodeName: worker.node,
        nodeType: node.type,
        sshNode: node.type === 'ssh' ? node : undefined,
        targetPath: startScript,
        description: `Worker ${worker.id} 本地启动脚本`,
        content: this.renderStartScript(envFile, this.resolveExecStart('worker')),
      },
    ];

    for (const project of worker.projects) {
      plans.push({
        nodeName: worker.node,
        nodeType: node.type,
        sshNode: node.type === 'ssh' ? node : undefined,
        targetPath: this.resolveNodeFilePath(context, worker.node, `opencode-${project.key}.launch.yaml`, false),
        description: `项目 ${project.key} 的 OpenCode 启动配置`,
        content: this.renderOpenCodeLaunch(worker.id, project.key, project.repoPath, project.baseBranch, project.openCode.port, project.openCode.agent),
      });
    }

    return plans;
  }

  private renderControllerEnv(manifest: Manifest, manifestPath: string, nodeName: string): string {
    const token = manifest.services.openClaw.apiKey?.trim() || '__CHANGE_ME_OPENCLAW_TOKEN__';
    return [
      `CLAWKIT_PROFILE_NAME=${manifest.profile.name}`,
      `CLAWKIT_MANIFEST_PATH=${this.resolveManifestRuntimePath(manifest, manifestPath, nodeName)}`,
      'CONTROLLER_HOST=0.0.0.0',
      `CONTROLLER_PORT=${manifest.services.controller.port}`,
      `OPENCLAW_WEBHOOK_TOKEN=${token}`,
      `CONTROLLER_PUBLIC_URL=${manifest.services.openClaw.publicUrl}`,
      '',
    ].join('\n');
  }

  private renderWorkerEnv(manifest: Manifest, manifestPath: string, worker: Worker): string {
    return [
      `CLAWKIT_PROFILE_NAME=${manifest.profile.name}`,
      `CLAWKIT_MANIFEST_PATH=${this.resolveManifestRuntimePath(manifest, manifestPath, worker.node)}`,
      `WORKER_ID=${worker.id}`,
      `WORKER_NAME=${worker.id}`,
      `WORKER_NODE_NAME=${worker.node}`,
      `WORKER_CONNECT_MODE=${worker.connectMode}`,
      `WORKER_TAGS=${worker.tags.join(',')}`,
      `WORKER_SUPPORTED_PROJECTS=${worker.projects.map((project) => project.key).join(',')}`,
      `CONTROLLER_URL=${this.deriveControllerBaseUrl(manifest, worker.node)}`,
      'WORKER_HEARTBEAT_INTERVAL_MS=10000',
      'WORKER_POLL_INTERVAL_MS=5000',
      'OPENCODE_EXECUTION_MODE=sdk',
      'OPENCODE_SERVER_PASSWORD_ENV=OPENCODE_SERVER_PASSWORD',
      'WORKER_PLACEHOLDER_FALLBACK=false',
      '',
    ].join('\n');
  }

  private renderOpenClawJson(manifest: Manifest): string {
    const data = {
      name: manifest.profile.name,
      topology: manifest.profile.topology,
      controller: {
        endpoint: `${manifest.services.openClaw.publicUrl}${manifest.services.controller.apiPrefix}/openclaw/webhook`,
        token: manifest.services.openClaw.apiKey?.trim() || '__CHANGE_ME_OPENCLAW_TOKEN__',
      },
      runtime: {
        promptEngine: manifest.runtime.promptEngine,
        memory: manifest.runtime.memory,
      },
      webhook: {
        enabled: true,
        source: 'openclaw',
      },
    };

    return `${JSON.stringify(data, null, 2)}\n`;
  }

  private renderSystemdService(input: {
    description: string;
    workingDirectory: string;
    execStart: string;
    environmentFile: string;
  }): string {
    return [
      '[Unit]',
      `Description=${input.description}`,
      'After=network.target',
      '',
      '[Service]',
      'Type=simple',
      `WorkingDirectory=${input.workingDirectory}`,
      `EnvironmentFile=${input.environmentFile}`,
      `ExecStart=${input.execStart}`,
      'Restart=on-failure',
      'RestartSec=5',
      '',
      '[Install]',
      'WantedBy=multi-user.target',
      '',
    ].join('\n');
  }

  private renderStartScript(environmentFile: string, execStart: string): string {
    return [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      `source "${environmentFile}"`,
      execStart,
      '',
    ].join('\n');
  }

  private renderOpenCodeLaunch(
    workerId: string,
    projectKey: string,
    repoPath: string,
    baseBranch: string,
    port: number,
    agent: string,
  ): string {
    return [
      'version: "1"',
      `workerId: "${workerId}"`,
      `projectKey: "${projectKey}"`,
      `repoPath: "${repoPath}"`,
      `baseBranch: "${baseBranch}"`,
      'openCode:',
      `  port: ${port}`,
      `  agent: "${agent}"`,
      '',
    ].join('\n');
  }

  private resolveNodeFilePath(
    context: LoadedApplyContext,
    nodeName: string,
    relativeFilePath: string,
    useHomeDir: boolean,
  ): string {
    const node = context.manifest.nodes[nodeName];
    if (node.type === 'local') {
      if (useHomeDir) {
        return path.join(os.homedir(), relativeFilePath);
      }

      const workDir = node.workDir ? path.resolve(context.manifestDir, node.workDir) : context.manifestDir;
      return path.join(workDir, relativeFilePath);
    }

    if (useHomeDir) {
      return `~/${relativeFilePath}`;
    }

    return path.posix.join(node.workDir, relativeFilePath.replace(/\\/g, '/'));
  }

  private resolveOpenClawConfigPath(isLocal: boolean): string {
    return isLocal
      ? path.join(os.homedir(), '.openclaw', 'openclaw.json')
      : '~/.openclaw/openclaw.json';
  }

  private resolveManifestRuntimePath(manifest: Manifest, manifestPath: string, nodeName: string): string {
    const node = manifest.nodes[nodeName];
    if (node.type === 'local') {
      return this.resolveNodeFilePath({ manifest, manifestPath, manifestDir: path.dirname(manifestPath) }, nodeName, 'clawkit.yaml', false);
    }

    return path.posix.join(node.workDir, 'clawkit.yaml');
  }

  private resolveRuntimeDirectory(manifest: Manifest, nodeName: string): string {
    const node = manifest.nodes[nodeName];
    if (node.type === 'local') {
      return process.cwd();
    }

    return node.workDir;
  }

  private resolveExecStart(role: 'controller' | 'worker'): string {
    const repoRoot = process.cwd();
    const target = role === 'controller'
      ? 'packages/controller/dist/index.js'
      : 'packages/worker/dist/index.js';
    return `node ${path.join(repoRoot, target)}`;
  }

  private deriveControllerBaseUrl(manifest: Manifest, workerNodeName: string): string {
    const controllerNode = manifest.nodes[manifest.services.controller.node];
    const workerNode = manifest.nodes[workerNodeName];

    if (controllerNode.type === 'local' && workerNode.type === 'local') {
      return `http://127.0.0.1:${manifest.services.controller.port}`;
    }

    return manifest.services.openClaw.publicUrl;
  }

  private writeLocalFile(targetPath: string, content: string): string | undefined {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    let backupPath: string | undefined;

    if (fs.existsSync(targetPath)) {
      backupPath = `${targetPath}.${this.buildTimestamp()}.bak`;
      fs.copyFileSync(targetPath, backupPath);
    }

    fs.writeFileSync(targetPath, content, 'utf8');
    if (targetPath.endsWith('.sh')) {
      fs.chmodSync(targetPath, 0o755);
    }

    return backupPath;
  }

  private writeRemoteFile(filePlan: ApplyFilePlan): string | undefined {
    const node = filePlan.sshNode;
    if (!node) {
      throw new Error(`节点 ${filePlan.nodeName} 缺少 SSH 配置，无法执行远程写入`);
    }

    if (!node.keyPath && !process.env.SSH_AUTH_SOCK) {
      throw new Error(`节点 ${filePlan.nodeName} 当前仅支持免密 SSH 或私钥写入，请先配置 keyPath 或 ssh-agent`);
    }

    const targetPath = filePlan.targetPath;
    const directory = targetPath.startsWith('~/')
      ? targetPath.replace(/\/[^/]+$/, '')
      : path.posix.dirname(targetPath);
    const backupPath = `${targetPath}.${this.buildTimestamp()}.bak`;
    const escapedTarget = this.escapeShell(targetPath);
    const escapedDirectory = this.escapeShell(directory);
    const escapedBackup = this.escapeShell(backupPath);
    const command = [
      `mkdir -p ${escapedDirectory}`,
      `if [ -f ${escapedTarget} ]; then cp ${escapedTarget} ${escapedBackup}; fi`,
      `cat > ${escapedTarget}`,
    ].join(' && ');

    const result = spawnSync('ssh', [...this.buildSshArgs(node), command], {
      encoding: 'utf8',
      input: filePlan.content,
    });

    if (result.status !== 0) {
      const message = result.stderr.trim() || result.stdout.trim() || '未知 SSH 错误';
      throw new Error(`远程写入失败（${node.host}）：${message}`);
    }

    return backupPath;
  }

  private buildSshArgs(node: SshNode): string[] {
    const args = ['-p', String(node.port)];
    if (node.keyPath) {
      args.push('-i', node.keyPath.replace(/^~\//, `${os.homedir()}/`));
    }
    args.push(`${node.user}@${node.host}`);
    return args;
  }

  private escapeShell(value: string): string {
    return `'${value.replace(/'/g, `'"'"'`)}'`;
  }

  private buildTimestamp(): string {
    const now = new Date();
    const pad = (value: number): string => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  private buildNotes(manifest: Manifest, manifestPath: string, filePlans: ApplyFilePlan[]): string[] {
    const notes = [
      `已读取 manifest：${manifestPath}`,
      `建议先执行 pnpm --filter @clawkit/controller build && pnpm --filter @clawkit/worker build`,
      `Controller 启动建议：node ${path.join(process.cwd(), 'packages/controller/dist/index.js')}`,
      `Worker 启动建议：node ${path.join(process.cwd(), 'packages/worker/dist/index.js')}`,
    ];

    if (!manifest.services.openClaw.apiKey) {
      notes.push('OpenClaw webhook token 未在 manifest.services.openClaw.apiKey 中配置，已写入占位值，请尽快替换。');
    }

    if (filePlans.some((item) => item.nodeType === 'ssh')) {
      notes.push('当前阶段的 SSH 写入仅覆盖最小文件下发，不负责远程代码同步与 systemd 安装。');
    }

    return notes;
  }
}
