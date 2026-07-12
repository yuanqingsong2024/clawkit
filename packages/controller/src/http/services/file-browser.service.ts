import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { getGitRepoSummary, isGitRepository } from '@clawkit/shared';

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
  git?: {
    isRepo: boolean;
    currentBranch?: string;
    remoteUrl?: string | null;
  };
}

export interface FileBrowserLocation {
  label: string;
  path: string;
}

export interface BrowseResult {
  currentPath: string;
  parentPath: string | null;
  items: FileItem[];
  locations: FileBrowserLocation[];
}

/**
 * 文件浏览服务
 * 提供目录和文件列表功能
 */
export class FileBrowserService {
  /**
   * 浏览指定目录
   */
  browse(targetPath?: string): BrowseResult {
    const currentPath = this.resolvePath(targetPath);
    
    if (!fs.existsSync(currentPath)) {
      throw new Error(`路径不存在：${currentPath}`);
    }

    const stat = fs.statSync(currentPath);
    if (!stat.isDirectory()) {
      throw new Error(`路径不是目录：${currentPath}`);
    }

    const items = this.listDirectory(currentPath);
    const parentPath = this.getParentPath(currentPath);

    return {
      currentPath,
      parentPath,
      items,
      locations: this.listLocations(),
    };
  }

  /**
   * 解析路径
   */
  private resolvePath(targetPath?: string): string {
    if (!targetPath || targetPath.trim().length === 0) {
      return os.homedir();
    }

    const trimmed = targetPath.trim();
    
    if (trimmed.startsWith('~')) {
      return path.join(os.homedir(), trimmed.slice(1));
    }

    if (path.isAbsolute(trimmed)) {
      return path.normalize(trimmed);
    }

    return path.resolve(process.cwd(), trimmed);
  }

  /**
   * 列出目录内容
   */
  private listDirectory(dirPath: string): FileItem[] {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const items: FileItem[] = [];

      for (const entry of entries) {
        if (entry.name.startsWith('.')) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        
        try {
          const stat = fs.statSync(fullPath);
          
          items.push({
            name: entry.name,
            path: fullPath,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: entry.isFile() ? stat.size : undefined,
            modifiedAt: stat.mtime.toISOString(),
            git: entry.isDirectory() && isGitRepository(fullPath)
              ? (() => {
                  const summary = getGitRepoSummary(fullPath);
                  return summary
                    ? {
                        isRepo: true,
                        currentBranch: summary.currentBranch,
                        remoteUrl: summary.remoteUrl,
                      }
                    : { isRepo: false };
                })()
              : undefined,
          });
        } catch {
          continue;
        }
      }

      items.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return items;
    } catch (error) {
      throw new Error(`读取目录失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 返回可快速跳转的位置，避免只能从用户主目录逐级查找其他磁盘或挂载点。
   */
  private listLocations(): FileBrowserLocation[] {
    const locations: FileBrowserLocation[] = [{ label: '主目录', path: os.homedir() }];

    if (process.platform === 'win32') {
      for (let code = 67; code <= 90; code += 1) {
        const drive = `${String.fromCharCode(code)}:\\`;
        if (fs.existsSync(drive)) {
          locations.push({ label: drive, path: drive });
        }
      }
      return locations;
    }

    locations.push({ label: '根目录', path: '/' });
    const mountedRoots = process.platform === 'darwin'
      ? ['/Volumes']
      : ['/media', path.join('/media', os.userInfo().username), '/mnt'];

    for (const mountPath of mountedRoots) {
      if (fs.existsSync(mountPath)) {
        locations.push({ label: mountPath, path: mountPath });
      }
    }

    return locations;
  }

  /**
   * 获取父目录路径
   */
  private getParentPath(currentPath: string): string | null {
    const parent = path.dirname(currentPath);
    
    if (parent === currentPath) {
      return null;
    }

    return parent;
  }
}
