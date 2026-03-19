import type { Manifest, ExecutionPlan } from '@clawkit/shared';
/**
 * Dry-run 计划中的动作描述
 */
interface PlanAction {
    /** 动作类别 */
    category: string;
    /** 动作描述 */
    description: string;
    /** 涉及的节点 */
    node: string;
    /** 是否当前阶段已实现 */
    implemented: boolean;
}
/**
 * Dry-run 计划总览
 */
export interface DryRunPlan {
    /** 配置名称 */
    name: string;
    /** 拓扑类型 */
    topology: string;
    /** 涉及的节点列表 */
    nodes: Array<{
        name: string;
        type: string;
        host?: string;
    }>;
    /** 将要部署的角色 */
    roles: Array<{
        role: string;
        node: string;
    }>;
    /** 将要生成的配置文件 */
    configs: string[];
    /** 将要检查的依赖 */
    dependencies: string[];
    /** 执行步骤 */
    actions: PlanAction[];
    /** 占位能力（当前阶段未实现） */
    placeholders: string[];
    /** 结构化执行计划（兼容 shared 接口） */
    executionPlan: ExecutionPlan;
}
/**
 * PlanServiceImpl
 * 读取 manifest，生成 dry-run 计划展示
 * 当前阶段不执行任何真实操作
 */
export declare class PlanServiceImpl {
    /**
     * 从文件读取并校验 manifest
     * @param filePath manifest 文件路径
     * @returns 校验后的 manifest，校验失败时返回错误信息列表
     */
    loadManifest(filePath: string): {
        manifest?: Manifest;
        errors?: string[];
    };
    /**
     * 根据 manifest 生成 dry-run 计划
     */
    generateDryRunPlan(manifest: Manifest, manifestPath: string): DryRunPlan;
    /**
     * 收集所有涉及的节点
     */
    private collectNodes;
    /**
     * 收集将要部署的角色
     */
    private collectRoles;
    /**
     * 收集将要生成的配置文件列表
     */
    private collectConfigs;
    /**
     * 收集将要检查的依赖
     */
    private collectDependencies;
    /**
     * 收集执行动作
     */
    private collectActions;
    /**
     * 收集当前阶段的占位能力
     */
    private collectPlaceholders;
    /**
     * 构建兼容 shared 接口的执行计划
     */
    private buildExecutionPlan;
    /**
     * 估算执行时间
     */
    private estimateDuration;
}
export {};
//# sourceMappingURL=plan.service.d.ts.map