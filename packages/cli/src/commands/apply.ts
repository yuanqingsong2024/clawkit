import { Command } from 'commander';
import { ApplyService } from '../services/apply.service';
import { SshDeployService, DeployStatus } from '../services/ssh-deploy-service';
import { TransferMode } from '../services/ssh-file-sync';
import { Logger } from '../utils/logger';

/**
 * apply 命令
 * 应用配置并执行部署
 */
export function createApplyCommand(): Command {
  const command = new Command('apply');

  command
    .description('应用配置并执行部署')
    .option('-f, --file <path>', '配置文件路径', './clawkit.yaml')
    .option('--dry-run', '模拟运行，不实际执行')
    .option('--deploy', '执行真实部署（启动 Claude Code 和 OpenCode）')
    // SSH 部署选项
    .option('--ssh-deploy', '通过 SSH 执行远程节点部署')
    .option('--sync-mode <mode>', '代码同步模式: rsync|scp', 'rsync')
    .option('--enable-rollback', '部署失败时启用自动回滚')
    .option('--parallel-nodes <number>', '并行部署节点数', '2')
    .option('--list-records', '列出所有部署记录')
    .option('--rollback <record-id>', '回滚到指定部署记录')
    .action(async (options) => {
      try {
        // 列出部署记录
        if (options.listRecords) {
          const deployService = new SshDeployService();
          const records = deployService.listDeployRecords();

          if (records.length === 0) {
            Logger.info('暂无部署记录');
            return;
          }

          Logger.title('部署记录列表');
          for (const record of records) {
            Logger.info(`ID: ${record.id}`);
            Logger.info(`  Profile: ${record.profileName}`);
            Logger.info(`  状态: ${record.status}`);
            Logger.info(`  开始时间: ${record.startTime}`);
            Logger.info(`  节点数: ${record.nodes.length}`);
            Logger.info(`  耗时: ${(record.totalDuration / 1000).toFixed(1)}s`);
            Logger.divider();
          }
          return;
        }

        // 回滚操作
        if (options.rollback) {
          const deployService = new SshDeployService();
          const success = await deployService.rollback(options.rollback);
          if (success) {
            Logger.success('回滚成功');
          } else {
            Logger.error('回滚失败');
            process.exit(1);
          }
          return;
        }

        Logger.title('ClawKit 配置应用');
        const applyService = new ApplyService();

        // SSH 部署模式
        if (options.sshDeploy) {
          const manifestLoader = new (await import('../services/manifest-loader')).ManifestLoader();
          const { manifest } = manifestLoader.load(options.file);
          const deployService = new SshDeployService();

          const result = await deployService.deploy(manifest, {
            syncMode: (options.syncMode as TransferMode) || TransferMode.RSYNC,
            enableRollback: options.enableRollback === true,
            parallelNodes: parseInt(options.parallelNodes, 10) || 2,
            dryRun: options.dryRun === true,
          });

          if (result.success) {
            Logger.success('SSH 部署成功');
          } else {
            Logger.error('SSH 部署失败');
            process.exit(1);
          }

          await deployService.close();
          return;
        }

        // 标准部署模式
        const result = applyService.apply(options.file, {
          dryRun: options.dryRun === true,
          deploy: options.deploy === true,
        });

        if (result.dryRun) {
          Logger.warn('当前为 dry-run，仅展示将要执行的写入计划');
          Logger.info('提示：若你使用的是简化配置，建议优先配合 clawkit start 或 pnpm quickstart 使用');
        }

        for (const plan of result.filePlans) {
          Logger.info(`${plan.description} -> ${plan.targetPath}`);
        }

        if (result.generatedFiles.length > 0) {
          Logger.divider();
          Logger.success('已完成真实写入：');
          for (const file of result.generatedFiles) {
            Logger.success(`  ${file}`);
          }
        }

        if (result.backupFiles.length > 0) {
          Logger.divider();
          Logger.info('已创建备份文件：');
          for (const file of result.backupFiles) {
            Logger.info(`  ${file}`);
          }
        }

        if (result.skippedFiles.length > 0) {
          Logger.divider();
          Logger.warn('以下文件本次跳过：');
          for (const file of result.skippedFiles) {
            Logger.warn(`  ${file}`);
          }
        }

        Logger.divider();
        for (const note of result.notes) {
          Logger.info(note);
        }

        // 提示 SSH 部署选项
        const hasSshNodes = result.filePlans.some((p) => p.nodeType === 'ssh');
        if (hasSshNodes) {
          Logger.divider();
          Logger.info('检测到 SSH 节点，可使用以下命令进行完整部署：');
          Logger.info('  clawkit apply -f <path> --ssh-deploy');
          Logger.info('  clawkit apply -f <path> --ssh-deploy --sync-mode rsync');
          Logger.info('  clawkit apply -f <path> --ssh-deploy --enable-rollback');
        }
      } catch (error) {
        Logger.error(`apply 执行失败：${(error as Error).message}`);
        process.exit(1);
      }
    });

  return command;
}
