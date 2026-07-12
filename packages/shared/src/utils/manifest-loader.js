"use strict";
/**
 * Manifest 加载器
 * 支持自动识别简化配置和完整配置
 */
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
exports.loadManifest = loadManifest;
exports.loadEditableSimpleManifest = loadEditableSimpleManifest;
exports.detectManifestType = detectManifestType;
exports.validateSimpleManifest = validateSimpleManifest;
exports.validateEditableSimpleManifest = validateEditableSimpleManifest;
exports.validateFullManifest = validateFullManifest;
const fs = __importStar(require("fs"));
const yaml = __importStar(require("js-yaml"));
const manifest_1 = require("../schema/manifest");
const manifest_simple_1 = require("../schema/manifest-simple");
/**
 * 加载 manifest 配置
 * 自动识别简化配置和完整配置
 */
function loadManifest(filePath) {
    // 读取文件
    const content = fs.readFileSync(filePath, 'utf-8');
    const rawData = yaml.load(content);
    // 尝试解析为简化配置
    const simpleResult = manifest_simple_1.SimpleManifestSchema.safeParse(rawData);
    if (simpleResult.success) {
        console.log('检测到简化配置，自动转换为完整配置');
        return (0, manifest_simple_1.convertSimpleToFullManifest)(simpleResult.data);
    }
    // 尝试解析为完整配置
    const fullResult = manifest_1.ManifestSchema.safeParse(rawData);
    if (fullResult.success) {
        console.log('检测到完整配置');
        return fullResult.data;
    }
    // 两种格式都不匹配，抛出错误
    const errors = [];
    if (simpleResult.error) {
        errors.push('简化配置格式错误：');
        simpleResult.error.issues.forEach((err) => {
            errors.push(`  - ${err.path.join('.')}: ${err.message}`);
        });
    }
    if (fullResult.error) {
        errors.push('完整配置格式错误：');
        fullResult.error.issues.forEach((err) => {
            errors.push(`  - ${err.path.join('.')}: ${err.message}`);
        });
    }
    throw new Error(`配置文件格式错误：\n${errors.join('\n')}`);
}
/**
 * 加载可编辑的简化 manifest 配置
 * 允许项目列表为空，便于项目管理页面保存中间态。
 */
function loadEditableSimpleManifest(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const rawData = yaml.load(content);
    const result = manifest_simple_1.EditableSimpleManifestSchema.safeParse(rawData);
    if (result.success) {
        return result.data;
    }
    throw new Error(`配置文件格式错误：${result.error.message}`);
}
/**
 * 检测配置类型
 */
function detectManifestType(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const rawData = yaml.load(content);
        const simpleResult = manifest_simple_1.SimpleManifestSchema.safeParse(rawData);
        if (simpleResult.success) {
            return 'simple';
        }
        const fullResult = manifest_1.ManifestSchema.safeParse(rawData);
        if (fullResult.success) {
            return 'full';
        }
        return 'unknown';
    }
    catch (error) {
        return 'unknown';
    }
}
/**
 * 验证简化配置
 */
function validateSimpleManifest(data) {
    const result = manifest_simple_1.SimpleManifestSchema.safeParse(data);
    if (result.success) {
        return { valid: true, data: result.data };
    }
    const errors = result.error.issues.map((err) => {
        return `${err.path.join('.')}: ${err.message}`;
    });
    return { valid: false, errors };
}
/**
 * 验证可编辑的简化配置
 */
function validateEditableSimpleManifest(data) {
    const result = manifest_simple_1.EditableSimpleManifestSchema.safeParse(data);
    if (result.success) {
        return { valid: true, data: result.data };
    }
    const errors = result.error.issues.map((err) => {
        return `${err.path.join('.')}: ${err.message}`;
    });
    return { valid: false, errors };
}
/**
 * 验证完整配置
 */
function validateFullManifest(data) {
    const result = manifest_1.ManifestSchema.safeParse(data);
    if (result.success) {
        return { valid: true, data: result.data };
    }
    const errors = result.error.issues.map((err) => {
        return `${err.path.join('.')}: ${err.message}`;
    });
    return { valid: false, errors };
}
//# sourceMappingURL=manifest-loader.js.map