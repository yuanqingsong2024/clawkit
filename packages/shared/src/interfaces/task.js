"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalAction = exports.TaskPriority = exports.TaskStatus = void 0;
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["DRAFT"] = "draft";
    TaskStatus["PROMPT_GENERATED"] = "prompt_generated";
    TaskStatus["WAITING_APPROVAL"] = "waiting_approval";
    TaskStatus["APPROVED"] = "approved";
    TaskStatus["DISPATCHED"] = "dispatched";
    TaskStatus["RUNNING"] = "running";
    TaskStatus["DONE"] = "done";
    TaskStatus["FAILED"] = "failed";
    TaskStatus["CANCELLED"] = "cancelled";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var TaskPriority;
(function (TaskPriority) {
    TaskPriority["LOW"] = "low";
    TaskPriority["NORMAL"] = "normal";
    TaskPriority["HIGH"] = "high";
    TaskPriority["URGENT"] = "urgent";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
var ApprovalAction;
(function (ApprovalAction) {
    ApprovalAction["APPROVE"] = "approve";
    ApprovalAction["REVISE"] = "revise";
    ApprovalAction["CANCEL"] = "cancel";
    ApprovalAction["VIEW_STATUS"] = "view_status";
})(ApprovalAction || (exports.ApprovalAction = ApprovalAction = {}));
//# sourceMappingURL=task.js.map