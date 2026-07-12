/**
 * V1 Manifest 兼容性类型定义
 * 用于 V1 到 V2 配置转换的类型声明
 */
/**
 * V1 简化项目配置
 */
export interface V1SimpleProject {
    key: string;
    path: string;
    baseBranch?: string;
    autoExecute?: boolean;
    dangerousOps?: string[];
    openCodePort?: number;
}
/**
 * V1 简化配置
 */
export interface V1SimpleManifest {
    version?: string;
    profile?: {
        name: string;
        version?: string;
        topology?: 'all-in-one' | 'hybrid' | 'split';
        description?: string;
    };
    projects?: V1SimpleProject[];
    openClaw?: {
        url?: string;
        webhookToken: string;
    };
    controllerPort?: number;
    openCodeBaseUrl?: string;
    dataDir?: string;
}
/**
 * V1 完整项目配置
 */
export interface V1FullProject {
    key: string;
    repoPath: string;
    baseBranch?: string;
    openCode?: {
        port?: number;
        agent?: string;
        mode?: string;
    };
    executionTimeoutMs?: number;
    maxRetries?: number;
}
/**
 * V1 Worker 配置
 */
export interface V1Worker {
    id: string;
    node: string;
    connectMode?: 'pull' | 'push';
    tags?: string[];
    projects: V1FullProject[];
}
/**
 * V1 完整配置
 */
export interface V1FullManifest {
    version?: string;
    profile: {
        name: string;
        version?: string;
        topology: 'all-in-one' | 'hybrid' | 'split';
        description?: string;
    };
    nodes: Record<string, {
        type: 'local' | 'ssh';
        host?: string;
        port?: number;
        username?: string;
        keyPath?: string;
        password?: string;
    }>;
    services: {
        controller: {
            node: string;
            port?: number;
            publicUrl?: string;
        };
        openClaw: {
            node: string;
            publicUrl: string;
            apiKey?: string;
            deployMode?: 'local' | 'external' | 'skip';
        };
        openCode?: {
            node?: string;
            publicUrl?: string;
            installMode?: 'local' | 'external' | 'skip';
        };
    };
    workers: V1Worker[];
    runtime?: {
        promptEngine?: {
            mode?: 'template' | 'llm' | 'hybrid';
            provider?: string;
            apiKeyEnv?: string;
            model?: string;
        };
        memory?: {
            enabled?: boolean;
            provider?: 'local' | 'redis' | 'postgres';
            path?: string;
        };
    };
    notify?: Record<string, unknown>;
    deploy?: Record<string, unknown>;
}
//# sourceMappingURL=manifest-v2-compatibility.types.d.ts.map