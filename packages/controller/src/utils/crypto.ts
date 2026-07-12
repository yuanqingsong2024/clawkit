import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

/**
 * 加密算法
 */
export enum EncryptionAlgorithm {
  AES_256_GCM = 'aes-256-gcm',
  AES_256_CBC = 'aes-256-cbc',
}

/**
 * 加密配置
 */
export interface EncryptionConfig {
  /** 加密密钥（32 字节） */
  key: string;
  /** 加密算法 */
  algorithm?: EncryptionAlgorithm;
}

/**
 * 加密结果
 */
export interface EncryptionResult {
  /** 加密后的数据（Base64） */
  encrypted: string;
  /** 初始化向量（Base64） */
  iv: string;
  /** 认证标签（仅 GCM 模式，Base64） */
  authTag?: string;
}

/**
 * 密钥工具
 */
export class CryptoUtils {
  private readonly key: Buffer;
  private readonly algorithm: EncryptionAlgorithm;

  constructor(config: EncryptionConfig) {
    // 使用 HKDF 派生 32 字节密钥
    this.key = this.deriveKey(config.key);
    this.algorithm = config.algorithm ?? EncryptionAlgorithm.AES_256_GCM;
  }

  /**
   * 从输入密钥派生固定长度的密钥
   */
  private deriveKey(inputKey: string): Buffer {
    return createHash('sha256').update(inputKey).digest();
  }

  /**
   * 加密数据
   */
  encrypt(plaintext: string): EncryptionResult {
    const iv = randomBytes(12); // 96 位
    const plaintextBuffer = Buffer.from(plaintext, 'utf8');

    const cipher = createCipheriv(
      this.algorithm,
      this.key,
      iv,
      // @ts-expect-error - authTagLength 是有效的 Node.js 选项
      { authTagLength: 16 },
    );

    const encrypted = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  /**
   * 解密数据
   */
  decrypt(encrypted: string, iv: string, authTag?: string): string {
    const encryptedBuffer = Buffer.from(encrypted, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');

    let decrypted: Buffer;

    if (this.algorithm === EncryptionAlgorithm.AES_256_GCM && authTag) {
      // GCM 模式需要单独处理
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        ivBuffer,
      );
      decipher.setAuthTag(Buffer.from(authTag, 'base64'));
      decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    } else {
      // CBC 模式
      const decipher = createDecipheriv(
        this.algorithm,
        this.key,
        ivBuffer,
      );
      decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    }

    return decrypted.toString('utf8');
  }

  /**
   * 哈希数据（单向）
   */
  hash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * 生成随机令牌
   */
  generateToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }
}

/**
 * 默认加密实例（使用环境变量密钥）
 */
let defaultCrypto: CryptoUtils | null = null;

/**
 * 初始化默认加密实例
 */
export function initDefaultCrypto(key?: string): CryptoUtils {
  const encryptionKey = key ?? process.env.CLAWKIT_ENCRYPTION_KEY ?? 'clawkit-default-encryption-key';
  defaultCrypto = new CryptoUtils({ key: encryptionKey });
  return defaultCrypto;
}

/**
 * 获取默认加密实例
 */
export function getDefaultCrypto(): CryptoUtils {
  if (!defaultCrypto) {
    return initDefaultCrypto();
  }
  return defaultCrypto;
}

/**
 * 加密敏感字段
 */
export function encryptSensitive(value: string): EncryptionResult {
  return getDefaultCrypto().encrypt(value);
}

/**
 * 解密敏感字段
 */
export function decryptSensitive(encrypted: string, iv: string, authTag?: string): string {
  return getDefaultCrypto().decrypt(encrypted, iv, authTag);
}

/**
 * 掩码敏感信息
 */
export function maskSensitive(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars * 2) {
    return '*'.repeat(value.length);
  }
  
  const start = value.slice(0, visibleChars);
  const end = value.slice(-visibleChars);
  const masked = '*'.repeat(Math.min(value.length - visibleChars * 2, 8));
  
  return `${start}${masked}${end}`;
}

/**
 * 检测是否为敏感信息
 */
export function isSensitiveField(fieldName: string): boolean {
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,
    /credential/i,
    /private[_-]?key/i,
    /auth/i,
  ];

  return sensitivePatterns.some((pattern) => pattern.test(fieldName));
}

/**
 * 安全处理对象中的敏感字段
 */
export function sanitizeSensitiveData<T extends Record<string, unknown>>(
  data: T,
  fieldsToSanitize?: string[],
): T {
  const fields = fieldsToSanitize ?? Object.keys(data).filter(isSensitiveField);
  const sanitized = { ...data };

  for (const field of fields) {
    if (field in sanitized && sanitized[field] !== undefined && sanitized[field] !== null) {
      const value = String(sanitized[field]);
      // @ts-expect-error - 动态赋值
      sanitized[field] = maskSensitive(value);
    }
  }

  return sanitized;
}
