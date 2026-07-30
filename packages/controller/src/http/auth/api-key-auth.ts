import type { FastifyInstance, FastifyReply, FastifyRequest, HookHandlerDoneFunction } from 'fastify';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { ControllerErrorCode, createLogger } from '@clawkit/shared';
import { buildFailureResponse } from '../types/api-response';

const logger = createLogger('controller.auth.api-key');

/**
 * API Key 鉴权配置
 */
export interface ApiKeyAuthConfig {
  /** 是否启用 API Key 鉴权 */
  enabled?: boolean;
  /** API Keys 列表 */
  apiKeys?: string[];
  /** Header 名称（默认 X-API-Key） */
  headerName?: string;
  /** 排除的路径（不需要认证） */
  excludePaths?: string[];
  /** 是否允许在查询参数中传递 API Key */
  allowQueryParam?: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<Omit<ApiKeyAuthConfig, 'apiKeys'>> = {
  enabled: false,
  headerName: 'x-api-key',
  excludePaths: [
    '/health',
    '/api/health',
    '/ready',
    '/live',
    '/api/metrics',
    '/api/metrics/task',
    '/api/metrics/system',
    '/api/metrics/worker',
    '/api/metrics/alerts/active',
  ],
  allowQueryParam: false,
};

/**
 * 生成 API Key
 */
export function generateApiKey(prefix: string = 'ck', length: number = 32): string {
  const randomPart = randomBytes(length).toString('hex');
  return `${prefix}_${randomPart}`;
}

/**
 * 创建安全的字符串比较函数
 * 防止时序攻击
 */
function safeStringCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return timingSafeEqual(bufA, bufB);
  } catch (error) {
    logger.debug('安全字符串比较失败', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/**
 * 验证 API Key
 */
function verifyApiKey(apiKey: string, validKeys: string[]): boolean {
  for (const validKey of validKeys) {
    if (safeStringCompare(apiKey, validKey)) {
      return true;
    }
  }
  return false;
}

/**
 * 读取 API Key
 */
function readApiKey(request: FastifyRequest, config: Required<ApiKeyAuthConfig>): string | null {
  // 从 Header 读取
  const headerValue = request.headers[config.headerName.toLowerCase()];
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim();
  }

  // 从 Authorization Header 读取（Bearer 格式）
  const authHeader = request.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token) {
      return token;
    }
  }

  // 从查询参数读取（如果允许）
  if (config.allowQueryParam) {
    const query = request.query as Record<string, string | undefined>;
    const queryKey = query.apiKey ?? query.api_key;
    if (typeof queryKey === 'string' && queryKey.trim()) {
      return queryKey.trim();
    }
  }

  return null;
}

/**
 * 检查路径是否需要认证
 */
function needsAuth(pathname: string, excludePaths: string[]): boolean {
  for (const excludePath of excludePaths) {
    if (pathname === excludePath || pathname.startsWith(`${excludePath}/`)) {
      return false;
    }
  }
  return true;
}

/**
 * 注册 API Key 鉴权中间件
 */
export function registerApiKeyAuth(
  app: FastifyInstance,
  config: ApiKeyAuthConfig,
): void {
  // 如果未启用或没有配置 API Keys，不注册中间件
  if (!config.enabled || !config.apiKeys || config.apiKeys.length === 0) {
    return;
  }

  const finalConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    apiKeys: config.apiKeys, // 确保 apiKeys 存在
  };

  console.log(`API Key 鉴权已启用，共 ${config.apiKeys.length} 个有效 Key`);

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const pathname = new URL(request.raw.url ?? request.url, 'http://localhost').pathname;

    // 检查是否需要认证
    if (!needsAuth(pathname, finalConfig.excludePaths)) {
      return;
    }

    // 读取 API Key
    const apiKey = readApiKey(request, finalConfig);

    if (!apiKey) {
      reply.status(401).send(
        buildFailureResponse(
          ControllerErrorCode.AUTH_UNAUTHORIZED,
          '缺少 API Key，请提供有效的 API Key',
          null,
        ),
      );
      return;
    }

    // 验证 API Key
    if (!verifyApiKey(apiKey, config.apiKeys ?? [])) {
      // 记录失败尝试（防止日志注入）
      const safePath = pathname.replace(/[^\w\-./]/g, '_');
      console.warn(`API Key 验证失败: 路径=${safePath}, 来源=${request.ip}`);

      reply.status(401).send(
        buildFailureResponse(
          ControllerErrorCode.AUTH_UNAUTHORIZED,
          'API Key 无效',
          null,
        ),
      );
      return;
    }
  });
}

/**
 * 快速验证 API Key（用于单次请求验证）
 */
export function quickVerifyApiKey(
  apiKey: string,
  validKeys: string[],
): boolean {
  if (!apiKey || !validKeys || validKeys.length === 0) {
    return false;
  }
  return verifyApiKey(apiKey, validKeys);
}
