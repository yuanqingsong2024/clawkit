import { Command } from 'commander';
import chalk from 'chalk';
import { Logger } from '../utils/logger';
import { PlanServiceImpl } from '../services/plan.service';
import type { DryRunPlan } from '../services/plan.service';

/**
 * 格式化输出 dry-run 计划
 */
function printDryRunPlan(plan: DryRunPlan): void {
  Logger.title('ClawKit 执行计划（Dry-Run）');

  // 基本信息
  console.log(chalk.bold('📋 基本信息'));
  console.log(`  配置名称：${plan.name}`);
  console.log(`  拓扑类型：${plan.topology}`);
  Logger.divider();

  // 涉及的节点
  console.log(chalk.bold('\n🖥️  涉及的节点'));
  for (const node of plan.nodes) {
    const hostInfo = node.host ? ` (${node.host})` : '';
    console.log(`  • ${node.name} [${node.type}]${hostInfo}`);
  }
  Logger.divider();

  // 将要部署的角色
  console.log(chalk.bold('\n👤 将要部署的角色'));
  for (const role of plan.roles) {
    console.log(`  • ${role.role} → 节点 ${role.node}`);
  }
  Logger.divider();

  // 将要生成的配置
  console.log(chalk.bold('\n📝 将要生成的配置文件'));
  for (const config of plan.configs) {
    console.log(`  • ${config}`);
  }
  Logger.divider();

  // 将要检查的依赖
  console.log(chalk.bold('\n🔍 将要检查的依赖'));
  for (const dep of plan.dependencies) {
    console.log(`  • ${dep}`);
  }
  Logger.divider();

  // 执行步骤
  console.log(chalk.bold('\n⚡ 执行步骤'));
  let currentCategory = '';
  for (const action of plan.actions) {
    if (action.category !== currentCategory) {
      currentCategory = action.category;
      console.log(chalk.cyan(`\n  [${currentCategory}]`));
    }
    const status = action.implemented
      ? chalk.green('✓ 已实现')
      : chalk.yellow('○ 占位');
    console.log(`    ${status}  ${action.description}`);
  }
  Logger.divider();

  // 当前阶段占位能力
  console.log(chalk.bold('\n⏳ 当前阶段尚未实现的能力'));
  for (const placeholder of plan.placeholders) {
    console.log(`  ${chalk.gray('•')} ${chalk.gray(placeholder)}`);
  }
  Logger.divider();

  // 汇总
  const totalSteps = plan.executionPlan.steps.length;
  const estimatedMinutes = Math.ceil(plan.executionPlan.estimatedDuration / 60);
  console.log(chalk.bold('\n📊 汇总'));
  console.log(`  计划 ID：${plan.executionPlan.id}`);
  console.log(`  总步骤数：${totalSteps}`);
  console.log(`  预估耗时：${estimatedMinutes} 分钟`);
  console.log('');
  Logger.warn('以上为 Dry-Run 预览，当前阶段不会执行任何真实操作');
}

/**
 * plan 命令
 * 读取 manifest，生成并展示 dry-run 执行计划
 */
export function createPlanCommand(): Command {
  const command = new Command('plan');

  command
    .description('生成执行计划（dry-run 预览）')
    .option('-f, --file <path>', '配置文件路径', './clawkit.yaml')
    .option('-o, --output <path>', '输出计划文件路径（JSON 格式）')
    .action(async (options) => {
      try {
        const { file, output } = options;
        const planService = new PlanServiceImpl();

        // 读取并校验 manifest
        Logger.info(`正在读取配置文件：${file}`);
        const loadResult = planService.loadManifest(file);

        if (loadResult.errors) {
          Logger.error('配置文件校验失败：');
          for (const err of loadResult.errors) {
            Logger.error(`  ${err}`);
          }
          process.exit(1);
        }

        Logger.success('配置文件校验通过');

        // 生成 dry-run 计划
        const plan = planService.generateDryRunPlan(loadResult.manifest!, file);

        // 输出计划
        if (output) {
          const fs = await import('fs');
          const jsonPlan = JSON.stringify(plan.executionPlan, null, 2);
          fs.writeFileSync(output, jsonPlan, 'utf-8');
          Logger.success(`执行计划已保存：${output}`);
        }

        // 始终在终端输出友好格式
        printDryRunPlan(plan);
      } catch (error) {
        Logger.error(`计划生成失败：${(error as Error).message}`);
        process.exit(1);
      }
    });

  return command;
}
