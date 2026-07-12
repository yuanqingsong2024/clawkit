#!/usr/bin/env node

import { Command } from 'commander';
// 简化命令（推荐使用）
import { createStartCommand } from './commands/start';
import { createProjectCommand } from './commands/project';
import { createStatusCommand } from './commands/status';
import { createLogsCommand } from './commands/logs';
// 原有命令（向后兼容）
import { createInitCommand } from './commands/init';
import { createDoctorCommand } from './commands/doctor';
import { createPlanCommand } from './commands/plan';
import { createApplyCommand } from './commands/apply';
import { createHealCommand } from './commands/heal';
import { createOnboardCommand } from './commands/onboard';
import { createVerifyCommand } from './commands/verify';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('clawkit')
    .description('一键部署、配置并串联 OpenClaw 与 OpenCode 的轻量工具')
    .version('0.2.0');

  // 简化命令（推荐使用）
  program.addCommand(createStartCommand());
  program.addCommand(createProjectCommand());
  program.addCommand(createStatusCommand());
  program.addCommand(createLogsCommand());

  // 原有命令（向后兼容）
  program.addCommand(createInitCommand());
  program.addCommand(createDoctorCommand());
  program.addCommand(createPlanCommand());
  program.addCommand(createApplyCommand());
  program.addCommand(createHealCommand());
  program.addCommand(createOnboardCommand());
  program.addCommand(createVerifyCommand());

  return program;
}

if (require.main === module) {
  const program = createProgram();

  // 解析命令行参数
  program.parse(process.argv);

  // 如果没有提供命令，显示帮助信息
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}
