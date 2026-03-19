"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplyService = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const manifest_loader_1 = require("./manifest-loader");
class ApplyService {
    loader = new manifest_loader_1.ManifestLoader();
    createPlan(filePath, options = {}) {
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
    apply(filePath, options = {}) {
        const plan = this.createPlan(filePath, options);
        if (options.dryRun) {
            return plan;
        }
        const generatedFiles = [];
        const backupFiles = [];
        const skippedFiles = [];
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
    buildFilePlans(context, onlyLocal) {
        const plans = [];
        const touchedNodes = new Set();
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
                content: node_fs_1.default.readFileSync(context.manifestPath, 'utf8'),
            });
        }
        return plans;
    }
    buildControllerPlans(context) {
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
    buildOpenClawPlans(context) {
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
    buildWorkerPlans(context, worker) {
        const node = context.manifest.nodes[worker.node];
        const envFile = this.resolveNodeFilePath(context, worker.node, `worker-${worker.id}.env`, false);
        const serviceFile = this.resolveNodeFilePath(context, worker.node, `systemd/clawkit-worker-${worker.id}.service`, false);
        const startScript = this.resolveNodeFilePath(context, worker.node, `scripts/start-worker-${worker.id}.sh`, false);
        const plans = [
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
    renderControllerEnv(manifest, manifestPath, nodeName) {
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
    renderWorkerEnv(manifest, manifestPath, worker) {
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
    renderOpenClawJson(manifest) {
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
    renderSystemdService(input) {
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
    renderStartScript(environmentFile, execStart) {
        return [
            '#!/usr/bin/env bash',
            'set -euo pipefail',
            `source "${environmentFile}"`,
            execStart,
            '',
        ].join('\n');
    }
    renderOpenCodeLaunch(workerId, projectKey, repoPath, baseBranch, port, agent) {
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
    resolveNodeFilePath(context, nodeName, relativeFilePath, useHomeDir) {
        const node = context.manifest.nodes[nodeName];
        if (node.type === 'local') {
            if (useHomeDir) {
                return node_path_1.default.join(node_os_1.default.homedir(), relativeFilePath);
            }
            const workDir = node.workDir ? node_path_1.default.resolve(context.manifestDir, node.workDir) : context.manifestDir;
            return node_path_1.default.join(workDir, relativeFilePath);
        }
        if (useHomeDir) {
            return `~/${relativeFilePath}`;
        }
        return node_path_1.default.posix.join(node.workDir, relativeFilePath.replace(/\\/g, '/'));
    }
    resolveOpenClawConfigPath(isLocal) {
        return isLocal
            ? node_path_1.default.join(node_os_1.default.homedir(), '.openclaw', 'openclaw.json')
            : '~/.openclaw/openclaw.json';
    }
    resolveManifestRuntimePath(manifest, manifestPath, nodeName) {
        const node = manifest.nodes[nodeName];
        if (node.type === 'local') {
            return this.resolveNodeFilePath({ manifest, manifestPath, manifestDir: node_path_1.default.dirname(manifestPath) }, nodeName, 'clawkit.yaml', false);
        }
        return node_path_1.default.posix.join(node.workDir, 'clawkit.yaml');
    }
    resolveRuntimeDirectory(manifest, nodeName) {
        const node = manifest.nodes[nodeName];
        if (node.type === 'local') {
            return process.cwd();
        }
        return node.workDir;
    }
    resolveExecStart(role) {
        const repoRoot = process.cwd();
        const target = role === 'controller'
            ? 'packages/controller/dist/index.js'
            : 'packages/worker/dist/index.js';
        return `node ${node_path_1.default.join(repoRoot, target)}`;
    }
    deriveControllerBaseUrl(manifest, workerNodeName) {
        const controllerNode = manifest.nodes[manifest.services.controller.node];
        const workerNode = manifest.nodes[workerNodeName];
        if (controllerNode.type === 'local' && workerNode.type === 'local') {
            return `http://127.0.0.1:${manifest.services.controller.port}`;
        }
        return manifest.services.openClaw.publicUrl;
    }
    writeLocalFile(targetPath, content) {
        node_fs_1.default.mkdirSync(node_path_1.default.dirname(targetPath), { recursive: true });
        let backupPath;
        if (node_fs_1.default.existsSync(targetPath)) {
            backupPath = `${targetPath}.${this.buildTimestamp()}.bak`;
            node_fs_1.default.copyFileSync(targetPath, backupPath);
        }
        node_fs_1.default.writeFileSync(targetPath, content, 'utf8');
        if (targetPath.endsWith('.sh')) {
            node_fs_1.default.chmodSync(targetPath, 0o755);
        }
        return backupPath;
    }
    writeRemoteFile(filePlan) {
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
            : node_path_1.default.posix.dirname(targetPath);
        const backupPath = `${targetPath}.${this.buildTimestamp()}.bak`;
        const escapedTarget = this.escapeShell(targetPath);
        const escapedDirectory = this.escapeShell(directory);
        const escapedBackup = this.escapeShell(backupPath);
        const command = [
            `mkdir -p ${escapedDirectory}`,
            `if [ -f ${escapedTarget} ]; then cp ${escapedTarget} ${escapedBackup}; fi`,
            `cat > ${escapedTarget}`,
        ].join(' && ');
        const result = (0, node_child_process_1.spawnSync)('ssh', [...this.buildSshArgs(node), command], {
            encoding: 'utf8',
            input: filePlan.content,
        });
        if (result.status !== 0) {
            const message = result.stderr.trim() || result.stdout.trim() || '未知 SSH 错误';
            throw new Error(`远程写入失败（${node.host}）：${message}`);
        }
        return backupPath;
    }
    buildSshArgs(node) {
        const args = ['-p', String(node.port)];
        if (node.keyPath) {
            args.push('-i', node.keyPath.replace(/^~\//, `${node_os_1.default.homedir()}/`));
        }
        args.push(`${node.user}@${node.host}`);
        return args;
    }
    escapeShell(value) {
        return `'${value.replace(/'/g, `'"'"'`)}'`;
    }
    buildTimestamp() {
        const now = new Date();
        const pad = (value) => String(value).padStart(2, '0');
        return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    }
    buildNotes(manifest, manifestPath, filePlans) {
        const notes = [
            `已读取 manifest：${manifestPath}`,
            `建议先执行 pnpm --filter @clawkit/controller build && pnpm --filter @clawkit/worker build`,
            `Controller 启动建议：node ${node_path_1.default.join(process.cwd(), 'packages/controller/dist/index.js')}`,
            `Worker 启动建议：node ${node_path_1.default.join(process.cwd(), 'packages/worker/dist/index.js')}`,
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
exports.ApplyService = ApplyService;
//# sourceMappingURL=apply.service.js.map