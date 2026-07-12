import chalk from 'chalk';

/**
 * 日志工具
 */
export class Logger {
  /**
   * 成功信息
   */
  static success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  /**
   * 错误信息
   */
  static error(message: string): void {
    console.error(chalk.red('✗'), message);
  }

  /**
   * 警告信息
   */
  static warn(message: string): void {
    console.warn(chalk.yellow('⚠'), message);
  }

  /**
   * 普通信息
   */
  static info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  /**
   * 标题
   */
  static title(message: string): void {
    console.log(chalk.bold.cyan(`\n${message}\n`));
  }

  /**
   * 分隔线
   */
  static divider(): void {
    console.log(chalk.gray('─'.repeat(50)));
  }
}
