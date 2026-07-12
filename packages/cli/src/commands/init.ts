import { Command } from 'commander';
import { Logger } from '../utils/logger';
import { InitService } from '../services/init.service';

/**
 * init 命令
 * 交互式或半交互式生成最小 clawkit.yaml
 */
export function createInitCommand(): Command {
  const command = new Command('init');

  command
    .description('初始化 clawkit 配置文件（默认生成简化配置）')
    .option('-o, --output <path>', '输出文件路径', './clawkit.yaml')
    .option('--full', '生成完整配置（包含所有高级选项）')
    .action(async (options) => {
      try {
        Logger.title('ClawKit 配置初始化');

        const { output, full } = options;
        const initService = new InitService();

        // 检查文件是否已存在
        if (initService.fileExists(output)) {
          Logger.error(`配置文件已存在：${output}`);
          Logger.info('请使用不同的文件名或删除现有文件');
          process.exit(1);
        }

        let yamlContent: string;

        if (full) {
          // 完整配置模式（保留原有逻辑）
          Logger.info('生成完整配置（包含所有高级选项）\n');
          Logger.info('请根据提示完成配置：\n');
          const initOptions = await initService.collectOptions();
          yamlContent = initService.generateManifest(initOptions);

          Logger.divider();
          Logger.success(`配置文件已生成：${output}`);
          Logger.info(`拓扑类型：${initOptions.topology}`);
          Logger.info(`配置名称：${initOptions.name}`);
          Logger.info('PromptEngine：template（当前内置模板模式）');
          Logger.info(`Memory：${initOptions.enableMemory ? initOptions.memoryProvider : '未启用'}`);
          Logger.info(`Notify：${initOptions.enableNotify ? '已启用（占位）' : '未启用'}`);
          Logger.divider();
          Logger.info('请根据实际情况修改配置文件中的占位值（如 IP、路径、密钥等）');
        } else {
          // 简化配置模式（默认）
          Logger.info('生成简化配置（推荐用于快速开始）\n');
          Logger.info('请根据提示完成配置：\n');
          const simpleOptions = await initService.collectSimpleOptions();
          yamlContent = initService.generateSimpleManifest(simpleOptions);

          Logger.divider();
          Logger.success(`配置文件已生成：${output}`);
          Logger.info(`项目数量：${simpleOptions.projects.length}`);
          Logger.info(`OpenClaw Webhook Token：${simpleOptions.webhookToken ? '已设置' : '未设置'}`);
          Logger.divider();
          Logger.info('提示：');
          Logger.info('  - 简化配置只需 2 个必填字段，快速开始');
          Logger.info('  - 如需高级功能，使用 --full 选项生成完整配置');
          Logger.info('  - 使用 clawkit start 一键启动所有服务');
        }

        // 写入文件
        initService.writeToFile(yamlContent, output);
      } catch (error) {
        Logger.error(`初始化失败：${(error as Error).message}`);
        process.exit(1);
      }
    });

  return command;
}
