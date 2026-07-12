import { Manifest } from '../types/manifest';
/**
 * Manifest 加载器接口
 * 负责从文件系统加载配置文件
 */
export interface ManifestLoader {
    /**
     * 从文件加载 Manifest
     * @param filePath 配置文件路径
     * @returns Manifest 对象
     */
    load(filePath: string): Promise<Manifest>;
    /**
     * 从字符串加载 Manifest
     * @param content YAML 内容
     * @returns Manifest 对象
     */
    loadFromString(content: string): Promise<Manifest>;
}
//# sourceMappingURL=loader.d.ts.map