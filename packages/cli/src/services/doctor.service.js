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
exports.DoctorServiceImpl = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const shared_1 = require("@clawkit/shared");
const yaml = __importStar(require("yaml"));
/**
 * DoctorServiceImpl
 * 实现最小诊断检查：
 * 1. manifest 文件是否存在
 * 2. manifest 是否通过 schema 校验
 * 3. Node.js 版本是否满足要求
 * 4. pnpm 是否可用
 * 5. repoPath 是否存在
 * 6. 端口字段是否为有效数字
 * 7. SSH 节点字段结构是否完整
 */
class DoctorServiceImpl {
    /** Node.js 最低版本要求 */
    minNodeVersion = '20.0.0';
    /**
     * 执行完整诊断
     * @param manifestPath manifest 文件路径
     * @returns 诊断报告
     */
    async diagnose(manifestPath) {
        const checks = [];
        // 1. 检查文件是否存在
        const fileCheck = this.checkFileExists(manifestPath);
        checks.push(fileCheck);
        if (fileCheck.status === shared_1.CheckStatus.FAIL) {
            return this.buildReport(manifestPath, checks);
        }
        // 2. 读取并校验 manifest
        const parseResult = this.parseAndValidate(manifestPath);
        checks.push(parseResult.syntaxCheck);
        if (parseResult.schemaCheck) {
            checks.push(parseResult.schemaCheck);
        }
        if (parseResult.validationErrors) {
            checks.push(...parseResult.validationErrors);
        }
        // 如果 schema 校验失败，后续依赖 manifest 的检查跳过
        if (!parseResult.manifest) {
            // 3-7 全部跳过
            checks.push(this.skipCheck('Node.js 版本检查', '配置文件校验未通过，跳过环境检查'));
            checks.push(this.skipCheck('pnpm 可用性检查', '配置文件校验未通过，跳过环境检查'));
            checks.push(this.skipCheck('repoPath 存在性检查', '配置文件校验未通过，跳过路径检查'));
            checks.push(this.skipCheck('端口有效性检查', '配置文件校验未通过，跳过端口检查'));
            checks.push(this.skipCheck('SSH 节点结构检查', '配置文件校验未通过，跳过节点检查'));
            return this.buildReport(manifestPath, checks);
        }
        // 3. 检查 Node.js 版本
        checks.push(this.checkNodeVersion());
        // 4. 检查 pnpm 是否可用
        checks.push(this.checkPnpm());
        // 5. 检查 repoPath 是否存在
        checks.push(...this.checkRepoPaths(parseResult.manifest));
        // 6. 检查端口字段是否为有效数字
        checks.push(...this.checkPorts(parseResult.manifest));
        // 7. 检查 SSH 节点字段结构是否完整
        checks.push(...this.checkSshNodes(parseResult.manifest));
        return this.buildReport(manifestPath, checks);
    }
    /**
     * 检查 manifest 文件是否存在
     */
    checkFileExists(filePath) {
        const absPath = path.resolve(filePath);
        if (fs.existsSync(absPath)) {
            return {
                name: 'Manifest 文件存在性',
                status: shared_1.CheckStatus.PASS,
                message: `配置文件存在：${filePath}`,
            };
        }
        return {
            name: 'Manifest 文件存在性',
            status: shared_1.CheckStatus.FAIL,
            message: `配置文件不存在：${filePath}`,
            suggestion: '请先运行 clawkit init 生成配置文件',
        };
    }
    /**
     * 读取、解析并校验 manifest
     */
    parseAndValidate(filePath) {
        // YAML 解析
        let raw;
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            raw = yaml.parse(content);
        }
        catch (error) {
            return {
                syntaxCheck: {
                    name: 'YAML 语法检查',
                    status: shared_1.CheckStatus.FAIL,
                    message: `YAML 解析失败：${error.message}`,
                    suggestion: '请检查 YAML 格式是否正确，是否有缩进错误或特殊字符',
                },
            };
        }
        // YAML 解析成功
        const syntaxCheck = {
            name: 'YAML 语法检查',
            status: shared_1.CheckStatus.PASS,
            message: 'YAML 语法正确',
        };
        // Schema 校验
        const result = shared_1.ManifestSchema.safeParse(raw);
        if (!result.success) {
            const validationErrors = result.error.issues.map((issue) => ({
                name: `Schema 校验 [${issue.path.join('.')}]`,
                status: shared_1.CheckStatus.FAIL,
                message: (0, shared_1.formatValidationIssue)(issue),
                suggestion: `请检查字段 ${issue.path.join('.')} 的值`,
            }));
            return {
                syntaxCheck,
                schemaCheck: {
                    name: 'Schema 校验',
                    status: shared_1.CheckStatus.FAIL,
                    message: `配置文件校验失败，共 ${result.error.issues.length} 个错误`,
                },
                validationErrors,
            };
        }
        return {
            syntaxCheck,
            schemaCheck: {
                name: 'Schema 校验',
                status: shared_1.CheckStatus.PASS,
                message: '配置文件符合 Schema 定义',
            },
            manifest: result.data,
        };
    }
    /**
     * 检查 Node.js 版本
     */
    checkNodeVersion() {
        try {
            const version = process.version.replace('v', '');
            const meets = this.compareVersions(version, this.minNodeVersion) >= 0;
            if (meets) {
                return {
                    name: 'Node.js 版本检查',
                    status: shared_1.CheckStatus.PASS,
                    message: `Node.js ${process.version} >= ${this.minNodeVersion}`,
                };
            }
            return {
                name: 'Node.js 版本检查',
                status: shared_1.CheckStatus.FAIL,
                message: `Node.js ${process.version} 低于最低要求 ${this.minNodeVersion}`,
                suggestion: '请升级 Node.js 到 20.0.0 或更高版本',
            };
        }
        catch (error) {
            return {
                name: 'Node.js 版本检查',
                status: shared_1.CheckStatus.FAIL,
                message: `无法检测 Node.js 版本：${error.message}`,
            };
        }
    }
    /**
     * 检查 pnpm 是否可用
     */
    checkPnpm() {
        try {
            const version = (0, child_process_1.execSync)('pnpm --version', { encoding: 'utf-8' }).trim();
            return {
                name: 'pnpm 可用性检查',
                status: shared_1.CheckStatus.PASS,
                message: `pnpm ${version} 已安装`,
            };
        }
        catch {
            return {
                name: 'pnpm 可用性检查',
                status: shared_1.CheckStatus.WARN,
                message: 'pnpm 未安装或不可用',
                suggestion: '建议安装 pnpm：npm install -g pnpm',
            };
        }
    }
    /**
     * 检查所有 worker 项目的 repoPath 是否存在
     */
    checkRepoPaths(manifest) {
        const results = [];
        for (const worker of manifest.workers) {
            for (const project of worker.projects) {
                // 只检查本地节点的 repoPath
                const node = manifest.nodes[worker.node];
                if (node && node.type === 'local') {
                    if (fs.existsSync(project.repoPath)) {
                        results.push({
                            name: `repoPath 存在性 [${project.key}]`,
                            status: shared_1.CheckStatus.PASS,
                            message: `项目 ${project.key} 的仓库路径存在：${project.repoPath}`,
                        });
                    }
                    else {
                        results.push({
                            name: `repoPath 存在性 [${project.key}]`,
                            status: shared_1.CheckStatus.WARN,
                            message: `项目 ${project.key} 的仓库路径不存在：${project.repoPath}`,
                            suggestion: '请确认仓库路径是否正确，或先克隆仓库到指定路径',
                        });
                    }
                }
                else {
                    // SSH 节点的 repoPath 无法在本地检查
                    results.push({
                        name: `repoPath 存在性 [${project.key}]`,
                        status: shared_1.CheckStatus.SKIP,
                        message: `项目 ${project.key} 位于远程节点 ${worker.node}，跳过本地路径检查`,
                    });
                }
            }
        }
        // 如果没有任何项目，给一个总结
        if (results.length === 0) {
            results.push({
                name: 'repoPath 存在性检查',
                status: shared_1.CheckStatus.SKIP,
                message: '未找到需要检查的项目路径',
            });
        }
        return results;
    }
    /**
     * 检查端口字段是否为有效数字
     * Schema 已经做了基本的类型校验，这里做额外的业务级检查（如端口冲突）
     */
    checkPorts(manifest) {
        const results = [];
        const usedPorts = new Map();
        // 收集所有端口
        const addPort = (port, label, node) => {
            const key = `${node}:${port}`;
            if (!usedPorts.has(key)) {
                usedPorts.set(key, []);
            }
            usedPorts.get(key).push(label);
        };
        // Controller 端口
        addPort(manifest.services.controller.port, 'Controller', manifest.services.controller.node);
        // Worker 项目端口
        for (const worker of manifest.workers) {
            for (const project of worker.projects) {
                addPort(project.openCode.port, `OpenCode [${project.key}]`, worker.node);
            }
        }
        // 检查端口冲突
        let hasConflict = false;
        for (const [key, labels] of usedPorts.entries()) {
            if (labels.length > 1) {
                hasConflict = true;
                results.push({
                    name: '端口冲突检查',
                    status: shared_1.CheckStatus.FAIL,
                    message: `端口 ${key} 被多个服务使用：${labels.join('、')}`,
                    suggestion: '请为每个服务分配不同的端口号',
                });
            }
        }
        if (!hasConflict) {
            results.push({
                name: '端口有效性检查',
                status: shared_1.CheckStatus.PASS,
                message: `共检查 ${usedPorts.size} 个端口，无冲突`,
            });
        }
        return results;
    }
    /**
     * 检查 SSH 节点字段结构是否完整
     */
    checkSshNodes(manifest) {
        const results = [];
        let hasSshNode = false;
        for (const [name, node] of Object.entries(manifest.nodes)) {
            if (node.type === 'ssh') {
                hasSshNode = true;
                // Schema 已校验了必填字段，这里做额外的建议性检查
                const issues = [];
                if (!node.keyPath && !node.password) {
                    issues.push('未配置 keyPath 或 password');
                }
                if (node.password) {
                    results.push({
                        name: `SSH 节点安全检查 [${name}]`,
                        status: shared_1.CheckStatus.WARN,
                        message: `SSH 节点 ${name} 使用密码认证`,
                        suggestion: '建议使用 SSH 密钥认证（keyPath），更安全',
                    });
                }
                if (issues.length === 0) {
                    results.push({
                        name: `SSH 节点结构检查 [${name}]`,
                        status: shared_1.CheckStatus.PASS,
                        message: `SSH 节点 ${name} 配置完整（host=${node.host}, port=${node.port}, user=${node.user}）`,
                    });
                }
                else {
                    results.push({
                        name: `SSH 节点结构检查 [${name}]`,
                        status: shared_1.CheckStatus.FAIL,
                        message: `SSH 节点 ${name} 配置不完整：${issues.join('；')}`,
                        suggestion: '请补全 SSH 节点配置',
                    });
                }
            }
        }
        if (!hasSshNode) {
            results.push({
                name: 'SSH 节点结构检查',
                status: shared_1.CheckStatus.SKIP,
                message: '未定义 SSH 节点，跳过检查',
            });
        }
        return results;
    }
    /**
     * 生成跳过的检查结果
     */
    skipCheck(name, reason) {
        return {
            name,
            status: shared_1.CheckStatus.SKIP,
            message: reason,
        };
    }
    /**
     * 构建诊断报告
     */
    buildReport(manifestPath, checks) {
        const passCount = checks.filter((c) => c.status === shared_1.CheckStatus.PASS).length;
        const warnCount = checks.filter((c) => c.status === shared_1.CheckStatus.WARN).length;
        const failCount = checks.filter((c) => c.status === shared_1.CheckStatus.FAIL).length;
        let overallStatus;
        if (failCount > 0) {
            overallStatus = shared_1.CheckStatus.FAIL;
        }
        else if (warnCount > 0) {
            overallStatus = shared_1.CheckStatus.WARN;
        }
        else {
            overallStatus = shared_1.CheckStatus.PASS;
        }
        return {
            timestamp: new Date(),
            manifestPath,
            checks,
            overallStatus,
            passCount,
            warnCount,
            failCount,
        };
    }
    /**
     * 比较两个语义化版本号
     * 返回: >0 表示 a > b, <0 表示 a < b, 0 表示相等
     */
    compareVersions(a, b) {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const na = pa[i] || 0;
            const nb = pb[i] || 0;
            if (na !== nb) {
                return na - nb;
            }
        }
        return 0;
    }
}
exports.DoctorServiceImpl = DoctorServiceImpl;
//# sourceMappingURL=doctor.service.js.map