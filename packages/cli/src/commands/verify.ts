import { Command } from 'commander';
import { VerifyService } from '../services/verify.service';
import { Logger } from '../utils/logger';

/**
 * verify 命令
 * 端到端验证所有组件的运行状态
 */
export function createVerifyCommand(): Command {
  const command = new Command('verify');

  command
    .description('验证所有组件的运行状态（Controller、Worker、OpenClaw、OpenCode）')
    .option('-f, --file <path>', '配置文件路径', './clawkit.yaml')
    .action(async (options) => {
      try {
        const verifyService = new VerifyService();
        verifyService.verify(options.file);
      } catch (error) {
        Logger.error(`verify 执行失败：${(error as Error).message}`);
        process.exit(1);
      }
    });

  return command;
}
