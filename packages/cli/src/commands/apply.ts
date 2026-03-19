import { Command } from 'commander';
import { ApplyService } from '../services/apply.service';
import { Logger } from '../utils/logger';

/**
 * apply 命令（占位）
 * 应用配置并执行部署
 */
export function createApplyCommand(): Command {
  const command = new Command('apply');

  command
    .description('应用配置并执行最小部署写入')
    .option('-f, --file <path>', '配置文件路径', './clawkit.yaml')
    .option('--dry-run', '模拟运行，不实际执行')
    .action(async (options) => {
      try {
        Logger.title('ClawKit 配置应用');
        const applyService = new ApplyService();
        const result = applyService.apply(options.file, {
          dryRun: options.dryRun === true,
        });

        if (result.dryRun) {
          Logger.warn('当前为 dry-run，仅展示将要执行的写入计划');
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
      } catch (error) {
        Logger.error(`apply 执行失败：${(error as Error).message}`);
        process.exit(1);
      }
    });

  return command;
}
