import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
}

export interface BrowseResult {
  currentPath: string;
  parentPath: string | null;
  items: FileItem[];
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
