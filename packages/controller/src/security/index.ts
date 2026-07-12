/**
 * 安全模块
 * 提供 API 鉴权、Webhook 签名验证、敏感信息加密、安全日志等功能
 */

// Auth 中间件
export { registerApiKeyAuth, generateApiKey, quickVerifyApiKey, type ApiKeyAuthConfig } from '../http/auth/api-key-auth';
export { verifyWebhookSignature, generateSignature, verifyDingtalkSignature, type WebhookSignatureConfig, type SignatureVerificationResult } from '../http/auth/webhook-signature';

// 加密工具
export { CryptoUtils, initDefaultCrypto, getDefaultCrypto, encryptSensitive, decryptSensitive, maskSensitive, sanitizeSensitiveData, isSensitiveField, EncryptionAlgorithm, type EncryptionConfig, type EncryptionResult } from '../utils/crypto';

// 安全日志
export { SecureLogger, createSecureLogger, LogLevel, type SecureLoggerConfig } from '../utils/secure-logger';
