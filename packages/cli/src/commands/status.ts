/**
 * status 命令
 * 查看 clawkit 服务状态
 */

import { Command } from 'commander';
import * as fs from 'fs';
import axios from 'axios';
import { loadManifest } from '@clawkit/shared';

const DEFAULT_CONFIG_PATH = './clawkit.yaml';

/**
 * 检查服务状态
 */
async function checkServiceStatus(url: string, name: string): Promise<{
  running: boolean;
  message: string;
}> {
  try {
    const response = await axios.get(`${url}/health`, { timeout: 3000 });
    if (response.status === 200) {
      return { running: true, message: '运行中' };
    }
    return { running: false, message: '状态异常' };
  } catch (error) {
    return { running: false, message: '未运行' };
  }
}

/**
 * 获取 Worker 状态
 */
async function getWorkerStatus(controllerUrl: string): Promise<{
  total: number;
  online: number;
  workers: Array<{ id: string; status: string; name: string }>;
}> {
  try {
    const response = await axios.get(`${controllerUrl}/api/workers`, { timeout: 3000 });
    const workers = response.data.data || [];
    return {
      total: workers.length,
      online: workers.filter((w: any) => w.status === 'idle' || w.status === 'busy').length,
      workers: workers.map((w: any) => ({
        id: w.workerId,
        status: w.status,
        name: w.name,
      })),
    };
  } catch (error) {
    return { total: 0, online: 0, workers: [] };
  }
}

/**
 * 获取任务统计
 */
async function getTaskStats(controllerUrl: string): Promise<{
  total: number;
  running: number;
  completed: number;
  failed: number;
}> {
  try {
    const response = await axios.get(`${controllerUrl}/api/tasks`, { timeout: 3000 });
    const tasks = response.data.data?.tasks || [];
    return {
      total: tasks.length,
      running: tasks.filter((t: any) => t.status === 'running' || t.status === 'dispatched').length,
      completed: tasks.filter((t: any) => t.status === 'completed').length,
      failed: tasks.filter((t: any) => t.status === 'failed').length,
    };
  } catch (error) {
    return { total: 0, running: 0, completed: 0, failed: 0 };
  }
}

/**
 * 显示状态
 */
async function showStatus(options: { config?: string; verbose?: boolean }): Promise<void> {
  const configPath = options.config || DEFAULT_CONFIG_PATH;

  console.log('🔍 检查 Clawkit 服务状态...\n');

  // 加载配置
  if (!fs.existsSync(configPath)) {
    console.error(`❌ 错误: 配置文件不存在: ${configPath}`);
    process.exit(1);
  }

  const manifest = loadManifest(configPath);
  const controllerUrl = manifest.services.controller.publicUrl;
  const openClawUrl = manifest.services.openClaw.publicUrl;
  const openCodeUrl = manifest.services.openCode?.publicUrl;

  // 检查 Controller
  console.log('📊 服务状态:');
  const controllerStatus = await checkServiceStatus(controllerUrl, 'Controller');
  console.log(`   Controller: ${controllerStatus.running ? '✅' : '❌'} ${controllerStatus.message}`);
  console.log(`              ${controllerUrl}`);

  // 检查 OpenClaw
  const openClawStatus = await checkServiceStatus(openClawUrl, 'OpenClaw');
  console.log(`   OpenClaw:   ${openClawStatus.running ? '✅' : '❌'} ${openClawStatus.message}`);
  console.log(`              ${openClawUrl}`);

  // 检查 OpenCode
  if (openCodeUrl) {
    const openCodeStatus = await checkServiceStatus(openCodeUrl, 'OpenCode');
    console.log(`   OpenCode:   ${openCodeStatus.running ? '✅' : '❌'} ${openCodeStatus.message}`);
    console.log(`              ${openCodeUrl}`);
  }

  // 如果 Controller 运行中，获取详细信息
  if (controllerStatus.running) {
    console.log('\n👷 Worker 状态:');
    const workerStatus = await getWorkerStatus(controllerUrl);
    console.log(`   总数: ${workerStatus.total}`);
    console.log(`   在线: ${workerStatus.online}`);

    if (options.verbose && workerStatus.workers.length > 0) {
      console.log('\n   详细信息:');
      workerStatus.workers.forEach((worker) => {
        const statusIcon = worker.status === 'idle' ? '🟢' : worker.status === 'busy' ? '🟡' : '🔴';
        console.log(`   ${statusIcon} ${worker.id} (${worker.name}) - ${worker.status}`);
      });
    }

    console.log('\n📋 任务统计:');
    const taskStats = await getTaskStats(controllerUrl);
    console.log(`   总数: ${taskStats.total}`);
    console.log(`   运行中: ${taskStats.running}`);
    console.log(`   已完成: ${taskStats.completed}`);
    console.log(`   失败: ${taskStats.failed}`);
  }

  console.log('\n💡 提示:');
  if (!controllerStatus.running) {
    console.log('   - 启动服务: clawkit start');
  } else {
    console.log('   - 查看日志: clawkit logs');
    console.log('   - Web Console: ' + controllerUrl);
  }
  console.log('');
}

/**
 * 创建 status 命令
 */
export function createStatusCommand(): Command {
  const command = new Command('status');

  command
    .description('查看 clawkit 服务状态')
    .option('-c, --config <path>', '配置文件路径', DEFAULT_CONFIG_PATH)
    .option('-v, --verbose', '显示详细信息')
    .action(async (options) => {
      try {
        await showStatus(options);
      } catch (error) {
        console.error('❌ 获取状态失败:', error);
        process.exit(1);
      }
    });

  return command;
}
