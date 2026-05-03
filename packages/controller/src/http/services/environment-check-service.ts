import { spawnSync, type SpawnSyncReturns } from 'child_process';

import { CheckStatus, type CheckResult } from '@clawkit/shared';

export type EnvironmentCheckStatus = 'PASS' | 'WARN' | 'FAIL';

export interface EnvironmentCheckItem {
  name: string;
  status: EnvironmentCheckStatus;
  message: string;
  suggestion?: string;
}

export interface EnvironmentCheckResponse {
  overall: EnvironmentCheckStatus;
  checks: EnvironmentCheckItem[];
}

/**
 * Setup 向导环境快速检查服务。
 * 这里复用 CLI doctor 的检查规则，但保持 controller 侧输出为前端直接可消费的简化结构。
 */
export class EnvironmentCheckService {
  /** 单个命令检查最长执行时间，避免页面长时间卡住 */
  private readonly commandTimeoutMs = 5000;

  /** OpenClaw 默认本地端口 */
  private readonly openClawLocalPort = 18000;

  /** OpenCode 默认本地端口 */
  private readonly openCodeLocalPort = 4096;

  async checkEnvironment(): Promise<EnvironmentCheckResponse> {
    const checks = [
      this.toEnvironmentCheckItem(this.checkDockerAvailable()),
      this.toEnvironmentCheckItem(this.checkDockerCompose()),
      this.toEnvironmentCheckItem(this.checkOpenClawPort()),
      this.toEnvironmentCheckItem(this.checkOpenCodePort()),
    ];

    return {
      overall: this.resolveOverallStatus(checks),
      checks,
    };
  }

  /**
   * 检查 Docker 是否可用。
   */
  private checkDockerAvailable(): CheckResult {
    try {
      const result = this.runCommand('docker', ['--version']);

      if (this.isTimedOut(result)) {
        return this.buildTimeoutResult('Docker 可用性检查', 'docker --version');
      }

      if (result.status === 0) {
        const version = (result.stdout || '').trim();
        return {
          name: 'Docker 可用性检查',
          status: CheckStatus.PASS,
          message: version ? `Docker 可用：${version}` : 'Docker 可用',
        };
      }

      const stderr = (result.stderr || '').trim();
      return {
        name: 'Docker 可用性检查',
        status: CheckStatus.FAIL,
        message: `Docker 不可用：${stderr || '未检测到 docker 命令或执行失败'}`,
        suggestion: '请先安装并启动 Docker（Windows/macOS 推荐 Docker Desktop，Linux 请安装 docker engine 并确保当前用户有权限访问 docker）',
      };
    } catch (error) {
      return {
        name: 'Docker 可用性检查',
        status: CheckStatus.FAIL,
        message: `Docker 检查失败：${(error as Error).message}`,
        suggestion: '请确认 Docker 已正确安装，并且终端可以直接运行 docker 命令',
      };
    }
  }

  /**
   * 检查 Docker Compose V2 是否可用。
   */
  private checkDockerCompose(): CheckResult {
    try {
      const result = this.runCommand('docker', ['compose', 'version']);

      if (this.isTimedOut(result)) {
        return this.buildTimeoutResult('Docker Compose V2 检查', 'docker compose version');
      }

      if (result.status === 0) {
        const version = (result.stdout || '').trim();
        return {
          name: 'Docker Compose V2 检查',
          status: CheckStatus.PASS,
          message: version ? `Docker Compose 可用：${version}` : 'Docker Compose 可用',
        };
      }

      const stderr = (result.stderr || '').trim();
      return {
        name: 'Docker Compose V2 检查',
        status: CheckStatus.FAIL,
        message: `Docker Compose 不可用：${stderr || '无法执行 docker compose version'}`,
        suggestion: '请升级 Docker 到包含 Compose V2 的版本（Windows/macOS 可安装/升级 Docker Desktop；Linux 请安装 docker compose 插件或升级到新版本 Docker）',
      };
    } catch (error) {
      return {
        name: 'Docker Compose V2 检查',
        status: CheckStatus.FAIL,
        message: `Docker Compose 检查失败：${(error as Error).message}`,
        suggestion: '请确认 docker compose 命令可用（例如：docker compose version）',
      };
    }
  }

  /**
   * 检查 OpenClaw 本地端口是否被占用。
   */
  private checkOpenClawPort(): CheckResult {
    return this.checkPort(this.openClawLocalPort, 'OpenClaw');
  }

  /**
   * 检查 OpenCode 本地端口是否被占用。
   */
  private checkOpenCodePort(): CheckResult {
    return this.checkPort(this.openCodeLocalPort, 'OpenCode');
  }

