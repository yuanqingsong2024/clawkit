/**
 * Manifest 管理服务
 * 负责读取、更新、保存 manifest 配置文件
 */

import * as fs from 'fs';
import * as yaml from 'yaml';
import { 
  detectManifestType,
  loadEditableSimpleManifest,
  type EditableSimpleManifest,
  type SimpleProject,
} from '@clawkit/shared';

export interface ManifestManagerOptions {
  manifestPath: string;
}

/**
 * Manifest 管理器
 * 目前只支持简化配置格式
 */
export class ManifestManager {
  private manifestPath: string;
  private manifest: EditableSimpleManifest | null = null;

  constructor(options: ManifestManagerOptions) {
    this.manifestPath = options.manifestPath;
    this.loadManifest();
  }

  /**
   * 加载 manifest 配置
   */
  private loadManifest(): void {
    try {
      const type = detectManifestType(this.manifestPath);
      
      if (type === 'full') {
        throw new Error('当前只支持简化配置格式，请使用简化配置文件');
      }

      if (type === 'unknown') {
        throw new Error('无法识别配置文件格式');
      }

      this.manifest = loadEditableSimpleManifest(this.manifestPath);
    } catch (error) {
      throw new Error(`加载 manifest 失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 保存 manifest 配置
   */
  private saveManifest(): void {
    if (!this.manifest) {
      throw new Error('manifest 未加载');
    }

    try {
      const yamlContent = yaml.stringify(this.manifest, {
        indent: 2,
        lineWidth: 120,
      });

      fs.writeFileSync(this.manifestPath, yamlContent, 'utf-8');
    } catch (error) {
      throw new Error(`保存 manifest 失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取所有项目
   */
  getAllProjects(): SimpleProject[] {
    if (!this.manifest) {
      return [];
    }
    return this.manifest.projects;
  }

  /**
   * 根据 key 获取项目
   */
  getProject(key: string): SimpleProject | undefined {
    if (!this.manifest) {
      return undefined;
    }
    return this.manifest.projects.find(p => p.key === key);
  }

  /**
   * 添加项目
   */
  addProject(project: SimpleProject): void {
    if (!this.manifest) {
      throw new Error('manifest 未加载');
    }

    // 检查 key 是否已存在
    const exists = this.manifest.projects.some(p => p.key === project.key);
    if (exists) {
      throw new Error(`项目 key 已存在：${project.key}`);
    }

    // 添加项目
    this.manifest.projects.push(project);

    // 保存到文件
    this.saveManifest();
  }

  /**
   * 更新项目
   */
  updateProject(key: string, updates: Partial<Omit<SimpleProject, 'key'>>): void {
    if (!this.manifest) {
      throw new Error('manifest 未加载');
    }

    const index = this.manifest.projects.findIndex(p => p.key === key);
    if (index === -1) {
      throw new Error(`项目不存在：${key}`);
    }

    // 更新项目（保持 key 不变）
    this.manifest.projects[index] = {
      ...this.manifest.projects[index],
      ...updates,
    };

    // 保存到文件
    this.saveManifest();
  }

  /**
   * 删除项目
   */
  deleteProject(key: string): void {
    if (!this.manifest) {
      throw new Error('manifest 未加载');
    }

    const index = this.manifest.projects.findIndex(p => p.key === key);
    if (index === -1) {
      throw new Error(`项目不存在：${key}`);
    }

    // 删除项目
    this.manifest.projects.splice(index, 1);

    // 保存到文件
    this.saveManifest();
  }

  /**
   * 重新加载配置
   */
  reload(): void {
    this.loadManifest();
  }

  /**
   * 获取 manifest 路径
   */
  getManifestPath(): string {
    return this.manifestPath;
  }
}
