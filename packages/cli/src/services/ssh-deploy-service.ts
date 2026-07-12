import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';

import type { Manifest, Node, SshNode } from '@clawkit/shared';

import { SshConnectionPool, type SshDeployEvent } from './ssh-connection-pool';
import { SshCommandExecutor } from './ssh-command-executor';
import { SshFileSync, TransferMode } from './ssh-file-sync';
import { SystemdServiceManager, SystemdServiceState } from './systemd-service-manager';
import { Logger } from '../utils/logger';

/**
 * 部署状态
 */
export enum DeployStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

/**
 * 部署步骤状态
 */
export interface DeployStepStatus {
  step: string;
  status: DeployStatus;
  startTime: Date;
  endTime?: Date;
  message?: string;
  error?: string;
}

/**
 * 备份条目
 */
export interface BackupEntry {
  id: string;
  nodeName: string;
  filePath: string;
  backupPath: string;
  timestamp: Date;
  size: number;
}

/**
 * 部署记录
 */
export interface DeployRecord {
  id: string;
  manifestPath: string;
  profileName: string;
  status: DeployStatus;
  startTime: Date;
  endTime?: Date;
  nodes: DeployNodeRecord[];
  totalDuration: number;
  errors: string[];
  rollbacks: RollbackRecord[];
}

/**
 * 节点部署记录
 */
export interface DeployNodeRecord {
  nodeName: string;
  nodeType: Node['type'];
  steps: DeployStepStatus[];
  status: DeployStatus;
  serviceNames: string[];
}

/**
 * 回滚记录
 */
export interface RollbackRecord {
  id: string;
  timestamp: Date;
  nodeName: string;
  action: string;
  filePath: string;
  backupPath: string;
  success: boolean;
  error?: string;
}

/**
 * SSH 部署选项
 */
export interface SshDeployOptions {
  syncMode?: TransferMode;
  enableRollback?: boolean;
  maxRetries?: number;
  parallelNodes?: number;
  dryRun?: boolean;
  skipServices?: string[]; // 跳过的服务列表
}

/**
 * SSH 部署结果
 */
export interface SshDeployResult {
  success: boolean;
  record: DeployRecord;
  summary: {
    totalNodes: number;
    successNodes: number;
    failedNodes: number;
    totalDuration: number;
  };
}

/**
 * SSH 部署服务
 * 提供完整的 SSH 节点自动化部署能力
 */
export class SshDeployService extends EventEmitter {
  private readonly connectionPool: SshConnectionPool;
  private readonly executor: SshCommandExecutor;
  private readonly fileSync: SshFileSync;
  private readonly systemdManager: SystemdServiceManager;
  private readonly backupDir: string;
  private readonly recordsDir: string;

  constructor(options?: {
    connectionPool?: SshConnectionPool;
    maxParallelTransfers?: number;
  }) {
    super();

    this.connectionPool = options?.connectionPool ?? new SshConnectionPool();
    this.executor = new SshCommandExecutor(this.connectionPool);
    this.fileSync = new SshFileSync(this.connectionPool, {
      defaultMode: TransferMode.RSYNC,
      maxParallelTransfers: options?.maxParallelTransfers ?? 3,
    });
    this.systemdManager = new SystemdServiceManager(this.connectionPool);

    // 备份和记录目录
    this.backupDir = path.join(os.homedir(), '.clawkit', 'backups');
    this.recordsDir = path.join(os.homedir(), '.clawkit', 'deploy-records');

    this.ensureDirectories();

    // 转发连接池事件
    this.connectionPool.on('event', (event: SshDeployEvent) => {
      this.emit('event', event);
    });
  }

