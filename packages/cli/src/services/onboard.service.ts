import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';

import type { Manifest } from '@clawkit/shared';
import { ManifestLoader } from './manifest-loader';
import { Logger } from '../utils/logger';

/**
 * Onboarding 服务
 * 辅助用户完成 OpenClaw 的配置流程
 */
export class OnboardService {
  private readonly loader = new ManifestLoader();

  /**
   * 执行 onboarding 流程
   */
  onboard(manifestPath: string): void {
    Logger.title('OpenClaw Onboarding 辅助');

    const context = this.loader.load(manifestPath);
    const manifest = context.manifest;

    // 检查 OpenClaw 部署模式
    if (manifest.services.openClaw.deployMode === 'skip') {
      Logger.warn('当前 manifest 配置为跳过 OpenClaw（deployMode=skip）');
      Logger.info('如需使用 OpenClaw，请修改 manifest 配置');
      return;
    }

    // 步骤 1：检查 OpenClaw 是否已启动
    Logger.divider();
    Logger.info('步骤 1/6：检查 OpenClaw 运行状态');
    
    const openclawUrl = this.getOpenClawUrl(manifest);
    const isRunning = this.checkOpenClawRunning(openclawUrl);

    if (!isRunning) {
      Logger.error(`OpenClaw 未运行或无法访问：${openclawUrl}`);
      
      if (manifest.services.openClaw.deployMode === 'local') {
        Logger.info('');
        Logger.info('请先启动 OpenClaw：');
        Logger.info('  cd ~/.openclaw');
        Logger.info('  docker compose up -d');
      } else {
        Logger.info('');
        Logger.info('请确保 OpenClaw 已在外部启动并可访问');
      }
      
      return;
    }

    Logger.success(`OpenClaw 运行正常：${openclawUrl}`);

    // 步骤 2：提示用户在 OpenClaw UI 创建账号
    Logger.divider();
    Logger.info('步骤 2/6：创建 OpenClaw 账号');
    Logger.info('');
    Logger.info(`请在浏览器中访问：${openclawUrl}`);
    Logger.info('如果是首次使用，请完成账号创建');
    Logger.info('');
    
    this.waitForUserConfirm('账号创建完成后，按回车继续...');

    // 步骤 3：生成建议的 webhook URL
    Logger.divider();
    Logger.info('步骤 3/6：配置 Webhook 地址');
    
    const controllerUrl = manifest.services.openClaw.publicUrl;
    const webhookUrl = `${controllerUrl}/api/openclaw/webhook`;
    
    Logger.info('');
    Logger.info('请在 OpenClaw 设置中配置以下 Webhook 地址：');
    Logger.success(`  ${webhookUrl}`);
    Logger.info('');
    
    this.waitForUserConfirm('Webhook 配置完成后，按回车继续...');

    // 步骤 4：生成或使用现有 token
    Logger.divider();
    Logger.info('步骤 4/6：配置 Webhook Token');
    
    let token = manifest.services.openClaw.apiKey?.trim();
    
    if (!token || token === 'replace-me') {
      token = this.generateToken();
      Logger.info('');
      Logger.info('已生成新的 webhook token：');
      Logger.success(`  ${token}`);
      Logger.info('');
      Logger.info('请在 OpenClaw 设置中配置此 token');
    } else {
      Logger.info('');
      Logger.info('当前 manifest 中已配置 token：');
      Logger.success(`  ${token}`);
      Logger.info('');
      Logger.info('请在 OpenClaw 设置中配置此 token');
    }
    
    Logger.info('');
    this.waitForUserConfirm('Token 配置完成后，按回车继续...');

    // 步骤 5：更新 manifest（如果需要）
    Logger.divider();
    Logger.info('步骤 5/6：更新 Manifest 配置');
    
    if (!manifest.services.openClaw.apiKey || manifest.services.openClaw.apiKey === 'replace-me') {
      Logger.info('');
      Logger.info('需要更新 manifest 中的 apiKey 配置：');
      Logger.info(`  文件路径：${manifestPath}`);
      Logger.info('  配置路径：services.openClaw.apiKey');
      Logger.info(`  新值：${token}`);
      Logger.info('');
      
      const shouldUpdate = this.askYesNo('是否自动更新 manifest？(y/n): ');
      
      if (shouldUpdate) {
        this.updateManifestToken(manifestPath, token);
        Logger.success('Manifest 已更新');
      } else {
        Logger.warn('请手动更新 manifest 中的 apiKey');
      }
    } else {
      Logger.success('Manifest 中已配置正确的 apiKey');
    }

    // 步骤 6：提示重启 controller
    Logger.divider();
    Logger.info('步骤 6/6：重启 Controller');
    Logger.info('');
    Logger.info('为使新配置生效，需要重启 controller：');
    Logger.info('');
    Logger.info('如果使用 quick-start.sh 启动：');
    Logger.info('  kill $(cat .clawkit/controller.pid)');
    Logger.info('  ./scripts/quick-start.sh');
    Logger.info('');
    Logger.info('如果使用 systemd：');
    Logger.info('  systemctl restart clawkit-controller');
    Logger.info('');

    // 完成
    Logger.divider();
    Logger.success('Onboarding 辅助流程完成！');
    Logger.info('');
    Logger.info('下一步：');
    Logger.info('  1. 重启 controller 使配置生效');
    Logger.info('  2. 在 OpenClaw 中发送测试任务');
    Logger.info('  3. 查看 controller 日志确认任务接收');
  }

