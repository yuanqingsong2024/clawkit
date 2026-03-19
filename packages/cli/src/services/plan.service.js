"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanServiceImpl = void 0;
const fs = __importStar(require("fs"));
const yaml = __importStar(require("yaml"));
const shared_1 = require("@clawkit/shared");
/**
 * PlanServiceImpl
 * 读取 manifest，生成 dry-run 计划展示
 * 当前阶段不执行任何真实操作
 */
class PlanServiceImpl {
    /**
     * 从文件读取并校验 manifest
     * @param filePath manifest 文件路径
     * @returns 校验后的 manifest，校验失败时返回错误信息列表
     */
    loadManifest(filePath) {
        if (!fs.existsSync(filePath)) {
            return { errors: [`配置文件不存在：${filePath}`] };
        }
        let raw;
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            raw = yaml.parse(content);
        }
        catch (error) {
            return { errors: [`YAML 解析失败：${error.message}`] };
        }
        const result = shared_1.ManifestSchema.safeParse(raw);
        if (!result.success) {
            const errors = result.error.issues.map((issue) => `字段 [${issue.path.join('.')}]: ${(0, shared_1.formatValidationIssue)(issue)}`);
            return { errors };
        }
        return { manifest: result.data };
    }
    /**
     * 根据 manifest 生成 dry-run 计划
     */
    generateDryRunPlan(manifest, manifestPath) {
        const nodes = this.collectNodes(manifest);
        const roles = this.collectRoles(manifest);
        const configs = this.collectConfigs(manifest);
        const dependencies = this.collectDependencies(manifest);
        const actions = this.collectActions(manifest);
        const placeholders = this.collectPlaceholders();
        const executionPlan = this.buildExecutionPlan(manifest, manifestPath);
        return {
            name: manifest.profile.name,
            topology: manifest.profile.topology,
            nodes,
            roles,
            configs,
            dependencies,
            actions,
            placeholders,
            executionPlan,
        };
    }
    /**
     * 收集所有涉及的节点
     */
    collectNodes(manifest) {
        return Object.entries(manifest.nodes).map(([name, node]) => ({
            name,
            type: node.type,
            host: node.type === 'ssh' ? node.host : undefined,
        }));
    }
    /**
     * 收集将要部署的角色
     */
    collectRoles(manifest) {
        const roles = [];
        // Controller
        roles.push({
            role: 'Controller',
            node: manifest.services.controller.node,
        });
        // OpenClaw
        roles.push({
            role: 'OpenClaw',
            node: manifest.services.openClaw.node,
        });
        // Workers
        for (const worker of manifest.workers) {
            roles.push({
                role: `Worker [${worker.id}]`,
                node: worker.node,
            });
            // Worker 下的 OpenCode 实例
            for (const project of worker.projects) {
                roles.push({
                    role: `OpenCode [${project.key}]`,
                    node: worker.node,
                });
            }
        }
        return roles;
    }
    /**
     * 收集将要生成的配置文件列表
     */
    collectConfigs(manifest) {
        const configs = [
            'openclaw.json — OpenClaw 运行配置',
            'controller.env — Controller 环境变量',
            'systemd/clawkit-controller.service — Controller systemd 文件',
            'scripts/start-controller.sh — Controller 启动脚本',
        ];
        for (const worker of manifest.workers) {
            configs.push(`worker-${worker.id}.env — Worker ${worker.id} 环境变量`);
            configs.push(`systemd/clawkit-worker-${worker.id}.service — Worker ${worker.id} systemd 文件`);
            configs.push(`scripts/start-worker-${worker.id}.sh — Worker ${worker.id} 启动脚本`);
            for (const project of worker.projects) {
                configs.push(`opencode-${project.key}.launch.yaml — OpenCode ${project.key} 启动配置`);
            }
        }
        return configs;
    }
    /**
     * 收集将要检查的依赖
     */
    collectDependencies(manifest) {
        const deps = [
            `Node.js >= 20.0.0`,
            'pnpm >= 8.0.0',
        ];
        // 根据 runtime 配置添加依赖检查
        if (manifest.runtime.memory.enabled) {
            if (manifest.runtime.memory.provider === 'redis') {
                deps.push('Redis 服务可用');
            }
            else if (manifest.runtime.memory.provider === 'postgres') {
                deps.push('PostgreSQL 服务可用');
            }
        }
        // SSH 节点需要 SSH 客户端
        const hasSshNodes = Object.values(manifest.nodes).some((n) => n.type === 'ssh');
        if (hasSshNodes) {
            deps.push('SSH 客户端可用');
            deps.push('SSH 目标节点可达');
        }
        if (manifest.runtime.promptEngine.mode === 'template') {
            deps.push('PromptEngine 使用内置 template 模式（无需额外 API Key）');
        }
        else if (manifest.runtime.promptEngine.provider !== 'custom') {
            deps.push(`${manifest.runtime.promptEngine.provider} API Key 已配置（环境变量: ${manifest.runtime.promptEngine.apiKeyEnv}）`);
        }
        return deps;
    }
    /**
     * 收集执行动作
     */
    collectActions(manifest) {
        const actions = [];
        // 1. 检查节点连通性
        for (const [name, node] of Object.entries(manifest.nodes)) {
            if (node.type === 'ssh') {
                actions.push({
                    category: '节点检查',
                    description: `检查 SSH 节点 ${name} 的连通性 (${node.host}:${node.port})`,
                    node: name,
                    implemented: false,
                });
            }
            else {
                actions.push({
                    category: '节点检查',
                    description: `检查本地节点 ${name} 的工作目录`,
                    node: name,
                    implemented: true,
                });
            }
        }
        // 2. 创建工作目录
        for (const [name, node] of Object.entries(manifest.nodes)) {
            const workDir = node.type === 'ssh' ? node.workDir : (node.workDir || '.');
            actions.push({
                category: '目录准备',
                description: `在节点 ${name} 创建工作目录 ${workDir}`,
                node: name,
                implemented: true,
            });
        }
        // 3. 生成配置文件
        actions.push({
            category: '配置生成',
            description: '生成 openclaw.json',
            node: manifest.services.openClaw.node,
            implemented: true,
        });
        actions.push({
            category: '配置生成',
            description: '生成 controller.env',
            node: manifest.services.controller.node,
            implemented: true,
        });
        for (const worker of manifest.workers) {
            actions.push({
                category: '配置生成',
                description: `生成 worker-${worker.id}.env`,
                node: worker.node,
                implemented: true,
            });
            for (const project of worker.projects) {
                actions.push({
                    category: '配置生成',
                    description: `生成 opencode-${project.key}.launch.yaml`,
                    node: worker.node,
                    implemented: true,
                });
            }
        }
        // 4. 部署服务
        actions.push({
            category: '服务部署',
            description: `部署 Controller 到节点 ${manifest.services.controller.node}（端口 ${manifest.services.controller.port}）`,
            node: manifest.services.controller.node,
            implemented: false,
        });
        for (const worker of manifest.workers) {
            actions.push({
                category: '服务部署',
                description: `部署 Worker ${worker.id} 到节点 ${worker.node}`,
                node: worker.node,
                implemented: false,
            });
        }
        // 5. 健康检查
        actions.push({
            category: '健康检查',
            description: '执行部署后健康检查',
            node: '*',
            implemented: false,
        });
        return actions;
    }
    /**
     * 收集当前阶段的占位能力
     */
    collectPlaceholders() {
        return [
            '真实 SSH 连接与远程命令执行',
            '服务的自动启动与停止',
            'Systemd service 的自动安装与 enable',
            '健康检查的真实执行',
            '部署回滚',
            'Notify 通知发送',
        ];
    }
    /**
     * 构建兼容 shared 接口的执行计划
     */
    buildExecutionPlan(manifest, manifestPath) {
        const steps = [];
        let stepIndex = 1;
        // 检查节点
        for (const name of Object.keys(manifest.nodes)) {
            steps.push({
                id: `step-${stepIndex++}`,
                type: shared_1.StepType.HEALTH_CHECK,
                description: `检查节点 ${name} 可用性`,
                node: name,
                params: {},
                required: true,
            });
        }
        // 创建目录
        for (const [name, node] of Object.entries(manifest.nodes)) {
            const workDir = node.type === 'ssh' ? node.workDir : (node.workDir || '.');
            steps.push({
                id: `step-${stepIndex++}`,
                type: shared_1.StepType.CREATE_DIR,
                description: `创建工作目录 ${workDir}`,
                node: name,
                params: { path: workDir },
                required: true,
            });
        }
        // 生成配置文件
        steps.push({
            id: `step-${stepIndex++}`,
            type: shared_1.StepType.COPY_FILE,
            description: '生成 openclaw.json',
            node: manifest.services.openClaw.node,
            params: { target: 'openclaw.json' },
            required: true,
        });
        steps.push({
            id: `step-${stepIndex++}`,
            type: shared_1.StepType.COPY_FILE,
            description: '生成 controller.env',
            node: manifest.services.controller.node,
            params: { target: 'controller.env' },
            required: true,
        });
        for (const worker of manifest.workers) {
            steps.push({
                id: `step-${stepIndex++}`,
                type: shared_1.StepType.COPY_FILE,
                description: `生成 worker-${worker.id}.env`,
                node: worker.node,
                params: { target: `worker-${worker.id}.env` },
                required: true,
            });
        }
        // 启动服务
        steps.push({
            id: `step-${stepIndex++}`,
            type: shared_1.StepType.START_SERVICE,
            description: '启动 Controller',
            node: manifest.services.controller.node,
            params: { service: 'controller' },
            required: true,
        });
        for (const worker of manifest.workers) {
            steps.push({
                id: `step-${stepIndex++}`,
                type: shared_1.StepType.START_SERVICE,
                description: `启动 Worker ${worker.id}`,
                node: worker.node,
                params: { service: `worker-${worker.id}` },
                required: true,
            });
        }
        // 健康检查
        steps.push({
            id: `step-${stepIndex++}`,
            type: shared_1.StepType.HEALTH_CHECK,
            description: '执行部署后健康检查',
            node: manifest.services.controller.node,
            params: {},
            required: false,
        });
        return {
            id: `plan-${Date.now()}`,
            name: manifest.profile.name,
            createdAt: new Date(),
            manifestPath,
            steps,
            estimatedDuration: this.estimateDuration(steps),
        };
    }
    /**
     * 估算执行时间
     */
    estimateDuration(steps) {
        // 简单估算：每步 15 秒
        return steps.length * 15;
    }
}
exports.PlanServiceImpl = PlanServiceImpl;
//# sourceMappingURL=plan.service.js.map