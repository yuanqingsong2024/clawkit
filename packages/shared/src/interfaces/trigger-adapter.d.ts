/**
 * 触发器适配器接口
 * 支持多种触发源（Claude Code、GitHub、Slack 等）的抽象
 */
import type { ValidationResult } from './executor-registry';
/**
 * 触发请求类型
 */
export type TriggerAction = 'create_task' | 'approve_draft' | 'revise_draft' | 'cancel_task' | 'query_status';
/**
 * 解析后的触发请求
 */
export interface ParsedTriggerRequest {
    /** 请求唯一标识 */
    requestId: string;
    /** 触发源名称 */
    source: string;
    /** 会话信息 */
    session?: {
        sessionId: string;
        messageId?: string;
    };
    /** 操作者信息 */
    operator?: {
        id: string;
        name?: string;
    };
    /** 触发动作 */
    action: TriggerAction;
    /** 任务文本（create_task 使用） */
    taskText?: string;
    /** 任务 ID（其他 action 使用） */
    taskId?: string;
    /** 修改内容（revise_draft 使用） */
    revisionText?: string;
    /** 备注 */
    comment?: string;
    /** 原始请求体 */
    rawRequest: unknown;
}
/**
 * 触发器元信息
 */
export interface TriggerMeta {
    /** 触发器唯一名称，如 'claude-code', 'github', 'slack' */
    readonly name: string;
    /** 触发器显示名称 */
    readonly displayName: string;
    /** 支持的协议类型 */
    readonly protocol: 'json' | 'text' | 'mixed';
    /** 触发器描述 */
    readonly description: string;
}
/**
 * 触发器适配器接口
 * 负责解析和验证来自不同触发源的请求
 */
export interface TriggerAdapter {
    /** 触发器元信息 */
    readonly meta: TriggerMeta;
    /** 解析请求为统一的 ParsedTriggerRequest 格式 */
    parseRequest(request: unknown): ParsedTriggerRequest;
    /** 验证请求格式和权限 */
    validateRequest(request: unknown): ValidationResult;
    /** 验证认证 token */
    validateAuth?(token: string): Promise<ValidationResult>;
    /** 从请求中提取任务文本 */
    extractTaskText(request: unknown): string | undefined;
}
/**
 * 触发器注册表接口
 * 管理所有已注册的触发器适配器
 */
export interface TriggerAdapterRegistry {
    /** 注册触发器适配器 */
    register(adapter: TriggerAdapter): void;
    /** 获取触发器适配器 */
    get(name: string): TriggerAdapter | undefined;
    /** 获取所有已注册的触发器名称 */
    getRegisteredNames(): string[];
    /** 检查触发器是否已注册 */
    has(name: string): boolean;
}
/**
 * 任务协议命令类型
 */
export type TaskProtocolCommandType = 'create_task' | 'confirm_dispatch' | 'revise_draft' | 'cancel_task' | 'query_status';
/**
 * 任务协议解析结果
 */
export interface CreateTaskProtocol {
    command: 'create_task';
    projectKey: string;
    goal: string;
    constraints: string[];
    acceptanceCriteria: string[];
    rawText: string;
}
export interface ConfirmDispatchProtocol {
    command: 'confirm_dispatch';
    taskId: string;
    rawText: string;
}
export interface ReviseDraftProtocol {
    command: 'revise_draft';
    taskId: string;
    revisionText: string;
    rawText: string;
}
export interface CancelTaskProtocol {
    command: 'cancel_task';
    taskId: string;
    rawText: string;
}
export interface QueryStatusProtocol {
    command: 'query_status';
    taskId: string;
    rawText: string;
}
export type TaskProtocol = CreateTaskProtocol | ConfirmDispatchProtocol | ReviseDraftProtocol | CancelTaskProtocol | QueryStatusProtocol;
/**
 * 协议解析结果
 */
export interface ProtocolParseResult<T> {
    ok: true;
    data: T;
}
export interface ProtocolParseError {
    ok: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}
export type TaskProtocolResult<T> = ProtocolParseResult<T> | ProtocolParseError;
/**
 * 协议适配器接口
 * 负责解析文本协议（如 #研发任务 等指令）
 */
export interface ProtocolAdapter {
    /** 协议名称 */
    readonly name: string;
    /** 支持的语言 */
    readonly supportedLanguages: string[];
    /** 识别命令类型 */
    recognizeCommand(input: string): TaskProtocolResult<TaskProtocolCommandType>;
    /** 解析完整协议 */
    parse(input: string): TaskProtocolResult<TaskProtocol>;
    /** 标准化输入（去除多余空白等） */
    normalizeInput?(input: string): string;
}
/**
 * 协议注册表
 */
export interface ProtocolRegistry {
    /** 注册协议适配器 */
    register(adapter: ProtocolAdapter): void;
    /** 获取协议适配器 */
    get(name: string): ProtocolAdapter | undefined;
    /** 获取所有已注册的协议名称 */
    getRegisteredNames(): string[];
    /** 根据语言获取协议适配器 */
    getByLanguage(language: string): ProtocolAdapter | undefined;
}
//# sourceMappingURL=trigger-adapter.d.ts.map