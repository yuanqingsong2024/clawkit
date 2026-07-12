import fs from 'node:fs';
import path from 'node:path';

import { ManifestLoader } from '@clawkit/cli/services';

export type ManifestPathSource = 'file' | 'env' | 'unset';

export interface ControllerConfigDocument {
  manifestPath: string | null;
  source: ManifestPathSource;
  configPath: string;
}

interface StoredControllerConfig {
  manifestPath?: string;
}

/**
 * 管理 controller 自身的本地配置。
 * manifestPath 不属于业务 manifest 内容本身，因此单独持久化。
 */
export class ControllerConfigService {
  private readonly manifestLoader = new ManifestLoader();
  private readonly configPath = path.join(process.cwd(), 'data', 'controller-config.json');
  private readonly legacyConfigPath = path.join(process.cwd(), 'packages', 'controller', 'data', 'controller-config.json');

  getConfig(): ControllerConfigDocument {
    const storedConfig = this.readStoredConfig();
    const storedManifestPath = this.normalizeManifestPath(storedConfig?.manifestPath ?? null);
    if (storedManifestPath !== null) {
      return {
        manifestPath: storedManifestPath,
        source: 'file',
        configPath: this.configPath,
      };
    }

    const envManifestPath = this.normalizeManifestPath(process.env.CLAWKIT_MANIFEST_PATH ?? null);
    if (envManifestPath !== null) {
      return {
        manifestPath: envManifestPath,
        source: 'env',
        configPath: this.configPath,
      };
    }

    return {
      manifestPath: null,
      source: 'unset',
      configPath: this.configPath,
    };
  }

  saveManifestPath(manifestPath: string): ControllerConfigDocument {
    const normalizedManifestPath = this.normalizeManifestPath(manifestPath);
    if (normalizedManifestPath === null) {
      throw new Error('manifest 路径不能为空');
    }

    try {
      this.manifestLoader.load(normalizedManifestPath);
    } catch (error) {
      throw new Error(`manifest 路径无效：${error instanceof Error ? error.message : '未知错误'}`);
    }

    fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
    const nextConfig: StoredControllerConfig = {
      manifestPath: normalizedManifestPath,
    };
    fs.writeFileSync(this.configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');
    return this.getConfig();
  }

  private readStoredConfig(): StoredControllerConfig | null {
    const activeConfigPath = fs.existsSync(this.configPath)
      ? this.configPath
      : (fs.existsSync(this.legacyConfigPath) ? this.legacyConfigPath : null);

    if (activeConfigPath === null) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(activeConfigPath, 'utf8'));
    } catch (error) {
      throw new Error(`controller 本地配置读取失败：${error instanceof Error ? error.message : '未知错误'}`);
    }

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('controller 本地配置格式无效：应为 JSON 对象');
    }

    const manifestPath = Reflect.get(parsed, 'manifestPath');
    if (manifestPath !== undefined && typeof manifestPath !== 'string') {
      throw new Error('controller 本地配置格式无效：manifestPath 必须为字符串');
    }

    return parsed as StoredControllerConfig;
  }

  private normalizeManifestPath(manifestPath: string | null): string | null {
    if (manifestPath === null) {
      return null;
    }

    const trimmedPath = manifestPath.trim();
    if (trimmedPath.length === 0) {
      return null;
    }

    return path.resolve(trimmedPath);
  }
}
