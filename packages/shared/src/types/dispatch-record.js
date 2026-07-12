"use strict";
/**
 * 任务派发记录类型定义
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DispatchStatus = void 0;
/**
 * 派发状态枚举
 */
var DispatchStatus;
(function (DispatchStatus) {
    /** 等待派发 */
    DispatchStatus["PENDING"] = "pending";
    /** 已派发给 worker */
    DispatchStatus["DISPATCHED"] = "dispatched";
    /** worker 已接收 */
    DispatchStatus["ACCEPTED"] = "accepted";
    /** 派发失败 */
    DispatchStatus["FAILED"] = "failed";
    /** 派发已取消 */
    DispatchStatus["CANCELLED"] = "cancelled";
})(DispatchStatus || (exports.DispatchStatus = DispatchStatus = {}));
//# sourceMappingURL=dispatch-record.js.map