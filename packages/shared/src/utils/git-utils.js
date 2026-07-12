"use strict";
/**
 * Git 工具函数
 * 提供 git 信息读取、仓库克隆等功能
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkGitInstalled = checkGitInstalled;
exports.isGitRepository = isGitRepository;
exports.getGitRepoInfo = getGitRepoInfo;
exports.getGitRepoSummary = getGitRepoSummary;
exports.resolveUserPath = resolveUserPath;
exports.cloneRepository = cloneRepository;
exports.validateRemoteUrl = validateRemoteUrl;
exports.extractRepoName = extractRepoName;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * 检查系统是否安装了 git
 */
function checkGitInstalled() {
    try {
        (0, child_process_1.execSync)('git --version', { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * 检查路径是否是 git 仓库
 */
function isGitRepository(repoPath) {
    try {
        const gitDir = path.join(repoPath, '.git');
        return fs.existsSync(gitDir);
    }
    catch {
        return false;
    }
}
/**
 * 获取 git 仓库信息
 */
function getGitRepoInfo(repoPath) {
    if (!isGitRepository(repoPath)) {
        throw new Error(`路径不是有效的 git 仓库：${repoPath}`);
    }
    try {
        // 获取当前分支
        const currentBranch = (0, child_process_1.execSync)('git branch --show-current', {
            cwd: repoPath,
            encoding: 'utf-8',
        }).trim();
        // 获取所有本地分支
        const branchesOutput = (0, child_process_1.execSync)('git branch', {
            cwd: repoPath,
            encoding: 'utf-8',
        });
        const branches = branchesOutput
            .split('\n')
            .map(b => b.replace(/^\*?\s+/, '').trim())
            .filter(b => b.length > 0);
        // 获取远程仓库 URL
        let remoteUrl = null;
        try {
            remoteUrl = (0, child_process_1.execSync)('git remote get-url origin', {
                cwd: repoPath,
                encoding: 'utf-8',
            }).trim();
        }
        catch {
            // 没有配置远程仓库
        }
        // 检查是否有未提交的更改
        const statusOutput = (0, child_process_1.execSync)('git status --porcelain', {
            cwd: repoPath,
            encoding: 'utf-8',
        });
        const hasUncommittedChanges = statusOutput.trim().length > 0;
        // 获取仓库根目录
        const rootPath = (0, child_process_1.execSync)('git rev-parse --show-toplevel', {
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
    }
    catch (error) {
        throw new Error(`读取 git 信息失败：${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * 获取 git 仓库概览信息，失败则返回 null。
 */
function getGitRepoSummary(repoPath) {
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
    }
    catch {
        return null;
    }
}
/**
 * 展开用户目录前缀，保证前端提示的 `~/projects/...` 可以在后端正确执行。
 */
function resolveUserPath(targetPath) {
    const trimmed = targetPath.trim();
    if (trimmed.startsWith('~/')) {
        return path.join(os.homedir(), trimmed.slice(2));
    }
    if (trimmed === '~') {
        return os.homedir();
    }
    return trimmed;
}
function cloneRepository(options) {
    const { remoteUrl, targetDir, branch, depth } = options;
    const resolvedTargetDir = resolveUserPath(targetDir);
    // 检查目标目录是否已存在
    if (fs.existsSync(resolvedTargetDir)) {
        throw new Error(`目标目录已存在：${resolvedTargetDir}`);
    }
    // 构建克隆命令
    const args = ['clone'];
    if (branch) {
        args.push('--branch', branch);
    }
    if (depth) {
        args.push('--depth', String(depth));
    }
    args.push(remoteUrl, resolvedTargetDir);
    try {
        // 执行克隆命令
        (0, child_process_1.execSync)(`git ${args.join(' ')}`, {
            stdio: 'inherit',
            encoding: 'utf-8',
        });
    }
    catch (error) {
        throw new Error(`克隆仓库失败：${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * 验证远程仓库 URL 是否有效
 */
function validateRemoteUrl(remoteUrl) {
    try {
        // 使用 git ls-remote 检查远程仓库是否可访问
        (0, child_process_1.execSync)(`git ls-remote ${remoteUrl}`, {
            stdio: 'ignore',
            timeout: 10000, // 10秒超时
        });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * 从远程 URL 提取仓库名称
 * 例如：https://github.com/user/repo.git -> repo
 */
function extractRepoName(remoteUrl) {
    const match = remoteUrl.match(/\/([^/]+?)(\.git)?$/);
    if (match) {
        return match[1];
    }
    throw new Error(`无法从 URL 提取仓库名称：${remoteUrl}`);
}
//# sourceMappingURL=git-utils.js.map