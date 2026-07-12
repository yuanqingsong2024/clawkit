import { z } from 'zod';
/**
 * 简化版 Manifest Schema
 * 只保留核心配置：projects 和 openClaw
 * 其他配置全部使用默认值
 */
/**
 * 项目配置 Schema（简化版）
 */
export declare const SimpleProjectSchema: z.ZodObject<{
    key: z.ZodString;
    path: z.ZodString;
    baseBranch: z.ZodDefault<z.ZodString>;
    autoExecute: z.ZodDefault<z.ZodBoolean>;
    dangerousOps: z.ZodDefault<z.ZodArray<z.ZodString>>;
    openCodePort: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
/**
 * OpenClaw 配置 Schema（简化版）
 */
export declare const SimpleOpenClawSchema: z.ZodObject<{
    url: z.ZodOptional<z.ZodString>;
    webhookToken: z.ZodString;
}, z.core.$strip>;
/**
 * 简化版 Manifest Schema
 */
export declare const SimpleManifestSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodString>;
    openClaw: z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        webhookToken: z.ZodString;
    }, z.core.$strip>;
    controllerPort: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    openCodeBaseUrl: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    dataDir: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    projects: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        path: z.ZodString;
        baseBranch: z.ZodDefault<z.ZodString>;
        autoExecute: z.ZodDefault<z.ZodBoolean>;
        dangerousOps: z.ZodDefault<z.ZodArray<z.ZodString>>;
        openCodePort: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * 可编辑的简化版 Manifest Schema
 * 允许项目列表为空，用于 Web 管理场景下的中间态保存。
 */
export declare const EditableSimpleManifestSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodString>;
    openClaw: z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        webhookToken: z.ZodString;
    }, z.core.$strip>;
    controllerPort: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    openCodeBaseUrl: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    dataDir: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    projects: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        path: z.ZodString;
        baseBranch: z.ZodDefault<z.ZodString>;
        autoExecute: z.ZodDefault<z.ZodBoolean>;
        dangerousOps: z.ZodDefault<z.ZodArray<z.ZodString>>;
        openCodePort: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type SimpleProject = z.infer<typeof SimpleProjectSchema>;
export type SimpleOpenClaw = z.infer<typeof SimpleOpenClawSchema>;
export type SimpleManifest = z.infer<typeof SimpleManifestSchema>;
export type EditableSimpleManifest = z.infer<typeof EditableSimpleManifestSchema>;
/**
 * 从简化版 Manifest 转换为完整版 Manifest
 * 用于向后兼容
 */
export declare function convertSimpleToFullManifest(simple: SimpleManifest | EditableSimpleManifest): any;
//# sourceMappingURL=manifest-simple.d.ts.map