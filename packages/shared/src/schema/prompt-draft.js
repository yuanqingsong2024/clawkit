"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptDraftVersionSchema = void 0;
const zod_1 = require("zod");
exports.PromptDraftVersionSchema = zod_1.z.object({
    generation: zod_1.z.number().int().min(1).describe('生成轮次，从 1 开始递增'),
    revision: zod_1.z.number().int().min(0).describe('同一生成轮次下的修订次数，从 0 开始'),
});
//# sourceMappingURL=prompt-draft.js.map