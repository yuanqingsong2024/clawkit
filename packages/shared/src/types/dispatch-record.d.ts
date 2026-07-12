/**
 * 任务派发记录类型定义
 */
/**
 * 派发状态枚举
 */
export declare enum DispatchStatus {
    /** 等待派发 */
    PENDING = "pending",
    /** 已派发给 worker */
    DISPATCHED = "dispatched",
    /** worker 已接收 */
    ACCEPTED = "accepted",
    /** 派发失败 */
    FAILED = "failed",
    /** 派发已取消 */
    CANCELLED = "cancelled"
}
/**
 * 派发记录
 */
export interface DispatchRecord {
    /** 派发记录唯一标识 */
    dispatchId: string;
    /** 关联的任务 ID */
    taskId: string;
    /** 派发到的 worker ID */
    workerId: string;
    /** 派发状态 */
    dispatchStatus: DispatchStatus;
    /** 派发创建时间 */
    createdAt: Date;
    /** 派发记录最后更新时间 */
    updatedAt: Date;
    /** 备注信息 */
    note?: string;
}
/**
 * 创建派发记录请求
 */
export interface CreateDispatchRequest {
    /** 任务 ID */
    taskId: string;
    /** Worker ID */
    workerId: string;
    /** 备注信息 */
    note?: string;
}
//# sourceMappingURL=dispatch-record.d.ts.map