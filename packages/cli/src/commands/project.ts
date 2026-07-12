/**
 * project 命令
 * 管理项目配置
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { loadManifest, detectManifestType } from '@clawkit/shared';
import type { SimpleManifest, SimpleProject } from '@clawkit/shared';

const DEFAULT_CONFIG_PATH = './clawkit.yaml';

/**
 * 添加项目
 */
async function addProject(options: {
  key: string;
  path: string;
  baseBranch?: string;
  autoExecute?: boolean;
  dangerousOps?: string;
  openCodePort?: number;
  config?: string;
}): Promise<void> {
  const configPath = options.config || DEFAULT_CONFIG_PATH;

  // 检查配置文件是否存在
  if (!fs.existsSync(configPath)) {
    console.error(`❌ 错误: 配置文件不存在: ${configPath}`);
    console.error('   提示: 运行 clawkit init 创建简化配置');
    process.exit(1);
  }

  // 加载配置
  const configType = detectManifestType(configPath);
  if (configType !== 'simple') {
    console.error('❌ 错误: project 命令只支持简化配置格式');
    console.error('   当前配置是完整格式，请手动编辑配置文件');
    process.exit(1);
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  const config = yaml.load(content) as SimpleManifest;

  // 检查项目是否已存在
  if (config.projects.some((p) => p.key === options.key)) {
    console.error(`❌ 错误: 项目 ${options.key} 已存在`);
    process.exit(1);
  }

  // 添加项目
  const newProject: SimpleProject = {
    key: options.key,
    path: options.path,
    baseBranch: options.baseBranch || 'main',
    autoExecute: options.autoExecute !== undefined ? options.autoExecute : false,
    dangerousOps: options.dangerousOps ? options.dangerousOps.split(',') : [],
    openCodePort: options.openCodePort || 4096,
  };

  config.projects.push(newProject);

  // 保存配置
  fs.writeFileSync(configPath, yaml.dump(config), 'utf-8');

  console.log(`✅ 项目已添加: ${options.key}`);
  console.log(`   路径: ${options.path}`);
  console.log(`   自动执行: ${newProject.autoExecute ? '是' : '否'}`);
  console.log(`   危险操作: ${newProject.dangerousOps.length > 0 ? newProject.dangerousOps.join(', ') : '无'}`);
}

/**
 * 列出项目
 */
async function listProjects(options: { config?: string }): Promise<void> {
  const configPath = options.config || DEFAULT_CONFIG_PATH;

  if (!fs.existsSync(configPath)) {
    console.error(`❌ 错误: 配置文件不存在: ${configPath}`);
    process.exit(1);
  }

  const configType = detectManifestType(configPath);
  if (configType !== 'simple') {
    console.error('❌ 错误: project 命令只支持简化配置格式');
    process.exit(1);
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  const config = yaml.load(content) as SimpleManifest;

  if (config.projects.length === 0) {
    console.log('📋 暂无项目');
    return;
  }

  console.log(`📋 项目列表 (共 ${config.projects.length} 个):\n`);
  config.projects.forEach((project, index) => {
    console.log(`${index + 1}. ${project.key}`);
    console.log(`   路径: ${project.path}`);
    console.log(`   分支: ${project.baseBranch}`);
    console.log(`   自动执行: ${project.autoExecute ? '是' : '否'}`);
    console.log(`   危险操作: ${project.dangerousOps.length > 0 ? project.dangerousOps.join(', ') : '无'}`);
    console.log(`   OpenCode 端口: ${project.openCodePort}`);
    console.log('');
  });
}

/**
 * 删除项目
 */
async function removeProject(key: string, options: { config?: string }): Promise<void> {
  const configPath = options.config || DEFAULT_CONFIG_PATH;

  if (!fs.existsSync(configPath)) {
    console.error(`❌ 错误: 配置文件不存在: ${configPath}`);
    process.exit(1);
  }

  const configType = detectManifestType(configPath);
  if (configType !== 'simple') {
    console.error('❌ 错误: project 命令只支持简化配置格式');
    process.exit(1);
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  const config = yaml.load(content) as SimpleManifest;

  // 查找项目
  const projectIndex = config.projects.findIndex((p) => p.key === key);
  if (projectIndex === -1) {
    console.error(`❌ 错误: 项目 ${key} 不存在`);
    process.exit(1);
  }

  // 删除项目
  config.projects.splice(projectIndex, 1);

  // 保存配置
  fs.writeFileSync(configPath, yaml.dump(config), 'utf-8');

  console.log(`✅ 项目已删除: ${key}`);
}

/**
 * 创建 project 命令
 */
export function createProjectCommand(): Command {
  const command = new Command('project');

  command
    .description('管理项目配置')
    .option('-c, --config <path>', '配置文件路径', DEFAULT_CONFIG_PATH);

  // project add
  command
    .command('add')
    .description('添加项目')
    .requiredOption('--key <key>', '项目唯一标识')
    .requiredOption('--path <path>', '项目路径')
    .option('--base-branch <branch>', '基础分支', 'main')
    .option('--auto-execute', '自动执行（不需要审批）')
    .option('--dangerous-ops <ops>', '危险操作关键词（逗号分隔）')
    .option('--opencode-port <port>', 'OpenCode 端口', '4096')
    .action(async (options) => {
      try {
        await addProject({
          ...options,
          openCodePort: parseInt(options.opencodePort, 10),
          config: command.opts().config,
        });
      } catch (error) {
        console.error('❌ 添加项目失败:', error);
        process.exit(1);
      }
    });

  // project list
  command
    .command('list')
    .description('列出所有项目')
    .action(async () => {
      try {
        await listProjects({ config: command.opts().config });
      } catch (error) {
        console.error('❌ 列出项目失败:', error);
        process.exit(1);
      }
    });

  // project remove
  command
    .command('remove <key>')
    .description('删除项目')
    .action(async (key: string) => {
      try {
        await removeProject(key, { config: command.opts().config });
      } catch (error) {
        console.error('❌ 删除项目失败:', error);
        process.exit(1);
      }
    });

  return command;
}
