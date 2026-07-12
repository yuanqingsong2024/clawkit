import { Command } from 'commander';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import { DoctorServiceImpl } from '../services/doctor.service';
import { CheckStatus } from '@clawkit/shared';
import type { CheckResult, DoctorReport } from '@clawkit/shared';

/**
 * 根据检查状态返回对应的图标
 */
function statusIcon(status: CheckStatus): string {
  switch (status) {
    case CheckStatus.PASS:
      return chalk.green('✓');
    case CheckStatus.WARN:
      return chalk.yellow('⚠');
    case CheckStatus.FAIL:
      return chalk.red('✗');
    case CheckStatus.SKIP:
      return chalk.gray('○');
    default:
      return ' ';
  }
}

/**
 * 格式化输出单条检查结果
 */
function printCheckResult(check: CheckResult): void {
  const icon = statusIcon(check.status);
  console.log(`  ${icon} ${check.name}：${check.message}`);
  if (check.suggestion) {
    console.log(`    ${chalk.gray('→ ' + check.suggestion)}`);
  }
}

/**
 * 格式化输出诊断报告
 */
function printReport(report: DoctorReport): void {
  Logger.title('ClawKit 配置诊断');
  Logger.info(`配置文件：${report.manifestPath}`);
  Logger.divider();

  // 按类别分组输出
  const categories = new Map<string, CheckResult[]>();
  for (const check of report.checks) {
    // 从 check.name 提取类别（取第一个空格前的部分，或整个名称）
    const category = extractCategory(check.name);
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category)!.push(check);
  }

  for (const [category, checks] of categories) {
    console.log(chalk.bold(`\n${category}`));
    for (const check of checks) {
      printCheckResult(check);
    }
  }

  // 总结
  Logger.divider();
  const skipCount = report.checks.filter((c) => c.status === CheckStatus.SKIP).length;

  console.log(chalk.bold('\n诊断结果摘要：'));
  console.log(`  ${chalk.green('通过')}: ${report.passCount} 项`);
  console.log(`  ${chalk.yellow('警告')}: ${report.warnCount} 项`);
  console.log(`  ${chalk.red('失败')}: ${report.failCount} 项`);
  if (skipCount > 0) {
    console.log(`  ${chalk.gray('跳过')}: ${skipCount} 项`);
  }

  console.log('');
  if (report.overallStatus === CheckStatus.PASS) {
    Logger.success('所有检查通过');
  } else if (report.overallStatus === CheckStatus.WARN) {
    Logger.warn('存在警告项，建议检查后再继续');
  } else {
    Logger.error('存在失败项，请根据建议修复后重试');
  }
}

/**
 * 从检查项名称中提取类别
 */
function extractCategory(name: string): string {
  // 按优先级匹配已知类别前缀
  const categoryMap: Array<{ prefix: string; category: string }> = [
    { prefix: 'Manifest', category: '📄 配置文件检查' },
    { prefix: 'YAML', category: '📄 配置文件检查' },
    { prefix: 'Schema', category: '📄 配置文件检查' },
    { prefix: 'Node.js', category: '🔧 环境检查' },
    { prefix: 'pnpm', category: '🔧 环境检查' },
    { prefix: 'repoPath', category: '📂 路径检查' },
    { prefix: '端口', category: '🔌 端口检查' },
    { prefix: 'SSH', category: '🖥️  节点检查' },
  ];

  for (const { prefix, category } of categoryMap) {
    if (name.startsWith(prefix)) {
      return category;
    }
  }

  return '📋 其他检查';
}

/**
 * doctor 命令
 * 诊断配置文件和环境
 */
export function createDoctorCommand(): Command {
  const command = new Command('doctor');

  command
    .description('诊断配置文件和环境')
    .option('-f, --file <path>', '配置文件路径', './clawkit.yaml')
    .action(async (options) => {
      try {
        const { file } = options;
        const doctorService = new DoctorServiceImpl();

        const report = await doctorService.diagnose(file);
        printReport(report);

        // 如果有失败项，退出码为 1
        if (report.overallStatus === CheckStatus.FAIL) {
          process.exit(1);
        }
      } catch (error) {
        Logger.error(`诊断失败：${(error as Error).message}`);
        process.exit(1);
      }
    });

  return command;
}
