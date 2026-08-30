import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync, spawnSync } from 'child_process';
import {
  CheckStatus,
  loadManifest,
} from '@clawkit/shared';
import type {
  CheckResult,
  DoctorReport,
  Manifest,
} from '@clawkit/shared';
import * as yaml from 'yaml';

export class DoctorServiceImpl {
  /** Node.js 最低版本要求 */
  private readonly minNodeVersion = '20.0.0';

  /** OpenClaw 默认本地端口（仅 deployMode=local 时检查） */
  private readonly openClawLocalPort = 18000;

  /** OpenCode 默认本地端口（仅 installMode=local 时检查） */
  private readonly openCodeLocalPort = 4096;

  /**
   * 执行完整诊断
   * @param manifestPath manifest 文件路径
   * @returns 诊断报告
   */
  async diagnose(manifestPath: string): Promise<DoctorReport> {
    const checks: CheckResult[] = [];

    // 1. 检查文件是否存在
    const fileCheck = this.checkFileExists(manifestPath);
    checks.push(fileCheck);

    if (fileCheck.status === CheckStatus.FAIL) {
      return this.buildReport(manifestPath, checks);
    }

    // 2. 读取并校验 manifest
    const parseResult = this.parseAndValidate(manifestPath);
    checks.push(parseResult.syntaxCheck);

    if (parseResult.schemaCheck) {
      checks.push(parseResult.schemaCheck);
    }

    if (parseResult.validationErrors) {
      checks.push(...parseResult.validationErrors);
    }

    // 如果 schema 校验失败，后续依赖 manifest 的检查跳过
    if (!parseResult.manifest) {
      // 3-7 全部跳过
      checks.push(this.skipCheck('Node.js 版本检查', '配置文件校验未通过，跳过环境检查'));
      checks.push(this.skipCheck('pnpm 可用性检查', '配置文件校验未通过，跳过环境检查'));
      checks.push(this.skipCheck('repoPath 存在性检查', '配置文件校验未通过，跳过路径检查'));
      checks.push(this.skipCheck('端口有效性检查', '配置文件校验未通过，跳过端口检查'));
      checks.push(this.skipCheck('SSH 节点结构检查', '配置文件校验未通过，跳过节点检查'));
      return this.buildReport(manifestPath, checks);
    }

    // 3. 检查 Node.js 版本
    checks.push(this.checkNodeVersion());

    // 4. 检查 pnpm 是否可用
    checks.push(this.checkPnpm());

    // 4.1 OpenClaw 本地部署环境检查（仅 deployMode=local 时执行）
    const deployMode = parseResult.manifest.services.openClaw.deployMode;
    const openClawLocalPort = this.resolveOpenClawLocalPort(parseResult.manifest);
    if (deployMode !== 'local') {
      const skipMessage = `跳过（deployMode: ${deployMode}）`;
      checks.push(this.skipCheck('Docker 可用性检查', skipMessage));
      checks.push(this.skipCheck('Docker Compose V2 检查', skipMessage));
      checks.push(this.skipCheck(`OpenClaw 端口 ${openClawLocalPort} 检查`, skipMessage));
    } else {
      // 检查顺序：Docker 可用性 → Docker Compose V2 → 端口
      const dockerCheck = this.checkDockerAvailable();
      checks.push(dockerCheck);

      if (dockerCheck.status === CheckStatus.FAIL) {
        // Docker 不可用时，后续检查全部跳过，避免误导
        checks.push(this.skipCheck('Docker Compose V2 检查', 'Docker 不可用，跳过后续检查'));
        checks.push(this.skipCheck(`OpenClaw 端口 ${openClawLocalPort} 检查`, 'Docker 不可用，跳过后续检查'));
      } else {
        checks.push(this.checkDockerCompose());
        checks.push(this.checkOpenClawPort(openClawLocalPort));
      }
    }

    // 4.2 OpenCode 一键安装环境检查（仅 installMode=local 时执行）
    const installMode = this.getOpenCodeInstallMode(parseResult.manifest);
    const openCodeLocalPort = this.resolveOpenCodeLocalPort(parseResult.manifest);
    if (installMode !== 'local') {
      const skipMessage = `跳过（installMode: ${installMode}）`;
      checks.push(this.skipCheck('curl 可用性检查（OpenCode 安装）', skipMessage));
      checks.push(this.skipCheck('bash 可用性检查（OpenCode 安装）', skipMessage));
      checks.push(this.skipCheck(`OpenCode 端口 ${openCodeLocalPort} 检查`, skipMessage));
      checks.push(this.skipCheck('OpenCode 安装状态检查', skipMessage));
    } else {
      // 检查顺序：curl → bash → 端口 → 是否已安装
      const curlCheck = this.checkCurlAvailable();
      checks.push(curlCheck);

      const bashCheck = this.checkBashAvailable();
      checks.push(bashCheck);

      if (curlCheck.status === CheckStatus.FAIL || bashCheck.status === CheckStatus.FAIL) {
        // curl 或 bash 不可用时，后续检查全部跳过，避免误导
        checks.push(this.skipCheck(`OpenCode 端口 ${openCodeLocalPort} 检查`, 'curl 或 bash 不可用，跳过后续检查'));
        checks.push(this.skipCheck('OpenCode 安装状态检查', 'curl 或 bash 不可用，跳过后续检查'));
      } else {
        checks.push(this.checkOpenCodePort(openCodeLocalPort));
        checks.push(this.checkOpenCodeInstalled());
      }
    }

    // 4.3 校验部署和通知配置，避免高级配置被静默忽略
    checks.push(this.checkDeployConfig(parseResult.manifest));
    checks.push(this.checkNotifyConfig(parseResult.manifest));

    // 5. 检查 repoPath 是否存在
    checks.push(...this.checkRepoPaths(parseResult.manifest));

    // 6. 检查端口字段是否为有效数字
    checks.push(...this.checkPorts(parseResult.manifest));

    // 7. 检查 SSH 节点字段结构是否完整
    checks.push(...this.checkSshNodes(parseResult.manifest));

    return this.buildReport(manifestPath, checks);
  }

