/**
 * Git 工具函数
 * 提供 git 信息读取、仓库克隆等功能
 */
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
export declare function checkGitInstalled(): boolean;
/**
 * 检查路径是否是 git 仓库
 */
export declare function isGitRepository(repoPath: string): boolean;
/**
 * 获取 git 仓库信息
 */
export declare function getGitRepoInfo(repoPath: string): GitRepoInfo;
/**
 * 获取 git 仓库概览信息，失败则返回 null。
 */
export declare function getGitRepoSummary(repoPath: string): GitRepoSummary | null;
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
export declare function resolveUserPath(targetPath: string): string;
export declare function cloneRepository(options: CloneOptions): void;
/**
 * 验证远程仓库 URL 是否有效
 */
export declare function validateRemoteUrl(remoteUrl: string): boolean;
/**
 * 从远程 URL 提取仓库名称
 * 例如：https://github.com/user/repo.git -> repo
 */
export declare function extractRepoName(remoteUrl: string): string;
//# sourceMappingURL=git-utils.d.ts.map