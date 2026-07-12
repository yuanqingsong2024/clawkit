const assert = require('node:assert/strict');
const { registerApiKeyAuth, generateApiKey, quickVerifyApiKey } = require('../dist/http/auth/api-key-auth');
const { generateSignature, verifySignature, verifyDingtalkSignature } = require('../dist/http/auth/webhook-signature');
const { CryptoUtils, encryptSensitive, decryptSensitive, maskSensitive, sanitizeSensitiveData, isSensitiveField, initDefaultCrypto } = require('../dist/utils/crypto');
const { SecureLogger, createSecureLogger, LogLevel } = require('../dist/utils/secure-logger');

// 测试 API Key 生成和验证
async function runApiKeyTests() {
  console.log('\n🔑 测试 API Key 生成与验证...');

  // 测试生成 API Key
  const apiKey1 = generateApiKey();
  const apiKey2 = generateApiKey('custom');
  const apiKey3 = generateApiKey('ck', 64);

  assert.ok(apiKey1.startsWith('ck_'), '默认前缀应为 ck_');
  assert.ok(apiKey2.startsWith('custom_'), '自定义前缀应生效');
  assert.ok(apiKey3.length > apiKey1.length, '更长长度应生成更长的 Key');
  assert.notEqual(apiKey1, apiKey2, '不同调用应生成不同的 Key');

  // 测试快速验证
  const validKeys = [apiKey1, apiKey2];
  assert.ok(quickVerifyApiKey(apiKey1, validKeys), '应验证通过有效的 Key');
  assert.ok(!quickVerifyApiKey('invalid', validKeys), '无效 Key 应验证失败');
  assert.ok(!quickVerifyApiKey(apiKey1, []), '空列表应验证失败');

  console.log('✓ API Key 生成与验证：功能正常');
}

// 测试 Webhook 签名
async function runWebhookSignatureTests() {
  console.log('\n🔐 测试 Webhook 签名...');

  const secret = 'test-secret-key';
  const payload = '{"event":"test","data":"hello"}';

  // 测试签名生成和验证
  const signature = generateSignature(payload, secret);
  assert.ok(signature.length > 0, '签名长度应大于 0');

  const isValid = verifySignature(payload, signature, secret);
  assert.ok(isValid, '正确的签名应验证通过');

  const isInvalid = verifySignature(payload, 'invalid-signature', secret);
  assert.ok(!isInvalid, '错误的签名应验证失败');

  // 测试带时间戳的签名
  const signatureWithTs = generateSignature(payload, secret, 1234567890);
  assert.ok(signatureWithTs.length > 0, '带时间戳的签名长度应大于 0');

  // 测试不同 secret 生成不同签名
  const sig1 = generateSignature(payload, secret);
  const sig2 = generateSignature(payload, 'different-secret');
  assert.notEqual(sig1, sig2, '不同 secret 应生成不同签名');

  // 测试钉钉签名验证
  const timestamp = '1234567890000';
  const dingtalkSign = require('crypto').createHmac('sha256', secret)
    .update(`${timestamp}\n${secret}`)
    .digest('base64');
  assert.ok(verifyDingtalkSignature(timestamp, dingtalkSign, secret), '钉钉签名应验证通过');
  assert.ok(!verifyDingtalkSignature(timestamp, 'invalid', secret), '无效钉钉签名应验证失败');

  console.log('✓ Webhook 签名：功能正常');
}

// 测试加密工具
async function runCryptoTests() {
  console.log('\n🔒 测试加密工具...');

  const crypto = new CryptoUtils({ key: 'test-encryption-key' });

  // 测试加密和解密
  const plaintext = '这是一个测试密码：SuperSecret123!';
  const encrypted = crypto.encrypt(plaintext);

  assert.ok(encrypted.encrypted, '应返回加密数据');
  assert.ok(encrypted.iv, '应返回 IV');
  assert.ok(encrypted.authTag, 'GCM 模式应返回 authTag');

  const decrypted = crypto.decrypt(encrypted.encrypted, encrypted.iv, encrypted.authTag);
  assert.equal(decrypted, plaintext, '解密后应还原原始数据');

  // 测试哈希
  const hash = crypto.hash('test data');
  assert.ok(hash.length === 64, 'SHA-256 哈希长度应为 64 字符');
  assert.equal(crypto.hash('test data'), crypto.hash('test data'), '相同数据应产生相同哈希');

  // 测试令牌生成
  const token1 = crypto.generateToken();
  const token2 = crypto.generateToken(16);
  assert.ok(token1.length === 64, '默认令牌长度应为 64');
  assert.ok(token2.length === 32, '指定长度的令牌长度应正确');
  assert.notEqual(token1, token2, '不同调用应生成不同的令牌');

  console.log('✓ CryptoUtils：功能正常');
}

