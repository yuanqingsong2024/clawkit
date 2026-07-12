import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import type { Manifest, Node, SshNode, Worker } from '@clawkit/shared';

import { ManifestLoader } from './manifest-loader';
import { Logger } from '../utils/logger';

export interface ApplyOptions {
  dryRun?: boolean;
  onlyLocal?: boolean;
  deploy?: boolean;
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

  /**
   * 渲染 OpenClaw 本地部署所需的 docker-compose.yml 内容
   *
   * 注意：该文件由 clawkit 自动生成，用于最小可用的本地 OpenClaw Gateway 启动。
   * @param manifest 当前生效的 manifest
   * @returns docker-compose.yml 文本（以换行结尾）
   */
  private renderDockerCompose(manifest: Manifest): string {
    const port = this.resolveOpenClawLocalPort(manifest);
    return [
      '# OpenClaw Docker Compose 配置',
      '# 由 clawkit 自动生成，请勿手动编辑',
      '',
      'services:',
      '  openclaw-gateway:',
      '    image: ${OPENCLAW_IMAGE:-ghcr.io/openclaw/openclaw:latest}',
      '    container_name: openclaw-gateway',
      '    ports:',
      `      - "${port}:${port}"`,
      '    volumes:',
      '      - ~/.openclaw:/home/node/.openclaw',
      '      - ~/.openclaw/workspace:/home/node/.openclaw/workspace',
      '    environment:',
      `      - OPENCLAW_GATEWAY_PORT=${port}`,
      '      - OPENCLAW_GATEWAY_BIND=lan',
      '      - OPENCLAW_HOME_VOLUME=/home/node/.openclaw',
      '    healthcheck:',
      `      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:${port}/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]`,
      '      interval: 30s',
      '      timeout: 10s',
      '      start_period: 15s',
      '      retries: 3',
      '    restart: unless-stopped',
      '',
    ].join('\n');
  }

  createPlan(filePath: string, options: ApplyOptions = {}): ApplyResult {
    const context = this.loader.load(filePath);
    const filePlans = this.buildFilePlans(context, options.onlyLocal ?? false);

    if (context.manifest.services.openClaw.deployMode === 'local') {
      filePlans.push({
        nodeName: context.manifest.services.openClaw.node,
        // docker-compose.yml 仅用于本机 HOME 目录写入，因此强制按本地文件处理
        nodeType: 'local',
        targetPath: path.join(os.homedir(), '.openclaw', 'docker-compose.yml'),
        description: 'OpenClaw 本地部署 docker-compose 配置',
        content: this.renderDockerCompose(context.manifest),
      });
    }
    if (context.manifest.services.openCode?.installMode === 'local') {
      filePlans.push({
        nodeName: context.manifest.services.openCode.node,
        // OpenCode local 模式固定安装到当前用户 HOME，因此按本地文件处理
        nodeType: 'local',
        targetPath: path.join(os.homedir(), '.opencode', 'start-opencode.sh'),
        description: 'OpenCode 本地启动脚本',
        content: this.renderOpenCodeStartScript(context.manifest),
      });
    }
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

    // 如果指定了 --deploy，执行真实部署
    if (options.deploy) {
      const context = this.loader.load(filePath);
      this.executeDeployment(context.manifest);
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
      // 只为配置了独立端口的项目生成启动配置
      if (project.openCode.port) {
        plans.push({
          nodeName: worker.node,
          nodeType: node.type,
          sshNode: node.type === 'ssh' ? node : undefined,
          targetPath: this.resolveNodeFilePath(context, worker.node, `opencode-${project.key}.launch.yaml`, false),
          description: `项目 ${project.key} 的 OpenCode 启动配置`,
          content: this.renderOpenCodeLaunch(worker.id, project.key, project.repoPath, project.baseBranch, project.openCode.port, project.openCode.agent),
        });
      }
    }

    return plans;
  }

