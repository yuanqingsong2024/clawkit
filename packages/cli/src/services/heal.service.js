"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealService = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_http_1 = __importDefault(require("node:http"));
const node_https_1 = __importDefault(require("node:https"));
const shared_1 = require("@clawkit/shared");
const apply_service_1 = require("./apply.service");
const manifest_loader_1 = require("./manifest-loader");
class HealService {
    loader = new manifest_loader_1.ManifestLoader();
    applyService = new apply_service_1.ApplyService();
    async heal(filePath, options = {}) {
        const dryRun = options.dryRun ?? !options.force;
        let loadedManifest;
        try {
            loadedManifest = this.loader.load(filePath);
        }
        catch (error) {
            return {
                manifestPath: filePath,
                dryRun,
                issues: [
                    {
                        code: 'heal.manifest.invalid',
                        status: shared_1.CheckStatus.FAIL,
                        title: 'Manifest 缺失关键字段或格式不合法',
                        message: error instanceof Error ? error.message : '未知 manifest 错误',
                        suggestion: '请先修正 manifest，再执行 heal 或 apply',
                        canAutoFix: false,
                    },
                ],
                plannedFixes: [],
                appliedFixes: [],
            };
        }
        const plan = this.applyService.createPlan(filePath, { dryRun: true, onlyLocal: true });
        const issues = await this.collectIssues(loadedManifest.manifest, plan.filePlans);
        const plannedFixes = issues
            .filter((issue) => issue.canAutoFix)
            .map((issue) => `自动修复：${issue.title}`);
        const appliedFixes = [];
        if (!dryRun && plannedFixes.length > 0) {
            this.applyService.apply(filePath, { dryRun: false, onlyLocal: true });
            appliedFixes.push(...plannedFixes);
        }
        return {
            manifestPath: loadedManifest.manifestPath,
            dryRun,
            issues,
            plannedFixes,
            appliedFixes,
        };
    }
    async collectIssues(manifest, filePlans) {
        const issues = [];
        if (!manifest.services.openClaw.apiKey || manifest.services.openClaw.apiKey.trim().length === 0) {
            issues.push({
                code: 'heal.openclaw.token_missing',
                status: shared_1.CheckStatus.FAIL,
                title: 'OpenClaw webhook token 未配置',
                message: 'manifest.services.openClaw.apiKey 为空，controller 无法进行 webhook token 鉴权。',
                suggestion: '请在 manifest 中补充 services.openClaw.apiKey，再重新执行 apply。',
                canAutoFix: false,
            });
        }
        for (const worker of manifest.workers) {
            for (const project of worker.projects) {
                const node = manifest.nodes[worker.node];
                if (node.type === 'local' && !node_fs_1.default.existsSync(project.repoPath)) {
                    issues.push({
                        code: 'heal.project.path_missing',
                        status: shared_1.CheckStatus.FAIL,
                        title: `项目路径不存在：${project.key}`,
                        message: `本地项目路径不存在：${project.repoPath}`,
                        suggestion: '请确认项目路径是否正确，或先将仓库克隆到目标路径。',
                        canAutoFix: false,
                    });
                }
                const health = await this.checkHttp(`${this.deriveOpenCodeBaseUrl(project.openCode.port)}/global/health`);
                if (!health.ok) {
                    issues.push({
                        code: 'heal.opencode.unreachable',
                        status: shared_1.CheckStatus.WARN,
                        title: `OpenCode server 不可达：${project.key}`,
                        message: `未能访问 ${this.deriveOpenCodeBaseUrl(project.openCode.port)}/global/health：${health.message}`,
                        suggestion: `请先启动 opencode serve --hostname 127.0.0.1 --port ${project.openCode.port}`,
                        canAutoFix: false,
                    });
                }
            }
            const workerHealth = await this.checkHttp(`${this.deriveControllerBaseUrl(manifest)}/api/workers/${worker.id}`);
            if (!workerHealth.ok) {
                issues.push({
                    code: 'heal.worker.not_registered',
                    status: shared_1.CheckStatus.WARN,
                    title: `Worker 未注册：${worker.id}`,
                    message: `controller 当前无法查询到 worker ${worker.id}。`,
                    suggestion: '请先启动 worker，或检查 CONTROLLER_URL 与 worker 配置是否正确。',
                    canAutoFix: false,
                });
            }
        }
        const controllerHealth = await this.checkHttp(`${this.deriveControllerBaseUrl(manifest)}${manifest.services.controller.apiPrefix}/health`);
        if (!controllerHealth.ok) {
            issues.push({
                code: 'heal.controller.unhealthy',
                status: shared_1.CheckStatus.WARN,
                title: 'Controller 服务未启动或状态异常',
                message: `未能访问 controller 健康检查接口：${controllerHealth.message}`,
                suggestion: '请检查 controller 进程、端口与环境变量；如配置缺失，可先执行 heal --force 或 apply。',
                canAutoFix: false,
            });
        }
        for (const filePlan of filePlans) {
            if (!node_fs_1.default.existsSync(filePlan.targetPath)) {
                issues.push({
                    code: 'heal.config.missing',
                    status: shared_1.CheckStatus.FAIL,
                    title: `配置文件缺失：${filePlan.description}`,
                    message: `未找到 ${filePlan.targetPath}`,
                    suggestion: '可通过 heal --force 自动重建本地生成文件。',
                    canAutoFix: true,
                });
                continue;
            }
            if (filePlan.targetPath.endsWith('.env') && !this.isEnvFileCompatible(filePlan.targetPath)) {
                issues.push({
                    code: 'heal.config.incompatible',
                    status: shared_1.CheckStatus.FAIL,
                    title: `配置文件损坏或 schema 不兼容：${filePlan.description}`,
                    message: `${filePlan.targetPath} 缺少最小必要字段。`,
                    suggestion: '可通过 heal --force 自动重新生成本地 env 文件。',
                    canAutoFix: true,
                });
            }
        }
        return issues;
    }
    isEnvFileCompatible(filePath) {
        const content = node_fs_1.default.readFileSync(filePath, 'utf8');
        const requiredKeys = filePath.includes('controller.env')
            ? ['CLAWKIT_MANIFEST_PATH=', 'CONTROLLER_PORT=', 'OPENCLAW_WEBHOOK_TOKEN=']
            : ['CLAWKIT_MANIFEST_PATH=', 'WORKER_ID=', 'CONTROLLER_URL='];
        return requiredKeys.every((key) => content.includes(key));
    }
    deriveControllerBaseUrl(manifest) {
        const controllerNode = manifest.nodes[manifest.services.controller.node];
        if (controllerNode.type === 'local') {
            return `http://127.0.0.1:${manifest.services.controller.port}`;
        }
        return manifest.services.openClaw.publicUrl;
    }
    deriveOpenCodeBaseUrl(port) {
        return `http://127.0.0.1:${port}`;
    }
    async checkHttp(url) {
        return new Promise((resolve) => {
            try {
                const target = new URL(url);
                const client = target.protocol === 'https:' ? node_https_1.default : node_http_1.default;
                const request = client.request({
                    hostname: target.hostname,
                    port: target.port,
                    path: `${target.pathname}${target.search}`,
                    method: 'GET',
                    timeout: 2000,
                }, (response) => {
                    resolve({
                        ok: (response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300,
                        message: `HTTP ${response.statusCode ?? 500}`,
                    });
                });
                request.on('timeout', () => {
                    request.destroy(new Error('请求超时'));
                });
                request.on('error', (error) => {
                    resolve({
                        ok: false,
                        message: error.message,
                    });
                });
                request.end();
            }
            catch (error) {
                resolve({
                    ok: false,
                    message: error instanceof Error ? error.message : '未知网络错误',
                });
            }
        });
    }
}
exports.HealService = HealService;
//# sourceMappingURL=heal.service.js.map