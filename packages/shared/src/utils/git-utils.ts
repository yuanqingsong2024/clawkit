/**
 * Git 工具函数
 * 提供 git 信息读取、仓库克隆等功能
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Git 仓库信息
 */
export interface GitRepoInfo {
  /** 当前分支 */
  currentBranch: string;
  /** 所有本地分支 */
  branches: string[];
  /** 远程仓库 URL */
  remoteUrl: string | null;
  /** 是否是 git 仓库 */
  isGitRepo: boolean;
  /** 仓库根目录 */
  rootPath: string;
  /** 是否有未提交的更改 */
  hasUncommittedChanges: boolean;
}

/**
 * 目录内的 git 仓库概览信息。
 * 用于文件浏览器只展示可选的仓库目录。
 */
export interface GitRepoSummary {
  path: string;
  currentBranch: string;
  remoteUrl: string | null;
}

/**
 * 检查系统是否安装了 git
 */
export function checkGitInstalled(): boolean {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查路径是否是 git 仓库
 */
export function isGitRepository(repoPath: string): boolean {
  try {
    const gitDir = path.join(repoPath, '.git');
    return fs.existsSync(gitDir);
  } catch {
    return false;
  }
}

/**
 * 获取 git 仓库信息
 */
export function getGitRepoInfo(repoPath: string): GitRepoInfo {
  if (!isGitRepository(repoPath)) {
    throw new Error(`路径不是有效的 git 仓库：${repoPath}`);
  }

  try {
    // 获取当前分支
    const currentBranch = execSync('git branch --show-current', {
      cwd: repoPath,
      encoding: 'utf-8',
    }).trim();

    // 获取所有本地分支
    const branchesOutput = execSync('git branch', {
      cwd: repoPath,
      encoding: 'utf-8',
    });
    const branches = branchesOutput
      .split('\n')
      .map(b => b.replace(/^\*?\s+/, '').trim())
      .filter(b => b.length > 0);

    // 获取远程仓库 URL
    let remoteUrl: string | null = null;
    try {
      remoteUrl = execSync('git remote get-url origin', {
        cwd: repoPath,
        encoding: 'utf-8',
      }).trim();
    } catch {
      // 没有配置远程仓库
    }

    // 检查是否有未提交的更改
    const statusOutput = execSync('git status --porcelain', {
      cwd: repoPath,
      encoding: 'utf-8',
    });
    const hasUncommittedChanges = statusOutput.trim().length > 0;

    // 获取仓库根目录
    const rootPath = execSync('git rev-parse --show-toplevel', {
      cwd: repoPath,
      encoding: 'utf-8',
    }).trim();

    return {
      currentBranch,
      branches,
      remoteUrl,
      isGitRepo: true,
      rootPath,
      hasUncommittedChanges,
    };
  } catch (error) {
    throw new Error(`读取 git 信息失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 获取 git 仓库概览信息，失败则返回 null。
 */
export function getGitRepoSummary(repoPath: string): GitRepoSummary | null {
  if (!isGitRepository(repoPath)) {
    return null;
  }

  try {
    const info = getGitRepoInfo(repoPath);
    return {
      path: info.rootPath,
      currentBranch: info.currentBranch || 'HEAD',
      remoteUrl: info.remoteUrl,
    };
  } catch {
    return null;
  }
}

/**
 * 克隆远程仓库
 */
export interface CloneOptions {
  /** 远程仓库 URL */
  remoteUrl: string;
  /** 目标目录 */
  targetDir: string;
  /** 分支名称（可选） */
  branch?: string;
  /** 克隆深度（可选，用于浅克隆） */
  depth?: number;
}

/**
 * 展开用户目录前缀，保证前端提示的 `~/projects/...` 可以在后端正确执行。
 */
export function resolveUserPath(targetPath: string): string {
  const trimmed = targetPath.trim();
  if (trimmed.startsWith('~/')) {
    return path.join(os.homedir(), trimmed.slice(2));
  }

  if (trimmed === '~') {
    return os.homedir();
  }

  return trimmed;
}

export function cloneRepository(options: CloneOptions): void {
  const { remoteUrl, targetDir, branch, depth } = options;
  const resolvedTargetDir = resolveUserPath(targetDir);

  // 检查目标目录是否已存在
  if (fs.existsSync(resolvedTargetDir)) {
    throw new Error(`目标目录已存在：${resolvedTargetDir}`);
  }

  // 构建克隆命令
  const args: string[] = ['clone'];
  
  if (branch) {
    args.push('--branch', branch);
  }
  
  if (depth) {
    args.push('--depth', String(depth));
  }
  
  args.push(remoteUrl, resolvedTargetDir);

  try {
    // 执行克隆命令
    execSync(`git ${args.join(' ')}`, {
      stdio: 'inherit',
      encoding: 'utf-8',
    });
  } catch (error) {
    throw new Error(`克隆仓库失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 验证远程仓库 URL 是否有效
 */
export function validateRemoteUrl(remoteUrl: string): boolean {
  try {
    // 使用 git ls-remote 检查远程仓库是否可访问
    execSync(`git ls-remote ${remoteUrl}`, {
      stdio: 'ignore',
      timeout: 10000, // 10秒超时
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 从远程 URL 提取仓库名称
 * 例如：https://github.com/user/repo.git -> repo
 */
export function extractRepoName(remoteUrl: string): string {
  const match = remoteUrl.match(/\/([^/]+?)(\.git)?$/);
  if (match) {
    return match[1];
  }
  throw new Error(`无法从 URL 提取仓库名称：${remoteUrl}`);
}
