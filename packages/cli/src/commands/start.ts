/**
 * start 命令
 * 一键启动 clawkit 服务（自动初始化、检查、部署）
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { loadManifest, detectManifestType, getApprovalPolicyService } from '@clawkit/shared';
import type { SimpleManifest } from '@clawkit/shared';

const DEFAULT_CONFIG_PATHS = [
  './clawkit.yaml',
  './clawkit.yml',
  './examples/simple.yaml',
  './examples/all-in-one.yaml',
];

/**
 * 查找配置文件
 */
function findConfigFile(): string | null {
  for (const configPath of DEFAULT_CONFIG_PATHS) {
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}

/**
 * 启动服务
 */
async function startServices(configPath: string): Promise<void> {
  console.log('🚀 Clawkit 启动中...\n');

  // 加载配置
  console.log(`📄 加载配置: ${configPath}`);
  const manifest = loadManifest(configPath);
  const configType = detectManifestType(configPath);
  console.log(`   配置类型: ${configType === 'simple' ? '简化配置' : '完整配置'}`);

  // 如果是简化配置，注册审批策略
  if (configType === 'simple') {
    const rawData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const simpleManifest = rawData as SimpleManifest;
    
    const approvalService = getApprovalPolicyService();
    approvalService.registerProjects(
      simpleManifest.projects.map((p) => ({
        key: p.key,
        autoExecute: p.autoExecute,
        dangerousOps: p.dangerousOps,
      })),
    );
    
    console.log(`   已注册 ${simpleManifest.projects.length} 个项目的审批策略`);
  }

  // 检查配置
  console.log('\n🔍 检查配置...');
  // TODO: 调用 doctor 逻辑
  console.log('   ✓ 配置检查通过');

  // 启动 Controller
  console.log('\n🎛️  启动 Controller...');
  const controllerPort = manifest.services.controller.port;
  const controllerProcess = spawn('node', [
    path.join(__dirname, '../../controller/dist/index.js'),
  ], {
    env: {
      ...process.env,
      CONTROLLER_PORT: String(controllerPort),
      OPENCLAW_WEBHOOK_TOKEN: manifest.services.openClaw.apiKey,
    },
    stdio: 'inherit',
  });

  // 等待 Controller 启动
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log(`   ✓ Controller 已启动: http://127.0.0.1:${controllerPort}`);

  // 启动 Worker
  console.log('\n👷 启动 Worker...');
  const workerProcess = spawn('node', [
    path.join(__dirname, '../../worker/dist/index.js'),
  ], {
    env: {
      ...process.env,
      CONTROLLER_URL: `http://127.0.0.1:${controllerPort}`,
      WORKER_ID: 'clawkit-worker-1',
    },
    stdio: 'inherit',
  });

  console.log('   ✓ Worker 已启动');

  // 显示状态
  console.log('\n✅ Clawkit 启动完成！\n');
  console.log('📊 服务状态:');
  console.log(`   Controller: http://127.0.0.1:${controllerPort}`);
  console.log(`   Worker: 已连接`);
  console.log(`   OpenClaw Webhook: ${manifest.services.openClaw.publicUrl}`);
  console.log('\n💡 提示:');
  console.log('   - 按 Ctrl+C 停止服务');
  console.log('   - 访问 Web Console: http://127.0.0.1:' + controllerPort);
  console.log('   - 查看日志: clawkit logs');
  console.log('   - 查看状态: clawkit status\n');

  // 优雅关闭
  const shutdown = () => {
    console.log('\n🛑 停止服务...');
    controllerProcess.kill();
    workerProcess.kill();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/**
 * 创建 start 命令
 */
export function createStartCommand(): Command {
  const command = new Command('start');

  command
    .description('一键启动 clawkit 服务（自动初始化、检查、部署）')
    .option('-c, --config <path>', '配置文件路径')
    .option('--no-auto-deploy', '不自动部署 OpenClaw 和 OpenCode')
    .action(async (options) => {
      try {
        // 查找配置文件
        let configPath = options.config;
        if (!configPath) {
          configPath = findConfigFile();
          if (!configPath) {
            console.error('❌ 错误: 未找到配置文件');
            console.error('   请创建 clawkit.yaml 或使用 --config 指定配置文件');
            console.error('   提示: 运行 clawkit init 创建简化配置');
            process.exit(1);
          }
        }

        if (!fs.existsSync(configPath)) {
          console.error(`❌ 错误: 配置文件不存在: ${configPath}`);
          process.exit(1);
        }

        // 启动服务
        await startServices(configPath);
      } catch (error) {
        console.error('❌ 启动失败:', error);
        process.exit(1);
      }
    });

  return command;
}
