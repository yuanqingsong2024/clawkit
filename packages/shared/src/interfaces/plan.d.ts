import { Manifest } from '../types/manifest';
/**
 * 执行步骤类型
 */
export declare enum StepType {
    /** 创建目录 */
    CREATE_DIR = "create_dir",
    /** 复制文件 */
    COPY_FILE = "copy_file",
    /** 执行命令 */
    RUN_COMMAND = "run_command",
    /** 启动服务 */
    START_SERVICE = "start_service",
    /** 停止服务 */
    STOP_SERVICE = "stop_service",
    /** 健康检查 */
    HEALTH_CHECK = "health_check"
}
/**
 * 执行步骤
 */
export interface ExecutionStep {
    /** 步骤 ID */
    id: string;
    /** 步骤类型 */
    type: StepType;
    /** 步骤描述 */
    description: string;
    /** 目标节点 */
    node: string;
    /** 步骤参数 */
    params: Record<string, unknown>;
    /** 是否必需 */
    required: boolean;
}
/**
 * 执行计划
 */
export interface ExecutionPlan {
    /** 计划 ID */
    id: string;
    /** 计划名称 */
    name: string;
    /** 创建时间 */
    createdAt: Date;
    /** 配置文件路径 */
    manifestPath: string;
    /** 执行步骤列表 */
    steps: ExecutionStep[];
    /** 预估执行时间（秒） */
    estimatedDuration: number;
}
/**
 * Plan 服务接口
 * 负责生成执行计划
 */
export interface PlanService {
    /**
     * 生成执行计划
     * @param manifest Manifest 配置
     * @returns 执行计划
     */
    generatePlan(manifest: Manifest): Promise<ExecutionPlan>;
    /**
     * 验证执行计划
     * @param plan 执行计划
     * @returns 是否有效
     */
    validatePlan(plan: ExecutionPlan): Promise<boolean>;
    /**
     * 导出执行计划
     * @param plan 执行计划
     * @param format 导出格式
     * @returns 导出内容
     */
    exportPlan(plan: ExecutionPlan, format: 'json' | 'yaml'): Promise<string>;
}
//# sourceMappingURL=plan.d.ts.map