  /**
   * 获取 OpenClaw URL
   */
  private getOpenClawUrl(manifest: Manifest): string {
    if (manifest.services.openClaw.deployMode === 'local') {
      return `http://127.0.0.1:${this.resolveOpenClawLocalPort(manifest)}`;
    }
    
    return manifest.services.openClaw.publicUrl;
  }

  private resolveOpenClawLocalPort(manifest: Manifest): number {
    try {
      const url = new URL(manifest.services.openClaw.publicUrl);
      const parsed = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
      return Number.isInteger(parsed) && parsed > 0 ? parsed : 18000;
    } catch {
      return 18000;
    }
  }

  /**
   * 检查 OpenClaw 是否运行
   */
  private checkOpenClawRunning(url: string): boolean {
    try {
      const result = spawnSync('curl', ['-f', '-s', '-o', '/dev/null', '-w', '%{http_code}', `${url}/healthz`], {
        encoding: 'utf8',
        timeout: 5000,
      });

      return result.status === 0 && result.stdout.trim() === '200';
    } catch {
      return false;
    }
  }

  /**
   * 生成安全的 token
   */
  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * 等待用户确认
   */
  private waitForUserConfirm(message: string): void {
    process.stdout.write(message);
    
    // 读取一行输入
    const buffer = Buffer.alloc(1024);
    fs.readSync(0, buffer, 0, buffer.length, null);
  }

  /**
   * 询问 yes/no 问题
   */
  private askYesNo(question: string): boolean {
    process.stdout.write(question);
    
    const buffer = Buffer.alloc(1024);
    const bytesRead = fs.readSync(0, buffer, 0, buffer.length, null);
    const answer = buffer.toString('utf8', 0, bytesRead).trim().toLowerCase();
    
    return answer === 'y' || answer === 'yes';
  }

  /**
   * 更新 manifest 中的 token
   */
  private updateManifestToken(manifestPath: string, token: string): void {
    const content = fs.readFileSync(manifestPath, 'utf8');
    
    // 简单的字符串替换（假设 apiKey 在一行中）
    const updatedContent = content.replace(
      /apiKey:\s*["']?[^"'\n]*["']?/,
      `apiKey: "${token}"`
    );
    
    // 备份原文件
    const backupPath = `${manifestPath}.${this.buildTimestamp()}.bak`;
    fs.copyFileSync(manifestPath, backupPath);
    Logger.info(`已备份原文件：${backupPath}`);
    
    // 写入新内容
    fs.writeFileSync(manifestPath, updatedContent, 'utf8');
  }

  /**
   * 生成时间戳
   */
  private buildTimestamp(): string {
    const now = new Date();
    const pad = (value: number): string => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }
}
