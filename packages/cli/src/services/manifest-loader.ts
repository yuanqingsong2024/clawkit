import path from 'node:path';

import type { Manifest } from '@clawkit/shared';

import { PlanServiceImpl } from './plan.service';

export interface LoadedManifest {
  manifest: Manifest;
  manifestPath: string;
  manifestDir: string;
}

export class ManifestLoader {
  private readonly planService = new PlanServiceImpl();

  load(filePath: string): LoadedManifest {
    const manifestPath = path.resolve(filePath);
    const result = this.planService.loadManifest(manifestPath);

    if (result.errors || !result.manifest) {
      throw new Error(result.errors?.join('；') ?? 'Manifest 读取失败');
    }

    return {
      manifest: result.manifest,
      manifestPath,
      manifestDir: path.dirname(manifestPath),
    };
  }
}