// 测试敏感信息掩码
async function runMaskingTests() {
  console.log('\n🎭 测试敏感信息掩码...');

  // 测试掩码函数
  const masked1 = maskSensitive('1234567890', 4);
  assert.ok(masked1.startsWith('1234'), '应保留前4个字符');
  assert.ok(masked1.endsWith('7890'), '应保留后4个字符');
  assert.ok(masked1.includes('*'), '中间应被掩码');
  assert.equal(maskSensitive('short'), '*****', '短字符串应全部掩码');
  assert.ok(maskSensitive('password=secret', 0).includes('*'), '密码应被掩码');

  // 测试敏感字段检测
  assert.ok(isSensitiveField('password'), 'password 应被识别为敏感字段');
  assert.ok(isSensitiveField('apiKey'), 'apiKey 应被识别为敏感字段');
  assert.ok(isSensitiveField('X-API-Key'), 'X-API-Key 应被识别为敏感字段');
  assert.ok(!isSensitiveField('username'), 'username 不应被识别为敏感字段');
  assert.ok(!isSensitiveField('email'), 'email 不应被识别为敏感字段');
  assert.ok(!isSensitiveField('port'), 'port 不应被识别为敏感字段');

  // 测试数据脱敏
  const data = {
    username: 'john',
    password: 'secret123',
    token: 'jwt-token-here',
    email: 'john@example.com',
  };

  const sanitized = sanitizeSensitiveData(data);
  assert.equal(sanitized.username, 'john', 'username 应保留');
  assert.ok(sanitized.password !== 'secret123', 'password 应被掩码');
  assert.ok(sanitized.token !== 'jwt-token-here', 'token 应被掩码');
  assert.equal(sanitized.email, 'john@example.com', 'email 应保留');

  // 测试加密和解密函数
  initDefaultCrypto('test-key');
  const encrypted = encryptSensitive('my-secret');
  assert.ok(encrypted.encrypted, '应返回加密结果');

  const decrypted = decryptSensitive(encrypted.encrypted, encrypted.iv, encrypted.authTag);
  assert.equal(decrypted, 'my-secret', '应正确解密');

  console.log('✓ 敏感信息掩码：功能正常');
}

// 测试安全日志
async function runSecureLoggerTests() {
  console.log('\n📝 测试安全日志...');

  const logger = createSecureLogger('test', {
    maskSensitive: true,
    minLevel: LogLevel.DEBUG,
  });

  // 测试日志记录（不抛出异常即可）
  logger.debug('Debug message');
  logger.info('Info message', { key: 'value' });
  logger.warn('Warning message');
  logger.error('Error message');

  // 测试安全事件记录
  logger.security('login', 'user123', { ip: '192.168.1.1' });
  logger.security('auth_failure', undefined, { reason: 'invalid password' });

  // 测试认证事件记录
  logger.auth('success', 'user123');
  logger.auth('failure', 'user123', { reason: 'wrong password' });

  // 测试请求日志
  logger.request('GET', '/api/test', 200, 100);
  logger.request('POST', '/api/login', 401, 50);
  logger.request('GET', '/api/error', 500, 1000);

  // 测试数据脱敏
  const sensitiveData = {
    username: 'test',
    password: 'secret',
    token: 'jwt.token.here',
  };

  const sanitized = logger.sanitize(sensitiveData);
  assert.equal(sanitized.username, 'test', '非敏感字段应保留');
  assert.equal(sanitized.password, '***', 'password 应被掩码');
  assert.equal(sanitized.token, '***', 'token 应被掩码');

  console.log('✓ SecureLogger：功能正常');
}

// 运行所有测试
async function runAllSecurityTests() {
  console.log('\n========================================');
  console.log('安全加固服务单元测试');
  console.log('========================================');

  try {
    await runApiKeyTests();
    await runWebhookSignatureTests();
    await runCryptoTests();
    await runMaskingTests();
    await runSecureLoggerTests();

    console.log('\n========================================');
    console.log('✅ 所有安全加固服务测试通过');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ 测试失败：', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 导出测试函数
module.exports = { runAllSecurityTests };

// 如果直接运行此文件
if (require.main === module) {
  runAllSecurityTests();
}
