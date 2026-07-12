import { z } from 'zod';
/**
 * Node 类型枚举
 */
export declare const NodeTypeSchema: z.ZodEnum<{
    local: "local";
    ssh: "ssh";
}>;
/**
 * Local Node Schema
 */
export declare const LocalNodeSchema: z.ZodObject<{
    type: z.ZodLiteral<"local">;
    workDir: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * SSH Node Schema
 */
export declare const SshNodeSchema: z.ZodObject<{
    type: z.ZodLiteral<"ssh">;
    host: z.ZodString;
    port: z.ZodDefault<z.ZodNumber>;
    user: z.ZodString;
    keyPath: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    workDir: z.ZodString;
}, z.core.$strip>;
/**
 * Node Schema（联合类型）
 */
export declare const NodeSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"local">;
    workDir: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"ssh">;
    host: z.ZodString;
    port: z.ZodDefault<z.ZodNumber>;
    user: z.ZodString;
    keyPath: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    workDir: z.ZodString;
}, z.core.$strip>], "type">;
/**
 * Nodes 配置 Schema
 */
export declare const NodesSchema: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"local">;
    workDir: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"ssh">;
    host: z.ZodString;
    port: z.ZodDefault<z.ZodNumber>;
    user: z.ZodString;
    keyPath: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    workDir: z.ZodString;
}, z.core.$strip>], "type">>;
export type NodeType = z.infer<typeof NodeTypeSchema>;
export type LocalNode = z.infer<typeof LocalNodeSchema>;
export type SshNode = z.infer<typeof SshNodeSchema>;
export type Node = z.infer<typeof NodeSchema>;
export type Nodes = z.infer<typeof NodesSchema>;
//# sourceMappingURL=node.d.ts.map