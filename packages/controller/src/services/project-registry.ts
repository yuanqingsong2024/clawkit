import fs from 'node:fs';
import path from 'node:path';

import { ManifestSchema, type OpenCodeConfig } from '@clawkit/shared';
import * as yaml from 'yaml';

export interface ProjectDispatchConfig {
  projectKey: string;
  repoPath: string;
  branchBase: string;
  openCode: OpenCodeConfig;
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

  reload(manifestPath: string): void {
    this.loadFromManifest(manifestPath);
  }

  private loadFromManifest(manifestPath: string): void {
    const resolvedPath = path.resolve(manifestPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`项目配置加载失败：manifest 文件不存在 ${resolvedPath}`);
    }

    const yamlContent = fs.readFileSync(resolvedPath, 'utf8');
    const parsed = yaml.parse(yamlContent);
    const result = ManifestSchema.safeParse(parsed);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      throw new Error(`项目配置加载失败：manifest 校验未通过：${firstIssue?.message ?? '未知错误'}`);
    }

    const manifest = result.data;
    const nextProjects = new Map<string, ProjectDispatchConfig>();

    for (const worker of manifest.workers) {
      for (const project of worker.projects) {
        nextProjects.set(project.key, {
          projectKey: project.key,
          repoPath: project.repoPath,
          branchBase: project.baseBranch,
          openCode: {
            port: project.openCode.port,
            agent: project.openCode.agent,
            mode: project.openCode.mode,
          },
        });
      }
    }

    this.projects.clear();
    for (const [projectKey, projectConfig] of nextProjects.entries()) {
      this.projects.set(projectKey, projectConfig);
    }
    this.manifestPath = resolvedPath;
  }
}
