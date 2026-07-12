"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControllerErrorCode = void 0;
var ControllerErrorCode;
(function (ControllerErrorCode) {
    ControllerErrorCode["TASK_DRAFT_NOT_FOUND"] = "controller.task_draft_not_found";
    ControllerErrorCode["TASK_MEMORY_NOT_FOUND"] = "controller.task_memory_not_found";
    ControllerErrorCode["PROMPT_DRAFT_NOT_FOUND"] = "controller.prompt_draft_not_found";
    ControllerErrorCode["INVALID_TASK_PROTOCOL"] = "controller.invalid_task_protocol";
    ControllerErrorCode["TASK_PROTOCOL_FIELD_MISSING"] = "controller.task_protocol_field_missing";
    ControllerErrorCode["TASK_PROTOCOL_FIELD_INVALID"] = "controller.task_protocol_field_invalid";
    ControllerErrorCode["INVALID_APPROVAL_ACTION"] = "controller.invalid_approval_action";
    ControllerErrorCode["INVALID_TASK_STATUS_TRANSITION"] = "controller.invalid_task_status_transition";
    ControllerErrorCode["PROMPT_DRAFT_VERSION_CONFLICT"] = "controller.prompt_draft_version_conflict";
    ControllerErrorCode["PROMPT_ENGINE_NOT_CONFIGURED"] = "controller.prompt_engine_not_configured";
    ControllerErrorCode["PERSISTENCE_INIT_FAILED"] = "controller.persistence_init_failed";
    ControllerErrorCode["TASK_NOT_FOUND"] = "controller.task_not_found";
    ControllerErrorCode["WORKER_NOT_FOUND"] = "controller.worker_not_found";
    ControllerErrorCode["NO_AVAILABLE_WORKER"] = "controller.no_available_worker";
    ControllerErrorCode["PROJECT_CONFIG_NOT_FOUND"] = "controller.project_config_not_found";
    ControllerErrorCode["AUTH_UNAUTHORIZED"] = "controller.auth_unauthorized";
    ControllerErrorCode["AUTH_FORBIDDEN"] = "controller.auth_forbidden";
    ControllerErrorCode["INVALID_REQUEST"] = "controller.invalid_request";
    ControllerErrorCode["DUPLICATE_REQUEST"] = "controller.duplicate_request";
    ControllerErrorCode["DRY_RUN_UNSUPPORTED"] = "controller.dry_run_unsupported";
    ControllerErrorCode["RESULT_PENDING"] = "controller.result_pending";
    ControllerErrorCode["CANCEL_UNSUPPORTED"] = "controller.cancel_unsupported";
})(ControllerErrorCode || (exports.ControllerErrorCode = ControllerErrorCode = {}));
//# sourceMappingURL=errors.js.map