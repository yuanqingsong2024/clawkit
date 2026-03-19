import type { Manifest } from '@clawkit/shared';
export interface LoadedManifest {
    manifest: Manifest;
    manifestPath: string;
    manifestDir: string;
}
export declare class ManifestLoader {
    private readonly planService;
    load(filePath: string): LoadedManifest;
}
//# sourceMappingURL=manifest-loader.d.ts.map