  /**
   * 端口检查逻辑与 CLI doctor 保持一致：占用为 FAIL，命令缺失或权限不足为 WARN。
   */
  private checkPort(port: number, serviceName: 'OpenClaw' | 'OpenCode'): CheckResult {
    const checkName = `${serviceName} 端口 ${port} 检查`;

    try {
      if (process.platform === 'win32') {
        const result = this.runCommand('netstat', ['-ano', '-p', 'tcp']);

        if (this.isTimedOut(result)) {
          return this.buildTimeoutResult(checkName, 'netstat -ano -p tcp');
        }

        if (result.status !== 0) {
          const stderr = (result.stderr || '').trim();
          return {
            name: checkName,
            status: CheckStatus.WARN,
            message: `端口检查失败：无法执行 netstat：${stderr || '未知错误'}`,
            suggestion: `请手动检查端口是否被占用：netstat -ano -p tcp | findstr :${port}`,
          };
        }

        const output = `${result.stdout || ''}`;
        const lines = output.split(/\r?\n/);
        const listeningLines = lines.filter((line) => line.includes(`:${port}`) && /\bLISTENING\b/i.test(line));

        if (listeningLines.length > 0) {
          const pidMatch = listeningLines[0].trim().match(/\s(\d+)\s*$/);
          const pid = pidMatch?.[1];
          return {
            name: checkName,
            status: CheckStatus.FAIL,
            message: pid ? `端口 ${port} 已被占用（PID: ${pid}）` : `端口 ${port} 已被占用`,
            suggestion: pid
              ? `建议释放端口：\n1) 查看占用：netstat -ano -p tcp | findstr :${port}\n2) 结束进程：taskkill /PID ${pid} /F`
              : `建议释放端口：\n1) 查看占用：netstat -ano -p tcp | findstr :${port}\n2) 结束进程：taskkill /PID <pid> /F`,
          };
        }

        return {
          name: checkName,
          status: CheckStatus.PASS,
          message: `端口 ${port} 未被占用`,
        };
      }

      const result = this.runCommand('lsof', [`-iTCP:${port}`, '-sTCP:LISTEN', '-n', '-P']);

      if (this.isTimedOut(result)) {
        return this.buildTimeoutResult(checkName, `lsof -iTCP:${port} -sTCP:LISTEN -n -P`);
      }

      const stdout = (result.stdout || '').trim();
      const stderr = (result.stderr || '').trim();

      if (!stdout) {
        if (result.status === 0) {
          return {
            name: checkName,
            status: CheckStatus.PASS,
            message: `端口 ${port} 未被占用`,
          };
        }

        const looksLikeMissing = /not found|command not found|No such file/i.test(stderr);
        const looksLikePerm = /permission|not permitted|operation not permitted/i.test(stderr);

        if (looksLikeMissing) {
          return {
            name: checkName,
            status: CheckStatus.WARN,
            message: '端口检查失败：未找到 lsof 命令（无法自动检测端口占用）',
            suggestion: `建议安装 lsof 后重试，或手动检查：\n- macOS/Linux：lsof -iTCP:${port} -sTCP:LISTEN -n -P`,
          };
        }

        if (looksLikePerm) {
          return {
            name: checkName,
            status: CheckStatus.WARN,
            message: '端口检查失败：权限不足，无法执行 lsof 检查端口占用',
            suggestion: `可尝试使用 sudo 手动检查：sudo lsof -iTCP:${port} -sTCP:LISTEN -n -P`,
          };
        }

        return {
          name: checkName,
          status: CheckStatus.WARN,
          message: `端口检查失败：${stderr || '未知错误'}`,
          suggestion: `请手动检查端口是否被占用：lsof -iTCP:${port} -sTCP:LISTEN -n -P`,
        };
      }

      const firstLine = stdout.split(/\r?\n/)[0] || '';
      const columns = firstLine.trim().split(/\s+/);
      const pid = columns.length >= 2 ? columns[1] : undefined;

      return {
        name: checkName,
        status: CheckStatus.FAIL,
        message: pid ? `端口 ${port} 已被占用（PID: ${pid}）` : `端口 ${port} 已被占用`,
        suggestion: pid
          ? `建议释放端口：\n1) 查看占用：lsof -iTCP:${port} -sTCP:LISTEN -n -P\n2) 结束进程：kill -9 ${pid}`
          : `建议释放端口：\n1) 查看占用：lsof -iTCP:${port} -sTCP:LISTEN -n -P\n2) 结束进程：kill -9 <pid>`,
      };
    } catch (error) {
      return {
        name: checkName,
        status: CheckStatus.WARN,
        message: `端口检查异常：${(error as Error).message}`,
        suggestion: `请手动检查端口是否被占用（Windows: netstat；Linux/macOS: lsof），端口：${port}`,
      };
    }
  }

  /**
   * 统一设置命令超时，确保 Setup 向导能快速返回结果。
   */
  private runCommand(command: string, args: string[]): SpawnSyncReturns<string> {
    return spawnSync(command, args, {
      encoding: 'utf-8',
      timeout: this.commandTimeoutMs,
    });
  }

  /**
   * child_process 超时时会返回超时错误，这里统一识别，避免各检查重复判断。
   */
  private isTimedOut(result: SpawnSyncReturns<string>): boolean {
    return result.error?.name === 'Error' && result.error.message.includes('ETIMEDOUT');
  }

  /**
   * 将底层 doctor 状态映射为 API 约定的全大写状态。
   */
  private toEnvironmentCheckItem(result: CheckResult): EnvironmentCheckItem {
    return {
      name: result.name,
      status: this.toApiStatus(result.status),
      message: result.message,
      suggestion: result.suggestion,
    };
  }

  private toApiStatus(status: CheckStatus): EnvironmentCheckStatus {
    if (status === CheckStatus.FAIL) {
      return 'FAIL';
    }

    if (status === CheckStatus.WARN || status === CheckStatus.SKIP) {
      return 'WARN';
    }

    return 'PASS';
  }

  private resolveOverallStatus(checks: EnvironmentCheckItem[]): EnvironmentCheckStatus {
    if (checks.some((check) => check.status === 'FAIL')) {
      return 'FAIL';
    }

    if (checks.some((check) => check.status === 'WARN')) {
      return 'WARN';
    }

    return 'PASS';
  }

  private buildTimeoutResult(name: string, command: string): CheckResult {
    return {
      name,
      status: CheckStatus.FAIL,
      message: `检查超时：命令 ${command} 在 ${this.commandTimeoutMs / 1000} 秒内未完成`,
      suggestion: '请确认本机环境响应正常后重试，或手动执行对应命令排查阻塞原因',
    };
  }
}
