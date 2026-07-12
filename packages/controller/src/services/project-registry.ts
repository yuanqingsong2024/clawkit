import path from 'node:path';
import * as fs from 'node:fs';
import * as yaml from 'yaml';

import {
  type EditableSimpleManifest,
  type SimpleProject,
  EditableSimpleManifestSchema,
  loadManifest,
  type OpenCodeConfig,
} from '@clawkit/shared';

export interface ProjectDispatchConfig {
  projectKey: string;
  repoPath: string;
  branchBase: string;
  openCode: OpenCodeConfig;
  nodeName: string;
  nodeType: 'local' | 'ssh';
}

export interface ProjectRegistryOptions {
  manifestPath?: string;
}

export class ProjectRegistry {
  private readonly projects = new Map<string, ProjectDispatchConfig>();
  manifestPath: string | null;

  constructor(options: ProjectRegistryOptions = {}) {
    const manifestPath = options.manifestPath ?? process.env.CLAWKIT_MANIFEST_PATH ?? null;
    this.manifestPath = manifestPath;

    if (manifestPath === null) {
      return;
    }

    this.loadFromManifest(manifestPath);
  }

  getProject(projectKey: string): ProjectDispatchConfig | undefined {
    return this.projects.get(projectKey);
  }

  getAllProjects(): ProjectDispatchConfig[] {
    return Array.from(this.projects.values());
  }

  /**
   * 重新加载配置（从 manifest 文件）
   */
  reload(manifestPath?: string): void {
    const pathToLoad = manifestPath ?? this.manifestPath;
    if (pathToLoad) {
      this.loadFromManifest(pathToLoad);
    }
  }

  /**
   * 重新加载配置（从项目列表）
   * 用于热重载场景，直接传入新的项目列表
   */
  reloadFromProjects(projects: SimpleProject[]): void {
    this.projects.clear();
    for (const project of projects) {
      this.projects.set(project.key, {
        projectKey: project.key,
        repoPath: project.path,
        branchBase: project.baseBranch ?? 'main',
        openCode: {
          port: project.openCodePort ?? 4096,
          agent: 'build',
          mode: 'default',
        },
        nodeName: 'local-dev',
        nodeType: 'local',
      });
    }
  }

  private loadFromManifest(manifestPath: string): void {
    const resolvedPath = path.resolve(manifestPath);

    const simpleManifest = this.tryLoadEditableSimpleManifest(resolvedPath);
    if (simpleManifest !== null) {
      this.projects.clear();
      for (const project of simpleManifest.projects) {
        this.projects.set(project.key, {
          projectKey: project.key,
          repoPath: project.path,
          branchBase: project.baseBranch,
          openCode: {
            port: project.openCodePort,
            agent: 'build',
            mode: 'default',
          },
          nodeName: 'local-dev',
          nodeType: 'local',
        });
      }
      this.manifestPath = resolvedPath;
      return;
    }

    // 使用 shared 包的 loadManifest，自动支持简化配置和完整配置
    let manifest;
    try {
      manifest = loadManifest(resolvedPath);
    } catch (error) {
      throw new Error(`项目配置加载失败：${error instanceof Error ? error.message : String(error)}`);
    }

    const nextProjects = new Map<string, ProjectDispatchConfig>();

    for (const worker of manifest.workers) {
      const node = manifest.nodes[worker.node];
      for (const project of worker.projects) {
        // 从 V1 openCode 配置读取
        const openCode = project.openCode ?? { port: 4096, agent: 'build', mode: 'default' };

        nextProjects.set(project.key, {
          projectKey: project.key,
          repoPath: project.repoPath,
          branchBase: project.baseBranch,
          openCode: {
            port: openCode.port ?? 4096,
            agent: openCode.agent ?? 'build',
            mode: openCode.mode ?? 'default',
          },
          nodeName: worker.node,
          nodeType: node.type,
        });
      }
    }

    this.projects.clear();
    for (const [projectKey, projectConfig] of nextProjects.entries()) {
      this.projects.set(projectKey, projectConfig);
    }
    this.manifestPath = resolvedPath;
  }

  private tryLoadEditableSimpleManifest(manifestPath: string): EditableSimpleManifest | null {
    try {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      const rawData = yaml.parse(content);
      const result = EditableSimpleManifestSchema.safeParse(rawData);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }
}
