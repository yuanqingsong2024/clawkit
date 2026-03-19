"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManifestLoader = void 0;
const node_path_1 = __importDefault(require("node:path"));
const plan_service_1 = require("./plan.service");
class ManifestLoader {
    planService = new plan_service_1.PlanServiceImpl();
    load(filePath) {
        const manifestPath = node_path_1.default.resolve(filePath);
        const result = this.planService.loadManifest(manifestPath);
        if (result.errors || !result.manifest) {
            throw new Error(result.errors?.join('；') ?? 'Manifest 读取失败');
        }
        return {
            manifest: result.manifest,
            manifestPath,
            manifestDir: node_path_1.default.dirname(manifestPath),
        };
    }
}
exports.ManifestLoader = ManifestLoader;
//# sourceMappingURL=manifest-loader.js.map