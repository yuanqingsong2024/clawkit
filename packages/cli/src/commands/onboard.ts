import { Command } from 'commander';
import { OnboardService } from '../services/onboard.service';
import { Logger } from '../utils/logger';

/**
 * onboard 命令
 * 辅助用户完成 OpenClaw 配置流程
 */
export function createOnboardCommand(): Command {
  const command = new Command('onboard');

  command
    .description('辅助完成 OpenClaw 配置流程（账号、webhook、token）')
    .option('-f, --file <path>', '配置文件路径', './clawkit.yaml')
    .action(async (options) => {
      try {
        const onboardService = new OnboardService();
        onboardService.onboard(options.file);
      } catch (error) {
        Logger.error(`onboard 执行失败：${(error as Error).message}`);
        process.exit(1);
      }
    });

  return command;
}
