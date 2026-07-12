/**
 * logs 命令
 * 查看服务日志
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

const DEFAULT_LOG_DIR = './data/logs';

/**
 * 查看日志
 */
async function showLogs(options: {
  service?: string;
  follow?: boolean;
  lines?: number;
  logDir?: string;
}): Promise<void> {
  const logDir = options.logDir || DEFAULT_LOG_DIR;

  // 检查日志目录是否存在
  if (!fs.existsSync(logDir)) {
    console.error(`❌ 错误: 日志目录不存在: ${logDir}`);
    console.error('   提示: 服务可能未启动或日志路径配置错误');
    process.exit(1);
  }

  // 确定要查看的日志文件
  let logFiles: string[] = [];
  if (options.service) {
    const logFile = path.join(logDir, `${options.service}.log`);
    if (!fs.existsSync(logFile)) {
      console.error(`❌ 错误: 日志文件不存在: ${logFile}`);
      process.exit(1);
    }
    logFiles = [logFile];
  } else {
    // 查看所有日志
    const files = fs.readdirSync(logDir);
    logFiles = files
      .filter((f) => f.endsWith('.log'))
      .map((f) => path.join(logDir, f));

    if (logFiles.length === 0) {
      console.error('❌ 错误: 未找到日志文件');
      process.exit(1);
    }
  }

  // 显示日志
  if (options.follow) {
    // 实时跟踪日志
    console.log('📜 实时日志 (按 Ctrl+C 退出):\n');
    const tailProcess = spawn('tail', ['-f', ...logFiles], {
      stdio: 'inherit',
    });

    process.on('SIGINT', () => {
      tailProcess.kill();
      process.exit(0);
    });
  } else {
    // 显示最近的日志
    const lines = options.lines || 50;
    console.log(`📜 最近 ${lines} 行日志:\n`);

    for (const logFile of logFiles) {
      const serviceName = path.basename(logFile, '.log');
      console.log(`=== ${serviceName} ===\n`);

      const content = fs.readFileSync(logFile, 'utf-8');
      const allLines = content.split('\n').filter((line) => line.trim());
      const recentLines = allLines.slice(-lines);

      recentLines.forEach((line) => {
        console.log(line);
      });

      console.log('');
    }
  }
}

/**
 * 创建 logs 命令
 */
export function createLogsCommand(): Command {
  const command = new Command('logs');

  command
    .description('查看服务日志')
    .option('-s, --service <name>', '服务名称 (controller/worker)')
    .option('-f, --follow', '实时跟踪日志')
    .option('-n, --lines <number>', '显示行数', '50')
    .option('--log-dir <path>', '日志目录路径', DEFAULT_LOG_DIR)
    .action(async (options) => {
      try {
        await showLogs({
          ...options,
          lines: parseInt(options.lines, 10),
        });
      } catch (error) {
        console.error('❌ 查看日志失败:', error);
        process.exit(1);
      }
    });

  return command;
}
