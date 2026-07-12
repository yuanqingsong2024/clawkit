"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StepType = void 0;
/**
 * 执行步骤类型
 */
var StepType;
(function (StepType) {
    /** 创建目录 */
    StepType["CREATE_DIR"] = "create_dir";
    /** 复制文件 */
    StepType["COPY_FILE"] = "copy_file";
    /** 执行命令 */
    StepType["RUN_COMMAND"] = "run_command";
    /** 启动服务 */
    StepType["START_SERVICE"] = "start_service";
    /** 停止服务 */
    StepType["STOP_SERVICE"] = "stop_service";
    /** 健康检查 */
    StepType["HEALTH_CHECK"] = "health_check";
})(StepType || (exports.StepType = StepType = {}));
//# sourceMappingURL=plan.js.map