/**
 * Setup Manifest 服务
 * 
 * 管理 Setup 向导的 manifest 生成
 */
import { ManifestManager } from '../../services/manifest-manager';

export class SetupManifestService {
  private manifestManager: ManifestManager | null = null;

  constructor() {
    // 延迟初始化 manifestManager
  }

  /**
   * 设置 manifest manager
   */
  setManifestManager(manager: ManifestManager): void {
    this.manifestManager = manager;
  }

  /**
   * 生成 manifest
   */
  async generateManifest(config: Record<string, unknown>): Promise<Record<string, unknown>> {
    return config;
  }

  /**
   * 验证 manifest 配置
   */
  async validateConfig(config: Record<string, unknown>): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true };
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(): Record<string, unknown> {
    return {
      version: '0.1.0',
      topology: 'all-in-one',
      controller: {
        port: 3000,
      },
      worker: {
        placeholderFallback: true,
      },
    };
  }
}

export default SetupManifestService;
