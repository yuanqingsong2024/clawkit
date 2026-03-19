import type { Node, SshNode } from '@clawkit/shared';
export interface ApplyOptions {
    dryRun?: boolean;
    onlyLocal?: boolean;
}
export interface ApplyFilePlan {
    nodeName: string;
    nodeType: Node['type'];
    sshNode?: SshNode;
    targetPath: string;
    description: string;
    content: string;
}
export interface ApplyResult {
    manifestPath: string;
    dryRun: boolean;
    generatedFiles: string[];
    backupFiles: string[];
    skippedFiles: string[];
    notes: string[];
    filePlans: ApplyFilePlan[];
}
export declare class ApplyService {
    private readonly loader;
    createPlan(filePath: string, options?: ApplyOptions): ApplyResult;
    apply(filePath: string, options?: ApplyOptions): ApplyResult;
    private buildFilePlans;
    private buildControllerPlans;
    private buildOpenClawPlans;
    private buildWorkerPlans;
    private renderControllerEnv;
    private renderWorkerEnv;
    private renderOpenClawJson;
    private renderSystemdService;
    private renderStartScript;
    private renderOpenCodeLaunch;
    private resolveNodeFilePath;
    private resolveOpenClawConfigPath;
    private resolveManifestRuntimePath;
    private resolveRuntimeDirectory;
    private resolveExecStart;
    private deriveControllerBaseUrl;
    private writeLocalFile;
    private writeRemoteFile;
    private buildSshArgs;
    private escapeShell;
    private buildTimestamp;
    private buildNotes;
}
//# sourceMappingURL=apply.service.d.ts.map