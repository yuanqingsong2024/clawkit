"use strict";
/**
 * Worker 注册记录类型定义
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerStatus = void 0;
/**
 * Worker 状态枚举
 */
var WorkerStatus;
(function (WorkerStatus) {
    /** 空闲状态，可接受新任务 */
    WorkerStatus["IDLE"] = "idle";
    /** 忙碌状态，正在执行任务 */
    WorkerStatus["BUSY"] = "busy";
    /** 离线状态，心跳超时 */
    WorkerStatus["OFFLINE"] = "offline";
})(WorkerStatus || (exports.WorkerStatus = WorkerStatus = {}));
//# sourceMappingURL=worker-record.js.map