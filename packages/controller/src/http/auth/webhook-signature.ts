import type { FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { ControllerErrorCode } from '@clawkit/shared';
import { buildFailureResponse } from '../types/api-response';

/**
 * Webhook 签名验证配置
 */
export interface WebhookSignatureConfig {
  /** 签名密钥 */
  secret: string;
  /** 签名 Header 名称（默认 X-Signature） */
  signatureHeader?: string;
  /** 时间戳 Header 名称（用于防重放） */
  timestampHeader?: string;
  /** 时间戳有效期（秒，0 表示不检查） */
  timestampTolerance?: number;
  /** 签名算法 */
  algorithm?: 'sha256' | 'sha1' | 'md5';
  /** 签名格式 */
  signatureFormat?: 'hex' | 'base64';
}

/**
 * Webhook 签名验证结果
 */
export interface SignatureVerificationResult {
  valid: boolean;
  error?: string;
  timestamp?: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<Omit<WebhookSignatureConfig, 'secret'>> = {
  signatureHeader: 'x-signature',
  timestampHeader: 'x-timestamp',
  timestampTolerance: 300, // 5 分钟
  algorithm: 'sha256',
  signatureFormat: 'hex',
};

/**
 * 解析时间戳
 */
function parseTimestamp(timestampStr: string | undefined, tolerance: number): { valid: boolean; timestamp?: number } {
  if (!timestampStr) {
    return { valid: false, timestamp: undefined };
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return { valid: false };
  }

  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - timestamp);

  if (diff > tolerance) {
    return { valid: false, timestamp };
  }

  return { valid: true, timestamp };
}

/**
 * 生成签名
 */
export function generateSignature(
  payload: string,
  secret: string,
  timestamp?: number,
  config?: Partial<WebhookSignatureConfig>,
): string {
  const alg = config?.algorithm ?? 'sha256';
  const format = config?.signatureFormat ?? 'hex';

  // 构建签名内容
  const signContent = timestamp !== undefined
    ? `${timestamp}.${payload}`
    : payload;

  const hmac = createHmac(alg, secret);
  hmac.update(signContent);

  return format === 'base64' ? hmac.digest('base64') : hmac.digest('hex');
}

/**
 * 验证签名（使用 timingSafeEqual 防止时序攻击）
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string,
  config?: Partial<WebhookSignatureConfig>,
): boolean {
  const alg = config?.algorithm ?? 'sha256';
  const format = config?.signatureFormat ?? 'hex';

  // 生成期望的签名
  const expectedSignature = generateSignature(payload, secret, undefined, config);

  // 比较签名
  try {
    if (format === 'base64') {
      const sigBuf = Buffer.from(signature, 'base64');
      const expectedBuf = Buffer.from(expectedSignature, 'base64');
      if (sigBuf.length !== expectedBuf.length) {
        return false;
      }
      return timingSafeEqual(sigBuf, expectedBuf);
    } else {
      const sigBuf = Buffer.from(signature, 'hex');
      const expectedBuf = Buffer.from(expectedSignature, 'hex');
      if (sigBuf.length !== expectedBuf.length) {
        return false;
      }
      return timingSafeEqual(sigBuf, expectedBuf);
    }
  } catch {
    return false;
  }
}

/**
 * 验证 Webhook 签名
 */
export function verifyWebhookSignature(
  request: FastifyRequest,
  config: WebhookSignatureConfig,
): SignatureVerificationResult {
  const finalConfig: Required<Omit<WebhookSignatureConfig, 'secret'>> = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // 读取签名
  const signatureHeader = request.headers[finalConfig.signatureHeader.toLowerCase()];
  const signature = typeof signatureHeader === 'string' ? signatureHeader.trim() : null;

  if (!signature) {
    return { valid: false, error: '缺少签名' };
  }

  // 读取时间戳（如果配置了检查）
  let timestamp: number | undefined;
  if (finalConfig.timestampTolerance > 0) {
    const timestampHeader = request.headers[finalConfig.timestampHeader.toLowerCase()];
    const timestampStr = typeof timestampHeader === 'string' ? timestampHeader.trim() : undefined;

    const timestampResult = parseTimestamp(timestampStr, finalConfig.timestampTolerance);
    if (!timestampResult.valid) {
      return { valid: false, error: '时间戳无效或已过期' };
    }
    timestamp = timestampResult.timestamp;
  }

  // 获取原始请求体
  // Fastify 会将请求体解析为对象，我们需要原始字符串进行签名验证
  let payload: string;
  
  if (typeof request.body === 'string') {
    payload = request.body;
  } else if (Buffer.isBuffer(request.body)) {
    payload = request.body.toString('utf8');
  } else if (request.body) {
    payload = JSON.stringify(request.body);
  } else {
    payload = '';
  }

  // 验证签名
  const isValid = verifySignature(payload, signature, config.secret, {
    algorithm: finalConfig.algorithm,
    signatureFormat: finalConfig.signatureFormat,
  });

  if (!isValid) {
    return { valid: false, error: '签名验证失败', timestamp };
  }

  return { valid: true, timestamp };
}

/**
 * Webhook 签名验证中间件
 */
export function registerWebhookSignatureVerification(
  path: string | string[],
  config: WebhookSignatureConfig,
) {
  const paths = Array.isArray(path) ? path : [path];
  const finalConfig: Required<Omit<WebhookSignatureConfig, 'secret'>> = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  return async function webhookSignatureHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const pathname = new URL(request.raw.url ?? request.url, 'http://localhost').pathname;

    // 检查路径是否需要验证
    const shouldVerify = paths.some(
      (p) => pathname === p || (p.endsWith('*') && pathname.startsWith(p.slice(0, -1))),
    );

    if (!shouldVerify) {
      return;
    }

    const result = verifyWebhookSignature(request, config);

    if (!result.valid) {
      // 记录验证失败（防止日志注入）
      const safePath = pathname.replace(/[^\w\-./]/g, '_');
      console.warn(`Webhook 签名验证失败: 路径=${safePath}, 错误=${result.error}, 来源=${request.ip}`);

      reply.status(401).send(
        buildFailureResponse(
          ControllerErrorCode.AUTH_UNAUTHORIZED,
          result.error ?? '签名验证失败',
          null,
        ),
      );
      return;
    }
  };
}

/**
 * 验证钉钉/飞书 Webhook 签名
 */
export function verifyDingtalkSignature(
  timestamp: string,
  signature: string,
  secret: string,
): boolean {
  const stringToSign = `${timestamp}\n${secret}`;
  const expectedSignature = createHmac('sha256', secret)
    .update(stringToSign)
    .digest('base64');

  try {
    const sigBuf = Buffer.from(signature, 'base64');
    const expectedBuf = Buffer.from(expectedSignature, 'base64');
    if (sigBuf.length !== expectedBuf.length) {
      return false;
    }
    return timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}