  private renderControllerEnv(manifest: Manifest, manifestPath: string, nodeName: string): string {
    const token = manifest.services.openClaw.apiKey?.trim() || this.generateWebhookToken();
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

  /**
   * 生成安全的 webhook token（64 字符十六进制）
   */
  private generateWebhookToken(): string {
    return randomBytes(32).toString('hex');
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
    // OpenClaw 2026.5.7+ 不再支持通过配置文件配置 webhooks
    // webhook 配置需要在 OpenClaw UI 中手动完成
    // 这里只生成基础配置，让 OpenClaw 自动初始化
    const port = this.resolveOpenClawLocalPort(manifest);
    const config = {
      gateway: {
        controlUi: {
          allowedOrigins: [
            `http://localhost:${port}`,
            `http://127.0.0.1:${port}`,
          ],
        },
      },
    };

    return `${JSON.stringify(config, null, 2)}\n`;
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

  private renderOpenCodeStartScript(manifest: Manifest): string {
    const openCodeService = manifest.services.openCode;
    const port = this.resolveOpenCodeLocalPort(manifest);
    const binaryPath = openCodeService?.binaryPath || path.join(os.homedir(), '.opencode', 'bin', 'opencode');
    const workspace = openCodeService?.workspace || os.homedir();
    const logFile = path.join(os.homedir(), '.opencode', 'opencode.log');
    const pidFile = path.join(os.homedir(), '.opencode', 'opencode.pid');
    const extraEnv = openCodeService?.env
      ? Object.entries(openCodeService.env).map(([key, value]) => `export ${key}=${this.escapeShell(value)}`)
      : [];

    return [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      '',
      `OPENCODE_BIN=${this.escapeShell(binaryPath)}`,
      `OPENCODE_WORKSPACE=${this.escapeShell(workspace)}`,
      `OPENCODE_LOG=${this.escapeShell(logFile)}`,
      `OPENCODE_PID=${this.escapeShell(pidFile)}`,
      `OPENCODE_PORT=${port}`,
      ...extraEnv,
      '',
      'mkdir -p "$(dirname "$OPENCODE_LOG")" "$OPENCODE_WORKSPACE"',
      '',
      'if [ -f "$OPENCODE_PID" ] && kill -0 "$(cat "$OPENCODE_PID")" 2>/dev/null; then',
      '  echo "OpenCode 已在运行，PID: $(cat "$OPENCODE_PID")"',
      '  exit 0',
      'fi',
      '',
      'nohup "$OPENCODE_BIN" serve --hostname 127.0.0.1 --port "$OPENCODE_PORT" > "$OPENCODE_LOG" 2>&1 &',
      'echo $! > "$OPENCODE_PID"',
      'echo "OpenCode 已启动，PID: $(cat "$OPENCODE_PID")，日志: $OPENCODE_LOG"',
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

  private resolveOpenClawLocalPort(manifest: Manifest): number {
    try {
      const url = new URL(manifest.services.openClaw.publicUrl);
      const parsed = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
      return Number.isInteger(parsed) && parsed > 0 ? parsed : 18000;
    } catch {
      return 18000;
    }
  }

  private resolveOpenCodeLocalPort(manifest: Manifest): number {
    const ports = manifest.workers
      .flatMap((worker) => worker.projects.map((project) => project.openCode.port))
      .filter((port): port is number => typeof port === 'number' && port > 0);

    if (ports.length === 0) {
      return 4096;
    }

    return Math.min(...ports);
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
      '如果这是简化配置转换后的结果，当前展示的是内部展开后的完整部署文件。',
      `建议先执行 pnpm --filter @clawkit/controller build && pnpm --filter @clawkit/worker build`,
      '推荐启动方式：clawkit start 或 pnpm quickstart',
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

  /**
   * 执行真实部署（OpenClaw + OpenCode）
   */
  private executeDeployment(manifest: Manifest): void {
    Logger.divider();
    Logger.title('开始执行真实部署');

    // 部署 OpenClaw
    if (manifest.services.openClaw.deployMode === 'local') {
      try {
        this.deployOpenClaw(manifest);
      } catch (error) {
        Logger.warn(`OpenClaw 部署失败（非阻塞）：${(error as Error).message}`);
        Logger.warn('可以稍后手动部署 OpenClaw，不影响 Controller/Worker 运行');
      }
    } else {
      Logger.info(`OpenClaw deployMode=${manifest.services.openClaw.deployMode}，跳过自动部署`);
    }

    // 安装并启动 OpenCode
    if (manifest.services.openCode && manifest.services.openCode.installMode === 'local') {
      try {
        this.installAndStartOpenCode(manifest);
      } catch (error) {
        Logger.warn(`OpenCode 安装失败（非阻塞）：${(error as Error).message}`);
        Logger.warn('可以稍后手动安装 OpenCode，任务执行会退化为 placeholder 模式');
      }
    } else if (manifest.services.openCode) {
      Logger.info(`OpenCode installMode=${manifest.services.openCode.installMode}，跳过自动安装`);
    }

    Logger.divider();
    Logger.success('部署执行完成');
  }

  /**
   * 部署 OpenClaw（local 模式）
   */
  private deployOpenClaw(manifest: Manifest): void {
    Logger.info('正在部署 OpenClaw...');
    const port = this.resolveOpenClawLocalPort(manifest);

    const composeDir = path.join(os.homedir(), '.openclaw');
    const composePath = path.join(composeDir, 'docker-compose.yml');

    // 检查 docker-compose.yml 是否存在
    if (!fs.existsSync(composePath)) {
      throw new Error(`docker-compose.yml 不存在：${composePath}，请先执行 apply 生成配置文件`);
    }

    // 检查 Docker 是否可用
    const dockerCheck = spawnSync('docker', ['--version'], { encoding: 'utf8' });
    if (dockerCheck.status !== 0) {
      throw new Error('Docker 不可用，请先安装 Docker');
    }

    // 检查 Docker Compose V2
    const composeCheck = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' });
    if (composeCheck.status !== 0) {
      throw new Error('Docker Compose V2 不可用，请升级 Docker');
    }

    Logger.info('执行 docker compose up -d...');

    // 执行 docker compose up
    const result = spawnSync('docker', ['compose', 'up', '-d'], {
      cwd: composeDir,
      encoding: 'utf8',
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      throw new Error('docker compose up 执行失败');
    }

    Logger.success('OpenClaw 容器已启动');

    // 等待健康检查
    Logger.info('等待 OpenClaw 健康检查...');
    const healthy = this.waitForHealthCheck(`http://127.0.0.1:${port}/healthz`, 60000);

    if (healthy) {
      Logger.success('OpenClaw 健康检查通过');
      Logger.info('');
      Logger.info(`下一步：请访问 http://127.0.0.1:${port} 完成 OpenClaw onboarding`);
      Logger.info('  1. 创建账号');
      Logger.info('  2. 配置 webhook: http://127.0.0.1:8787/api/openclaw/webhook');
      Logger.info('  3. 生成并配置 token');
      Logger.info('  4. 更新 manifest 中的 apiKey');
      Logger.info('  5. 重启 controller');
    } else {
      Logger.warn('OpenClaw 健康检查超时（60s），但容器可能仍在启动中');
      Logger.info('可以手动检查：docker logs -f openclaw-gateway');
    }
  }

  /**
   * 安装并启动 OpenCode（local 模式）
   */
  private installAndStartOpenCode(manifest: Manifest): void {
    Logger.info('正在检查 OpenCode 安装状态...');

    const port = this.resolveOpenCodeLocalPort(manifest);
    const healthUrl = `http://127.0.0.1:${port}/global/health`;
    const opencodeBin = path.join(os.homedir(), '.opencode', 'bin', 'opencode');
    const opencodeDir = path.join(os.homedir(), '.opencode');
    const startScript = path.join(opencodeDir, 'start-opencode.sh');
    const logFile = path.join(opencodeDir, 'opencode.log');
    const pidFile = path.join(opencodeDir, 'opencode.pid');

    // 检查是否已安装
    if (fs.existsSync(opencodeBin)) {
      Logger.info('OpenCode 已安装，跳过安装步骤');
    } else {
      Logger.info('正在安装 OpenCode...');
      this.installOpenCode();
    }

    // 检查是否已在运行
    if (this.isOpenCodeRunning(pidFile)) {
      Logger.info('OpenCode 已在运行，跳过启动步骤');
      
      // 验证健康检查
      const healthy = this.waitForHealthCheck(healthUrl, 5000);
      if (healthy) {
        Logger.success('OpenCode 健康检查通过');
        return;
      } else {
        Logger.warn('OpenCode 进程存在但健康检查失败，尝试重启...');
        this.stopOpenCode(pidFile);
      }
    }

    // 启动 OpenCode
    Logger.info('正在启动 OpenCode...');
    this.startOpenCode(startScript, logFile, pidFile);

    // 等待健康检查
    Logger.info('等待 OpenCode 健康检查...');
    const healthy = this.waitForHealthCheck(healthUrl, 60000);

    if (healthy) {
      Logger.success('OpenCode 已成功启动并通过健康检查');
      Logger.info(`日志文件：${logFile}`);
      Logger.info(`PID 文件：${pidFile}`);
    } else {
      throw new Error('OpenCode 健康检查超时（60s），请查看日志：' + logFile);
    }
  }

  /**
   * 执行 OpenCode 安装脚本
   */
  private installOpenCode(): void {
    const result = spawnSync('bash', ['-c', 'curl -fsSL https://opencode.ai/install | bash'], {
      encoding: 'utf8',
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      throw new Error('OpenCode 安装脚本执行失败');
    }

    Logger.success('OpenCode 安装完成');
  }

  /**
   * 启动 OpenCode 服务
   */
  private startOpenCode(startScript: string, logFile: string, pidFile: string): void {
    if (!fs.existsSync(startScript)) {
      throw new Error(`启动脚本不存在：${startScript}，请先执行 apply 生成配置文件`);
    }

    // 确保日志目录存在
    fs.mkdirSync(path.dirname(logFile), { recursive: true });

    // 启动脚本内部负责后台启动服务并写入真实服务 PID。
    const result = spawnSync('bash', [startScript], {
      encoding: 'utf8',
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      throw new Error('OpenCode 启动脚本执行失败');
    }

    const pid = fs.existsSync(pidFile) ? fs.readFileSync(pidFile, 'utf8').trim() : '未知';
    Logger.info(`OpenCode 已在后台启动 (PID: ${pid})`);
  }

  /**
   * 检查 OpenCode 是否正在运行
   */
  private isOpenCodeRunning(pidFile: string): boolean {
    if (!fs.existsSync(pidFile)) {
      return false;
    }

    try {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
      if (isNaN(pid)) {
        return false;
      }

      // 检查进程是否存在
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 停止 OpenCode 服务
   */
  private stopOpenCode(pidFile: string): void {
    if (!fs.existsSync(pidFile)) {
      return;
    }

    try {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
      if (!isNaN(pid)) {
        process.kill(pid, 'SIGTERM');
        Logger.info(`已发送停止信号到 OpenCode 进程 (PID: ${pid})`);
      }
    } catch (error) {
      Logger.warn(`停止 OpenCode 失败：${(error as Error).message}`);
    }
  }

  /**
   * 等待健康检查通过
   */
  private waitForHealthCheck(url: string, timeoutMs: number): boolean {
    const startTime = Date.now();
    const interval = 2000; // 每 2 秒检查一次
    const maxAttempts = Math.ceil(timeoutMs / interval);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (this.checkHealth(url)) {
        return true;
      }

      // 等待下一次检查
      const elapsed = Date.now() - startTime;
      if (elapsed < timeoutMs && attempt < maxAttempts - 1) {
        const sleepTime = Math.min(interval, timeoutMs - elapsed);
        spawnSync('sleep', [String(sleepTime / 1000)]);
      }
    }

    return false;
  }

  /**
   * 检查单次健康状态（同步方式）
   */
  private checkHealth(url: string): boolean {
    try {
      // 使用 curl 进行同步健康检查
      const result = spawnSync('curl', ['-f', '-s', '-o', '/dev/null', '-w', '%{http_code}', url], {
        encoding: 'utf8',
        timeout: 5000,
      });

      if (result.status === 0 && result.stdout.trim() === '200') {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }
}
