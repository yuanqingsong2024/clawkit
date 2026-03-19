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
    .description('初始化 clawkit 配置文件（交互式）')
    .option('-t, --topology <type>', '部署拓扑类型：all-in-one, hybrid, split')
    .option('-o, --output <path>', '输出文件路径', './clawkit.yaml')
    .action(async (options) => {
      try {
        Logger.title('ClawKit 配置初始化');

        const { topology, output } = options;
        const initService = new InitService();

        // 检查文件是否已存在
        if (initService.fileExists(output)) {
          Logger.error(`配置文件已存在：${output}`);
          Logger.info('请使用不同的文件名或删除现有文件');
          process.exit(1);
        }

        // 交互式收集配置选项
        Logger.info('请根据提示完成配置：\n');
        const initOptions = await initService.collectOptions(topology);

        // 生成 YAML
        const yamlContent = initService.generateManifest(initOptions);

        // 写入文件
        initService.writeToFile(yamlContent, output);

        Logger.divider();
        Logger.success(`配置文件已生成：${output}`);
        Logger.info(`拓扑类型：${initOptions.topology}`);
        Logger.info(`配置名称：${initOptions.name}`);
        Logger.info('PromptEngine：template（当前内置模板模式）');
        Logger.info(`Memory：${initOptions.enableMemory ? initOptions.memoryProvider : '未启用'}`);
        Logger.info(`Notify：${initOptions.enableNotify ? '已启用（占位）' : '未启用'}`);
        Logger.divider();
        Logger.info('请根据实际情况修改配置文件中的占位值（如 IP、路径、密钥等）');
      } catch (error) {
        Logger.error(`初始化失败：${(error as Error).message}`);
        process.exit(1);
      }
    });

  return command;
}