  /**
   * 确保必要目录存在
   */
  private ensureDirectories(): void {
    for (const dir of [this.backupDir, this.recordsDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * 执行完整部署
   */
  async deploy(manifest: Manifest, options?: SshDeployOptions): Promise<SshDeployResult> {
    const recordId = this.generateRecordId();
    const startTime = new Date();

    Logger.title(`开始 SSH 部署 (${recordId})`);
    Logger.info(`Profile: ${manifest.profile.name}`);
    Logger.info(`Manifest: ${manifest.profile.name}`);
    Logger.divider();

    const record: DeployRecord = {
      id: recordId,
      manifestPath: 'unknown',
      profileName: manifest.profile.name,
      status: DeployStatus.IN_PROGRESS,
      startTime,
      nodes: [],
      totalDuration: 0,
      errors: [],
      rollbacks: [],
    };

    try {
      // 收集所有需要部署的节点
      const nodesToDeploy = this.collectNodesToDeploy(manifest);
      Logger.info(`待部署节点数: ${nodesToDeploy.length}`);

      // 并行部署多个节点
      const parallelCount = options?.parallelNodes ?? 2;
      const results: DeployNodeRecord[] = [];

      for (let i = 0; i < nodesToDeploy.length; i += parallelCount) {
        const batch = nodesToDeploy.slice(i, i + parallelCount);
        const batchResults = await Promise.all(
          batch.map((node) => this.deployNode(recordId, manifest, node, options)),
        );
        results.push(...batchResults);
      }

      record.nodes = results;

      // 计算总体状态
      const failedNodes = results.filter((n) => n.status === DeployStatus.FAILED);
      const successNodes = results.filter((n) => n.status === DeployStatus.SUCCESS);

      record.endTime = new Date();
      record.totalDuration = record.endTime.getTime() - startTime.getTime();
      record.status = failedNodes.length === 0 ? DeployStatus.SUCCESS : DeployStatus.FAILED;

      // 保存部署记录
      this.saveDeployRecord(record);

      // 输出结果
      Logger.divider();
      Logger.info(`部署完成`);
      Logger.info(`总节点数: ${results.length}`);
      Logger.info(`成功: ${successNodes.length}`);
      Logger.info(`失败: ${failedNodes.length}`);
      Logger.info(`耗时: ${(record.totalDuration / 1000).toFixed(1)}s`);

      if (failedNodes.length > 0) {
        Logger.warn('失败的节点:');
        for (const node of failedNodes) {
          Logger.warn(`  - ${node.nodeName}`);
        }
      }

      return {
        success: record.status === DeployStatus.SUCCESS,
        record,
        summary: {
          totalNodes: results.length,
          successNodes: successNodes.length,
          failedNodes: failedNodes.length,
          totalDuration: record.totalDuration,
        },
      };
    } catch (error) {
      record.status = DeployStatus.FAILED;
      record.endTime = new Date();
      record.totalDuration = record.endTime.getTime() - startTime.getTime();
      record.errors.push((error as Error).message);

      this.saveDeployRecord(record);

      return {
        success: false,
        record,
        summary: {
          totalNodes: 0,
          successNodes: 0,
          failedNodes: 0,
          totalDuration: record.totalDuration,
        },
      };
    }
  }

  /**
   * 部署单个节点
   */
  private async deployNode(
    recordId: string,
    manifest: Manifest,
    nodeName: string,
    options?: SshDeployOptions,
  ): Promise<DeployNodeRecord> {
    const node = manifest.nodes[nodeName];
    if (!node) {
      return {
        nodeName,
        nodeType: 'unknown' as Node['type'],
        steps: [],
        status: DeployStatus.FAILED,
        serviceNames: [],
      };
    }

    Logger.title(`部署节点: ${nodeName}`);

    const nodeRecord: DeployNodeRecord = {
      nodeName,
      nodeType: node.type,
      steps: [],
      status: DeployStatus.IN_PROGRESS,
      serviceNames: [],
    };

    try {
      // 步骤 1: 连接测试
      if (node.type === 'ssh') {
        await this.runStep(nodeRecord, 'connection_test', async () => {
          await this.connectionPool.getConnection(nodeName, node as SshNode);
        });

        // 步骤 2: 代码同步
        await this.runStep(nodeRecord, 'code_sync', async () => {
          await this.syncNodeCode(recordId, nodeName, node as SshNode, manifest, options);
        });

        // 步骤 3: 配置文件部署
        await this.runStep(nodeRecord, 'config_deploy', async () => {
          await this.deployConfigFiles(recordId, nodeName, node as SshNode, manifest);
        });

        // 步骤 4: systemd 服务安装
        await this.runStep(nodeRecord, 'service_install', async () => {
          const services = await this.installServices(nodeName, node as SshNode, manifest);
          nodeRecord.serviceNames = services;
        });

        // 步骤 5: 服务启动
        await this.runStep(nodeRecord, 'service_start', async () => {
          await this.startServices(nodeName, node as SshNode, nodeRecord.serviceNames);
        });
      } else {
        Logger.info(`节点类型 ${node.type} 无需 SSH 部署`);
      }

      nodeRecord.status = DeployStatus.SUCCESS;
    } catch (error) {
      nodeRecord.status = DeployStatus.FAILED;

      // 如果启用了回滚且非 dry-run
      if (options?.enableRollback && !options?.dryRun) {
        Logger.warn(`部署失败，尝试回滚...`);
        // 回滚逻辑可以在这里调用
      }
    }

    return nodeRecord;
  }

  /**
   * 执行部署步骤
   */
  private async runStep(
    nodeRecord: DeployNodeRecord,
    stepName: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    const step: DeployStepStatus = {
      step: stepName,
      status: DeployStatus.IN_PROGRESS,
      startTime: new Date(),
    };

    nodeRecord.steps.push(step);
    Logger.info(`[${stepName}] 开始...`);

    try {
      await fn();
      step.status = DeployStatus.SUCCESS;
      step.endTime = new Date();
      Logger.success(`[${stepName}] 完成`);
    } catch (error) {
      step.status = DeployStatus.FAILED;
      step.endTime = new Date();
      step.error = (error as Error).message;
      Logger.error(`[${stepName}] 失败: ${step.error}`);
      throw error;
    }
  }

  /**
   * 收集需要部署的节点
   */
  private collectNodesToDeploy(manifest: Manifest): string[] {
    const nodes = new Set<string>();

    // Controller 节点
    nodes.add(manifest.services.controller.node);

    // Claude Code 节点
    nodes.add(manifest.services.openClaw.node);

    // Worker 节点
    for (const worker of manifest.workers) {
      nodes.add(worker.node);
    }

    // 过滤掉 local 类型节点（本地部署）
    return Array.from(nodes).filter((nodeName) => {
      const node = manifest.nodes[nodeName];
      return node && node.type === 'ssh';
    });
  }

  /**
   * 同步节点代码
   */
  private async syncNodeCode(
    recordId: string,
    nodeName: string,
    sshNode: SshNode,
    manifest: Manifest,
    options?: SshDeployOptions,
  ): Promise<void> {
    const workDir = sshNode.workDir || '/opt/clawkit';
    const repoRoot = process.cwd();

    // 需要同步的包目录
    const packages = ['controller', 'worker'];

    for (const pkg of packages) {
      const localPath = path.join(repoRoot, 'packages', pkg);
      const remotePath = path.join(workDir, 'packages', pkg);

      Logger.info(`同步 ${pkg}...`);

      const result = await this.fileSync.syncDirectory(nodeName, sshNode, localPath, remotePath, {
        mode: options?.syncMode ?? TransferMode.RSYNC,
        delete: true,
        exclude: [
          'node_modules',
          'dist',
          '.git',
          '*.log',
          '.env*',
        ],
        dryRun: options?.dryRun,
      });

      if (!result.success) {
        throw new Error(`同步 ${pkg} 失败: ${result.errors.join(', ')}`);
      }
    }
  }

  /**
   * 部署配置文件
   */
  private async deployConfigFiles(
    recordId: string,
    nodeName: string,
    sshNode: SshNode,
    manifest: Manifest,
  ): Promise<void> {
    const workDir = sshNode.workDir || '/opt/clawkit';

    // 创建配置目录
    await this.executor.execute(nodeName, sshNode, `mkdir -p ${workDir}/config ${workDir}/scripts ${workDir}/systemd`);

    // 部署 manifest
    const manifestContent = JSON.stringify(manifest, null, 2);
    await this.executor.execute(
      nodeName,
      sshNode,
      `cat > ${workDir}/clawkit.yaml << 'EOF'\n${manifestContent}\nEOF`,
    );

    Logger.info('配置文件已部署');
  }

  /**
   * 安装服务
   */
  private async installServices(nodeName: string, sshNode: SshNode, manifest: Manifest): Promise<string[]> {
    const services: string[] = [];
    const workDir = sshNode.workDir || '/opt/clawkit';

    // 安装 Controller 服务
    const controllerService = `clawkit-controller.service`;
    const controllerExists = await this.systemdManager.exists(nodeName, sshNode, controllerService);

    if (!controllerExists) {
      await this.systemdManager.install(nodeName, sshNode, controllerService, {
        description: 'ClawKit Controller',
        workingDirectory: workDir,
        execStart: `node ${workDir}/packages/controller/dist/index.js`,
        environmentFile: `${workDir}/config/controller.env`,
        restart: 'always',
        restartSec: 5,
      });
      services.push(controllerService);
      Logger.info(`Controller 服务已安装: ${controllerService}`);
    }

    // 安装 Worker 服务
    for (const worker of manifest.workers) {
      if (worker.node !== nodeName) continue;

      const workerService = `clawkit-worker-${worker.id}.service`;
      const workerExists = await this.systemdManager.exists(nodeName, sshNode, workerService);

      if (!workerExists) {
        await this.systemdManager.install(nodeName, sshNode, workerService, {
          description: `ClawKit Worker ${worker.id}`,
          workingDirectory: workDir,
          execStart: `node ${workDir}/packages/worker/dist/index.js`,
          environmentFile: `${workDir}/config/worker-${worker.id}.env`,
          restart: 'always',
          restartSec: 5,
        });
        services.push(workerService);
        Logger.info(`Worker 服务已安装: ${workerService}`);
      }
    }

    return services;
  }

  /**
   * 启动服务
   */
  private async startServices(nodeName: string, sshNode: SshNode, serviceNames: string[]): Promise<void> {
    for (const serviceName of serviceNames) {
      const result = await this.systemdManager.start(nodeName, sshNode, serviceName);

      if (result.success) {
        Logger.info(`服务已启动: ${serviceName}`);
      } else {
        Logger.warn(`服务启动失败: ${serviceName} - ${result.message}`);
      }
    }
  }

  /**
   * 执行回滚
   */
  async rollback(recordId: string): Promise<boolean> {
    const record = this.loadDeployRecord(recordId);

    if (!record) {
      Logger.error(`找不到部署记录: ${recordId}`);
      return false;
    }

    if (record.status !== DeployStatus.FAILED) {
      Logger.warn(`部署记录 ${recordId} 状态为 ${record.status}，无需回滚`);
      return false;
    }

    Logger.title(`开始回滚部署: ${recordId}`);

    // TODO: 实现完整的回滚逻辑
    // 1. 读取备份文件
    // 2. 恢复文件到远程节点
    // 3. 重启服务

    return true;
  }

  /**
   * 保存部署记录
   */
  private saveDeployRecord(record: DeployRecord): void {
    const filePath = path.join(this.recordsDir, `${record.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
    Logger.info(`部署记录已保存: ${filePath}`);
  }

  /**
   * 加载部署记录
   */
  private loadDeployRecord(recordId: string): DeployRecord | null {
    const filePath = path.join(this.recordsDir, `${recordId}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as DeployRecord;
    } catch {
      return null;
    }
  }

  /**
   * 列出所有部署记录
   */
  listDeployRecords(): DeployRecord[] {
    if (!fs.existsSync(this.recordsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.recordsDir).filter((f) => f.endsWith('.json'));
    const records: DeployRecord[] = [];

    for (const file of files) {
      try {
        const record = JSON.parse(fs.readFileSync(path.join(this.recordsDir, file), 'utf8')) as DeployRecord;
        records.push(record);
      } catch {
        // 忽略无效记录
      }
    }

    return records.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * 生成记录 ID
   */
  private generateRecordId(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `deploy-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${Date.now().toString(36)}`;
  }

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    await this.connectionPool.close();
  }

  /**
   * 获取连接池状态
   */
  getConnectionPoolStatus() {
    return this.connectionPool.getStatus();
  }
}
