import { Command } from 'commander';
import { CheckStatus } from '@clawkit/shared';

import { HealService } from '../services/heal.service';
import { Logger } from '../utils/logger';

/**
 * heal 命令（占位）
 * 修复部署问题
 */
export function createHealCommand(): Command {
  const command = new Command('heal');

  command
    .description('诊断并修复常见部署问题（默认仅输出修复计划）')
    .option('-f, --file <path>', '配置文件路径', './clawkit.yaml')
    .option('--dry-run', '仅输出诊断与修复计划，不实际写入')
    .option('--force', '强制修复')
    .action(async (options) => {
      try {
        Logger.title('ClawKit 自动修复');
        const healService = new HealService();
        const result = await healService.heal(options.file, {
          dryRun: options.dryRun === true,
          force: options.force === true,
        });

        for (const issue of result.issues) {
          const printer = issue.status === CheckStatus.FAIL ? Logger.error : Logger.warn;
          printer(`${issue.title}：${issue.message}`);
          Logger.info(`建议：${issue.suggestion}`);
          Logger.info(`可自动修复：${issue.canAutoFix ? '是' : '否'}`);
        }

        Logger.divider();
        if (result.plannedFixes.length > 0) {
          Logger.info('修复计划：');
          for (const fix of result.plannedFixes) {
            Logger.info(`  ${fix}`);
          }
        } else {
          Logger.success('未发现可自动修复的问题');
        }

        if (result.appliedFixes.length > 0) {
          Logger.divider();
          Logger.success('已执行自动修复：');
          for (const fix of result.appliedFixes) {
            Logger.success(`  ${fix}`);
          }
          Logger.info('以上问题列表为修复前诊断结果；自动修复已执行，建议重新运行 heal 或 doctor 查看修复后的当前状态。');
        } else if (!result.dryRun) {
          Logger.warn('本次没有执行任何自动修复动作');
        } else {
          Logger.warn('当前为计划视图，未执行实际修复');
        }
      } catch (error) {
        Logger.error(`heal 执行失败：${(error as Error).message}`);
        process.exit(1);
      }
    });

  return command;
}
