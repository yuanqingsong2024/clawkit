"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckStatus = void 0;
/**
 * 检查项状态
 */
var CheckStatus;
(function (CheckStatus) {
    /** 通过 */
    CheckStatus["PASS"] = "pass";
    /** 警告 */
    CheckStatus["WARN"] = "warn";
    /** 失败 */
    CheckStatus["FAIL"] = "fail";
    /** 跳过 */
    CheckStatus["SKIP"] = "skip";
})(CheckStatus || (exports.CheckStatus = CheckStatus = {}));
//# sourceMappingURL=doctor.js.map