  /**
   * 检查 Docker 是否可用（仅用于 deployMode=local 的 OpenClaw 部署前置校验）
   */
  private checkDockerAvailable(): CheckResult {
    try {
      const result = spawnSync('docker', ['--version'], {
        encoding: 'utf-8',
      });

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
   * 检查 Docker Compose V2 是否可用（注意：命令为 `docker compose`，不是 `docker-compose`）
   */
  private checkDockerCompose(): CheckResult {
    try {
      const result = spawnSync('docker', ['compose', 'version'], {
        encoding: 'utf-8',
      });

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
   * 检查 OpenClaw 本地端口是否冲突
   * - Windows：使用 netstat
   * - Linux/macOS：使用 lsof
   *
   * 端口冲突：FAIL（阻塞）
   * 检查失败：WARN（非阻塞）
   */
  private checkOpenClawPort(port: number): CheckResult {
    try {
      if (process.platform === 'win32') {
        const result = spawnSync('netstat', ['-ano', '-p', 'tcp'], {
          encoding: 'utf-8',
        });

        if (result.status !== 0) {
          const stderr = (result.stderr || '').trim();
          return {
            name: `OpenClaw 端口 ${port} 检查`,
            status: CheckStatus.WARN,
            message: `端口检查失败：无法执行 netstat：${stderr || '未知错误'}`,
            suggestion: `请手动检查端口是否被占用：netstat -ano -p tcp | findstr :${port}`,
          };
        }

        const output = `${result.stdout || ''}`;
        const lines = output.split(/\r?\n/);
        const listeningLines = lines.filter((line) => line.includes(`:${port}`) && /\bLISTENING\b/i.test(line));

        if (listeningLines.length > 0) {
          // 尝试提取 PID（netstat 输出末尾通常是 PID）
          const pidMatch = listeningLines[0].trim().match(/\s(\d+)\s*$/);
          const pid = pidMatch?.[1];

          return {
            name: `OpenClaw 端口 ${port} 检查`,
            status: CheckStatus.FAIL,
            message: pid ? `端口 ${port} 已被占用（PID: ${pid}）` : `端口 ${port} 已被占用`,
            suggestion: pid
              ? `建议释放端口：\n1) 查看占用：netstat -ano -p tcp | findstr :${port}\n2) 结束进程：taskkill /PID ${pid} /F`
              : `建议释放端口：\n1) 查看占用：netstat -ano -p tcp | findstr :${port}\n2) 结束进程：taskkill /PID <pid> /F`,
          };
        }

        return {
          name: `OpenClaw 端口 ${port} 检查`,
          status: CheckStatus.PASS,
          message: `端口 ${port} 未被占用`,
        };
      }

      // Linux/macOS
      const result = spawnSync('lsof', [`-iTCP:${port}`, '-sTCP:LISTEN', '-n', '-P'], {
        encoding: 'utf-8',
      });

      // lsof：未找到占用时通常返回非 0；因此先根据输出判断
      const stdout = (result.stdout || '').trim();
      const stderr = (result.stderr || '').trim();

      if (!stdout) {
        if (result.status === 0) {
          // 极少数情况下：返回 0 但无输出，视为未占用
          return {
            name: `OpenClaw 端口 ${port} 检查`,
            status: CheckStatus.PASS,
            message: `端口 ${port} 未被占用`,
          };
        }

        // 无输出且非 0：可能是“未找到”也可能是“命令不可用/权限不足”
        const looksLikeMissing = /not found|command not found|No such file/i.test(stderr);
        const looksLikePerm = /permission|not permitted|operation not permitted/i.test(stderr);

        if (looksLikeMissing) {
          return {
            name: `OpenClaw 端口 ${port} 检查`,
            status: CheckStatus.WARN,
            message: '端口检查失败：未找到 lsof 命令（无法自动检测端口占用）',
            suggestion: `建议安装 lsof 后重试，或手动检查：\n- macOS/Linux：lsof -iTCP:${port} -sTCP:LISTEN -n -P`,
          };
        }

        if (looksLikePerm) {
          return {
            name: `OpenClaw 端口 ${port} 检查`,
            status: CheckStatus.WARN,
            message: '端口检查失败：权限不足，无法执行 lsof 检查端口占用',
            suggestion: `可尝试使用 sudo 运行 doctor，或手动检查：sudo lsof -iTCP:${port} -sTCP:LISTEN -n -P`,
          };
        }

        // 其他未知错误：非阻塞 WARN
        return {
          name: `OpenClaw 端口 ${port} 检查`,
          status: CheckStatus.WARN,
          message: `端口检查失败：${stderr || '未知错误'}`,
          suggestion: `请手动检查端口是否被占用：lsof -iTCP:${port} -sTCP:LISTEN -n -P`,
        };
      }

      // 有输出：认为端口被占用
      const firstLine = stdout.split(/\r?\n/)[0] || '';
      // lsof 输出列通常为：COMMAND PID USER ...
      const columns = firstLine.trim().split(/\s+/);
      const pid = columns.length >= 2 ? columns[1] : undefined;

      return {
        name: `OpenClaw 端口 ${port} 检查`,
        status: CheckStatus.FAIL,
        message: pid ? `端口 ${port} 已被占用（PID: ${pid}）` : `端口 ${port} 已被占用`,
        suggestion: pid
          ? `建议释放端口：\n1) 查看占用：lsof -iTCP:${port} -sTCP:LISTEN -n -P\n2) 结束进程：kill -9 ${pid}`
          : `建议释放端口：\n1) 查看占用：lsof -iTCP:${port} -sTCP:LISTEN -n -P\n2) 结束进程：kill -9 <pid>`,
      };
    } catch (error) {
      return {
        name: `OpenClaw 端口 ${port} 检查`,
        status: CheckStatus.WARN,
        message: `端口检查异常：${(error as Error).message}`,
        suggestion: `请手动检查端口是否被占用（Windows: netstat；Linux/macOS: lsof），端口：${port}`,
      };
    }
  }

  /**
   * 读取 OpenCode 安装模式（兼容 Schema 尚未更新的情况）
   * @returns local | external | skip | unknown
   */
  private getOpenCodeInstallMode(manifest: Manifest): 'local' | 'external' | 'skip' | 'unknown' {
    const rawMode = (manifest as unknown as { services?: { openCode?: { installMode?: unknown } } }).services?.openCode?.installMode;
    if (rawMode === 'local' || rawMode === 'external' || rawMode === 'skip') {
      return rawMode;
    }
    return 'unknown';
  }

  private resolveOpenClawLocalPort(manifest: Manifest): number {
    try {
      const url = new URL(manifest.services.openClaw.publicUrl);
      const parsed = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
      return Number.isInteger(parsed) && parsed > 0 ? parsed : this.openClawLocalPort;
    } catch {
      return this.openClawLocalPort;
    }
  }

  private resolveOpenCodeLocalPort(manifest: Manifest): number {
    for (const worker of manifest.workers) {
      const project = worker.projects.find((item) => item.openCode.port && item.openCode.port > 0);
      if (project && project.openCode.port) {
        return project.openCode.port;
      }
    }

    return this.openCodeLocalPort;
  }

  /**
   * 检查 curl 是否可用（OpenCode installMode=local 时必需）
   */
  private checkCurlAvailable(): CheckResult {
    try {
      const result = spawnSync('curl', ['--version'], {
        encoding: 'utf-8',
      });

      if (result.status === 0) {
        const firstLine = `${result.stdout || ''}`.split(/\r?\n/)[0]?.trim();
        return {
          name: 'curl 可用性检查（OpenCode 安装）',
          status: CheckStatus.PASS,
          message: firstLine ? `curl 可用：${firstLine}` : 'curl 可用',
        };
      }

      const stderr = (result.stderr || '').trim();
      return {
        name: 'curl 可用性检查（OpenCode 安装）',
        status: CheckStatus.FAIL,
        message: `curl 不可用：${stderr || '未检测到 curl 命令或执行失败'}`,
        suggestion: '请先安装 curl，或将 installMode 改为 external/skip',
      };
    } catch (error) {
      return {
        name: 'curl 可用性检查（OpenCode 安装）',
        status: CheckStatus.FAIL,
        message: `curl 检查失败：${(error as Error).message}`,
        suggestion: '请先安装 curl，或将 installMode 改为 external/skip',
      };
    }
  }

  /**
   * 检查 bash 是否可用（OpenCode installMode=local 时必需）
   */
  private checkBashAvailable(): CheckResult {
    try {
      const result = spawnSync('bash', ['--version'], {
        encoding: 'utf-8',
      });

      if (result.status === 0) {
        const firstLine = `${result.stdout || ''}`.split(/\r?\n/)[0]?.trim();
        return {
          name: 'bash 可用性检查（OpenCode 安装）',
          status: CheckStatus.PASS,
          message: firstLine ? `bash 可用：${firstLine}` : 'bash 可用',
        };
      }

      const stderr = (result.stderr || '').trim();
      return {
        name: 'bash 可用性检查（OpenCode 安装）',
        status: CheckStatus.FAIL,
        message: `bash 不可用：${stderr || '未检测到 bash 命令或执行失败'}`,
        suggestion: '请先安装 bash，或将 installMode 改为 external/skip',
      };
    } catch (error) {
      return {
        name: 'bash 可用性检查（OpenCode 安装）',
        status: CheckStatus.FAIL,
        message: `bash 检查失败：${(error as Error).message}`,
        suggestion: '请先安装 bash，或将 installMode 改为 external/skip',
      };
    }
  }

  /**
   * 检查 OpenCode 本地端口是否冲突
   * - Windows：使用 netstat
   * - Linux/macOS：使用 lsof
   *
   * 端口冲突：FAIL（阻塞）
   * 检查失败：WARN（非阻塞）
   */
  private checkOpenCodePort(port: number): CheckResult {
    try {
      if (process.platform === 'win32') {
        const result = spawnSync('netstat', ['-ano', '-p', 'tcp'], {
          encoding: 'utf-8',
        });

        if (result.status !== 0) {
          const stderr = (result.stderr || '').trim();
          return {
            name: `OpenCode 端口 ${port} 检查`,
            status: CheckStatus.WARN,
            message: `端口检查失败：无法执行 netstat：${stderr || '未知错误'}`,
            suggestion: `请手动检查端口是否被占用：netstat -aon | findstr :${port}`,
          };
        }

        const output = `${result.stdout || ''}`;
        const lines = output.split(/\r?\n/);
        const listeningLines = lines.filter((line) => line.includes(`:${port}`) && /\bLISTENING\b/i.test(line));

        if (listeningLines.length > 0) {
          // 尝试提取 PID（netstat 输出末尾通常是 PID）
          const pidMatch = listeningLines[0].trim().match(/\s(\d+)\s*$/);
          const pid = pidMatch?.[1];

          return {
            name: `OpenCode 端口 ${port} 检查`,
            status: CheckStatus.FAIL,
            message: pid ? `端口 ${port} 已被占用（PID: ${pid}）` : `端口 ${port} 已被占用`,
            suggestion: pid
              ? `建议释放端口：\n1) 查看占用：netstat -aon | findstr :${port}\n2) 结束进程：taskkill /PID ${pid} /F\n或将 installMode 改为 external/skip`
              : `建议释放端口：\n1) 查看占用：netstat -aon | findstr :${port}\n2) 结束进程：taskkill /PID <pid> /F\n或将 installMode 改为 external/skip`,
          };
        }

        return {
          name: `OpenCode 端口 ${port} 检查`,
          status: CheckStatus.PASS,
          message: `端口 ${port} 未被占用`,
        };
      }

      // Linux/macOS
      const result = spawnSync('lsof', [`-iTCP:${port}`, '-sTCP:LISTEN', '-n', '-P'], {
        encoding: 'utf-8',
      });

      // lsof：未找到占用时通常返回非 0；因此先根据输出判断
      const stdout = (result.stdout || '').trim();
      const stderr = (result.stderr || '').trim();

      if (!stdout) {
        if (result.status === 0) {
          // 极少数情况下：返回 0 但无输出，视为未占用
          return {
            name: `OpenCode 端口 ${port} 检查`,
            status: CheckStatus.PASS,
            message: `端口 ${port} 未被占用`,
          };
        }

        // 无输出且非 0：可能是“未找到”也可能是“命令不可用/权限不足”
        const looksLikeMissing = /not found|command not found|No such file/i.test(stderr);
        const looksLikePerm = /permission|not permitted|operation not permitted/i.test(stderr);

        if (looksLikeMissing) {
          return {
            name: `OpenCode 端口 ${port} 检查`,
            status: CheckStatus.WARN,
            message: '端口检查失败：未找到 lsof 命令（无法自动检测端口占用）',
            suggestion: `建议安装 lsof 后重试，或手动检查：\n- macOS/Linux：lsof -iTCP:${port} -sTCP:LISTEN -n -P`,
          };
        }

        if (looksLikePerm) {
          return {
            name: `OpenCode 端口 ${port} 检查`,
            status: CheckStatus.WARN,
            message: '端口检查失败：权限不足，无法执行 lsof 检查端口占用',
            suggestion: `可尝试使用 sudo 运行 doctor，或手动检查：sudo lsof -iTCP:${port} -sTCP:LISTEN -n -P`,
          };
        }

        // 其他未知错误：非阻塞 WARN
        return {
          name: `OpenCode 端口 ${port} 检查`,
          status: CheckStatus.WARN,
          message: `端口检查失败：${stderr || '未知错误'}`,
          suggestion: `请手动检查端口是否被占用：lsof -iTCP:${port} -sTCP:LISTEN -n -P`,
        };
      }

      // 有输出：认为端口被占用
      const firstLine = stdout.split(/\r?\n/)[0] || '';
      // lsof 输出列通常为：COMMAND PID USER ...
      const columns = firstLine.trim().split(/\s+/);
      const pid = columns.length >= 2 ? columns[1] : undefined;

      return {
        name: `OpenCode 端口 ${port} 检查`,
        status: CheckStatus.FAIL,
        message: pid ? `端口 ${port} 已被占用（PID: ${pid}）` : `端口 ${port} 已被占用`,
        suggestion: `建议释放端口：\n- macOS/Linux：lsof -ti:${port} | xargs kill\n或将 installMode 改为 external/skip`,
      };
    } catch (error) {
      return {
        name: `OpenCode 端口 ${port} 检查`,
        status: CheckStatus.WARN,
        message: `端口检查异常：${(error as Error).message}`,
        suggestion: `请手动检查端口是否被占用（Windows: netstat；Linux/macOS: lsof），端口：${port}`,
      };
    }
  }

  /**
   * 检查 OpenCode 是否已安装（非阻塞提示）
   */
  private checkOpenCodeInstalled(): CheckResult {
    const homeDir = os.homedir();
    const opencodeBinPath = path.join(homeDir, '.opencode', 'bin', 'opencode');
    const opencodeExePath = `${opencodeBinPath}.exe`;

    const exists = fs.existsSync(opencodeBinPath) || fs.existsSync(opencodeExePath);
    if (exists) {
      return {
        name: 'OpenCode 安装状态检查',
        status: CheckStatus.PASS,
        message: 'OpenCode 已安装：~/.opencode/bin/opencode（将跳过安装步骤）',
      };
    }

    return {
      name: 'OpenCode 安装状态检查',
      status: CheckStatus.WARN,
      message: 'OpenCode 未安装，将由 install_opencode 步骤自动安装',
    };
  }

  /**
   * 检查 manifest 文件是否存在
   */
  private checkFileExists(filePath: string): CheckResult {
    const absPath = path.resolve(filePath);
    if (fs.existsSync(absPath)) {
      return {
        name: 'Manifest 文件存在性',
        status: CheckStatus.PASS,
        message: `配置文件存在：${filePath}`,
      };
    }

    return {
      name: 'Manifest 文件存在性',
      status: CheckStatus.FAIL,
      message: `配置文件不存在：${filePath}`,
      suggestion: '请先运行 clawkit init 生成配置文件',
    };
  }

  /**
   * 读取、解析并校验 manifest
   */
  private parseAndValidate(filePath: string): {
    syntaxCheck: CheckResult;
    schemaCheck?: CheckResult;
    validationErrors?: CheckResult[];
    manifest?: Manifest;
  } {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
      yaml.parseDocument(content, { strict: true }).errors.forEach((error) => {
        throw error;
      });
    } catch (error) {
      return {
        syntaxCheck: {
          name: 'YAML 语法检查',
          status: CheckStatus.FAIL,
          message: `YAML 解析失败：${(error as Error).message}`,
          suggestion: '请检查 YAML 格式是否正确，是否有缩进错误或特殊字符',
        },
      };
    }
    const syntaxCheck: CheckResult = {
      name: 'YAML 语法检查',
      status: CheckStatus.PASS,
      message: 'YAML 语法正确',
    };

    try {
      const manifest = loadManifest(filePath);
      return {
        syntaxCheck,
        schemaCheck: {
          name: 'Schema 校验',
          status: CheckStatus.PASS,
          message: '配置文件符合 Schema 定义（支持简化版、V1 和 V2）',
        },
        manifest,
      };
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('YAML')) {
        return {
          syntaxCheck: {
            name: 'YAML 语法检查',
            status: CheckStatus.FAIL,
            message,
            suggestion: '请检查 YAML 格式是否正确，是否有缩进错误或特殊字符',
          },
        };
      }
      return {
        syntaxCheck,
        schemaCheck: {
          name: 'Schema 校验',
          status: CheckStatus.FAIL,
          message,
        },
        validationErrors: [{
          name: 'Schema 校验详情',
          status: CheckStatus.FAIL,
          message,
          suggestion: '请检查 manifest 字段和引用是否正确',
        }],
      };
    }
  }

  /**
   * 检查 Node.js 版本
   */
  private checkNodeVersion(): CheckResult {
    try {
      const version = process.version.replace('v', '');
      const meets = this.compareVersions(version, this.minNodeVersion) >= 0;

      if (meets) {
        return {
          name: 'Node.js 版本检查',
          status: CheckStatus.PASS,
          message: `Node.js ${process.version} >= ${this.minNodeVersion}`,
        };
      }

      return {
        name: 'Node.js 版本检查',
        status: CheckStatus.FAIL,
        message: `Node.js ${process.version} 低于最低要求 ${this.minNodeVersion}`,
        suggestion: '请升级 Node.js 到 20.0.0 或更高版本',
      };
    } catch (error) {
      return {
        name: 'Node.js 版本检查',
        status: CheckStatus.FAIL,
        message: `无法检测 Node.js 版本：${(error as Error).message}`,
      };
    }
  }

  /**
   * 检查 pnpm 是否可用
   */
  private checkPnpm(): CheckResult {
    try {
      const version = execSync('pnpm --version', { encoding: 'utf-8' }).trim();
      return {
        name: 'pnpm 可用性检查',
        status: CheckStatus.PASS,
        message: `pnpm ${version} 已安装`,
      };
    } catch {
      return {
        name: 'pnpm 可用性检查',
        status: CheckStatus.WARN,
        message: 'pnpm 未安装或不可用',
        suggestion: '建议安装 pnpm：npm install -g pnpm',
      };
    }
  }

  /**
   * 检查所有 worker 项目的 repoPath 是否存在
   */
  private checkRepoPaths(manifest: Manifest): CheckResult[] {
    const results: CheckResult[] = [];

    for (const worker of manifest.workers) {
      for (const project of worker.projects) {
        // 只检查本地节点的 repoPath
        const node = manifest.nodes[worker.node];
        if (node && node.type === 'local') {
          if (fs.existsSync(project.repoPath)) {
            results.push({
              name: `repoPath 存在性 [${project.key}]`,
              status: CheckStatus.PASS,
              message: `项目 ${project.key} 的仓库路径存在：${project.repoPath}`,
            });
          } else {
            results.push({
              name: `repoPath 存在性 [${project.key}]`,
              status: CheckStatus.WARN,
              message: `项目 ${project.key} 的仓库路径不存在：${project.repoPath}`,
              suggestion: '请确认仓库路径是否正确，或先克隆仓库到指定路径',
            });
          }
        } else {
          // SSH 节点的 repoPath 无法在本地检查
          results.push({
            name: `repoPath 存在性 [${project.key}]`,
            status: CheckStatus.SKIP,
            message: `项目 ${project.key} 位于远程节点 ${worker.node}，跳过本地路径检查`,
          });
        }
      }
    }

    // 如果没有任何项目，给一个总结
    if (results.length === 0) {
      results.push({
        name: 'repoPath 存在性检查',
        status: CheckStatus.SKIP,
        message: '未找到需要检查的项目路径',
      });
    }

    return results;
  }

  /**
   * 检查端口字段是否为有效数字
   * Schema 已经做了基本的类型校验，这里做额外的业务级检查（如端口冲突）
   */
  private checkPorts(manifest: Manifest): CheckResult[] {
    const results: CheckResult[] = [];
    const usedPorts: Map<string, string[]> = new Map();

    // 收集所有端口
    const addPort = (port: number, label: string, node: string): void => {
      const key = `${node}:${port}`;
      const labels = usedPorts.get(key) ?? [];
      if (!labels.includes(label)) {
        labels.push(label);
      }
      usedPorts.set(key, labels);
    };

    const addUrlPort = (url: string | undefined, label: string, node: string, fallback?: number): void => {
      const port = url ? Number.parseInt(new URL(url).port, 10) : fallback;
      if (port !== undefined && Number.isInteger(port) && port > 0) addPort(port, label, node);
    };

    // Controller 端口
    addPort(manifest.services.controller.port ?? 8787, 'Controller', manifest.services.controller.node);
    const controllerUrlPort = manifest.services.controller.publicUrl
      ? Number.parseInt(new URL(manifest.services.controller.publicUrl).port, 10)
      : undefined;
    if (controllerUrlPort && controllerUrlPort !== manifest.services.controller.port) {
      addPort(controllerUrlPort, 'Controller publicUrl', manifest.services.controller.node);
    }

    // OpenClaw 与 OpenCode 服务端口
    addUrlPort(manifest.services.openClaw.publicUrl, 'OpenClaw', manifest.services.openClaw.node, this.openClawLocalPort);
    const openCodeService = manifest.services.openCode;
    if (openCodeService) {
      addUrlPort(openCodeService.publicUrl, 'OpenCode service', openCodeService.node, this.openCodeLocalPort);
    }

    // Worker 项目端口（只检查配置了独立端口的项目）
    for (const worker of manifest.workers) {
      for (const project of worker.projects) {
        if (project.openCode.port && project.openCode.port !== this.openCodeLocalPort) {
          addPort(project.openCode.port, `OpenCode [${project.key}]`, worker.node);
        }
      }
    }

    // 检查端口冲突
    let hasConflict = false;
    for (const [key, labels] of usedPorts.entries()) {
      if (labels.length > 1) {
        hasConflict = true;
        results.push({
          name: '端口冲突检查',
          status: CheckStatus.FAIL,
          message: `端口 ${key} 被多个服务使用：${labels.join('、')}`,
          suggestion: '请为每个服务分配不同的端口号',
        });
      }
    }

    if (!hasConflict) {
      results.push({
        name: '端口有效性检查',
        status: CheckStatus.PASS,
        message: `共检查 ${usedPorts.size} 个端口，无冲突`,
      });
    }

    return results;
  }

  /**
   * 检查 SSH 节点字段结构是否完整
   */
  private checkSshNodes(manifest: Manifest): CheckResult[] {
    const results: CheckResult[] = [];
    let hasSshNode = false;

    for (const [name, node] of Object.entries(manifest.nodes)) {
      if (node.type === 'ssh') {
        hasSshNode = true;

        // Schema 已校验了必填字段，这里做额外的建议性检查
        const issues: string[] = [];

        if (!node.keyPath && !node.password) {
          issues.push('未配置 keyPath 或 password');
        }

        if (node.password) {
          results.push({
            name: `SSH 节点安全检查 [${name}]`,
            status: CheckStatus.WARN,
            message: `SSH 节点 ${name} 使用密码认证`,
            suggestion: '建议使用 SSH 密钥认证（keyPath），更安全',
          });
        }

        if (issues.length === 0) {
          results.push({
            name: `SSH 节点结构检查 [${name}]`,
            status: CheckStatus.PASS,
            message: `SSH 节点 ${name} 配置完整（host=${node.host}, port=${node.port}, user=${node.user}）`,
          });
        } else {
          results.push({
            name: `SSH 节点结构检查 [${name}]`,
            status: CheckStatus.FAIL,
            message: `SSH 节点 ${name} 配置不完整：${issues.join('；')}`,
            suggestion: '请补全 SSH 节点配置',
          });
        }
      }
    }

    if (!hasSshNode) {
      results.push({
        name: 'SSH 节点结构检查',
        status: CheckStatus.SKIP,
        message: '未定义 SSH 节点，跳过检查',
      });
    }

    return results;
  }

  private checkDeployConfig(manifest: Manifest): CheckResult {
    const deploy = manifest.deploy;
    if (!deploy) return this.skipCheck('部署策略配置检查', '未配置 deploy，使用默认策略');
    const health = deploy.healthCheck;
    if (deploy.timeout < 1 || deploy.retryCount < 0 || (health && health.interval < 1)) {
      return { name: '部署策略配置检查', status: CheckStatus.FAIL, message: 'deploy 的 timeout、retryCount 或 healthCheck.interval 无效' };
    }
    return { name: '部署策略配置检查', status: CheckStatus.PASS, message: `部署策略有效：超时 ${deploy.timeout}s，重试 ${deploy.retryCount} 次` };
  }

  private checkNotifyConfig(manifest: Manifest): CheckResult {
    const notify = manifest.notify;
    if (!notify || !notify.enabled) return this.skipCheck('通知配置检查', '通知未启用');
    if (notify.channels.length === 0) return { name: '通知配置检查', status: CheckStatus.FAIL, message: '启用通知时至少需要一个渠道' };
    return { name: '通知配置检查', status: CheckStatus.PASS, message: `通知配置有效：${notify.channels.join('、')}` };
  }

  /**
   * 生成跳过的检查结果
   */
  private skipCheck(name: string, reason: string): CheckResult {
    return {
      name,
      status: CheckStatus.SKIP,
      message: reason,
    };
  }

  /**
   * 构建诊断报告
   */
  private buildReport(manifestPath: string, checks: CheckResult[]): DoctorReport {
    const passCount = checks.filter((c) => c.status === CheckStatus.PASS).length;
    const warnCount = checks.filter((c) => c.status === CheckStatus.WARN).length;
    const failCount = checks.filter((c) => c.status === CheckStatus.FAIL).length;

    let overallStatus: CheckStatus;
    if (failCount > 0) {
      overallStatus = CheckStatus.FAIL;
    } else if (warnCount > 0) {
      overallStatus = CheckStatus.WARN;
    } else {
      overallStatus = CheckStatus.PASS;
    }

    return {
      timestamp: new Date(),
      manifestPath,
      checks,
      overallStatus,
      passCount,
      warnCount,
      failCount,
    };
  }

  /**
   * 比较两个语义化版本号
   * 返回: >0 表示 a > b, <0 表示 a < b, 0 表示相等
   */
  private compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);

    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na !== nb) {
        return na - nb;
      }
    }
    return 0;
  }
}
