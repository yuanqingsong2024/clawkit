import { CheckStatus } from '@clawkit/shared';
export interface HealIssue {
    code: string;
    status: CheckStatus;
    title: string;
    message: string;
    suggestion: string;
    canAutoFix: boolean;
}
export interface HealResult {
    manifestPath: string;
    dryRun: boolean;
    issues: HealIssue[];
    plannedFixes: string[];
    appliedFixes: string[];
}
export interface HealOptions {
    dryRun?: boolean;
    force?: boolean;
}
export declare class HealService {
    private readonly loader;
    private readonly applyService;
    heal(filePath: string, options?: HealOptions): Promise<HealResult>;
    private collectIssues;
    private isEnvFileCompatible;
    private deriveControllerBaseUrl;
    private deriveOpenCodeBaseUrl;
    private checkHttp;
}
//# sourceMappingURL=heal.service.d.ts.map