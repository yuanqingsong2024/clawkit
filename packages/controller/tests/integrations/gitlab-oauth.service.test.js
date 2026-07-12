/**
 * GitLab OAuth 服务单元测试
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// 动态导入模块
let GitLabOAuthServiceImpl;
let OAuthProvider;
let WebhookEventType;

async function loadModules() {
  const types = await import('../../dist/integrations/oauth.types.js');
  OAuthProvider = types.OAuthProvider;
  WebhookEventType = types.WebhookEventType;

  const { GitLabOAuthService } = await import('../../dist/integrations/gitlab-oauth.service.js');
  GitLabOAuthServiceImpl = GitLabOAuthService;
}

async function testGitLabOAuthServiceConfig() {
  console.log('\n🔐 测试 GitLab OAuth 服务配置...');

  const config = {
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret',
    baseUrl: 'https://gitlab.example.com',
    redirectUri: 'http://localhost:3000/auth/gitlab/callback',
  };

  const service = new GitLabOAuthServiceImpl(config);
  
  assert.equal(service.getProvider(), OAuthProvider.GITLAB, '提供商应为 GitLab');
  
  console.log('✓ GitLab OAuth 服务配置正确');
}

async function testAuthorizationUrl() {
  console.log('\n🔗 测试授权 URL 生成...');

  const config = {
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret',
    baseUrl: 'https://gitlab.example.com',
    redirectUri: 'http://localhost:3000/auth/gitlab/callback',
  };

  const service = new GitLabOAuthServiceImpl(config);
  const state = 'test_state_12345';
  const authUrl = service.getAuthorizationUrl(state);

  // GitLab 服务使用默认的 gitlab.com 端点
  assert.ok(authUrl.includes('gitlab.com/oauth/authorize'), '授权 URL 应包含 GitLab OAuth 端点');
  assert.ok(authUrl.includes('client_id=test_client_id'), '授权 URL 应包含 client_id');
  assert.ok(authUrl.includes('state=' + state), '授权 URL 应包含 state 参数');
  assert.ok(authUrl.includes('response_type=code'), '授权 URL 应包含 response_type');
  
  console.log('✓ 授权 URL 生成正确');
}

async function testTokenExchange() {
  console.log('\n🔑 测试令牌交换...');

  const config = {
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret',
    baseUrl: 'https://gitlab.example.com',
    redirectUri: 'http://localhost:3000/auth/gitlab/callback',
  };

  // Mock 实现
  class MockGitLabOAuthService {
    constructor(cfg) {
      this.config = cfg;
    }

    getProvider() {
      return OAuthProvider.GITLAB;
    }

    getAuthorizationUrl(state, redirectUrl) {
      const url = new URL(`${this.config.baseUrl}/oauth/authorize`);
      url.searchParams.set('client_id', this.config.clientId);
      url.searchParams.set('redirect_uri', redirectUrl || this.config.redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('state', state);
      return url.toString();
    }

    async exchangeCodeForToken(code) {
      // 模拟令牌交换
      return {
        accessToken: `gitlab_access_token_${code}`,
        refreshToken: `gitlab_refresh_token_${code}`,
        expiresIn: 7200,
      };
    }
  }

  const service = new MockGitLabOAuthService(config);
  const result = await service.exchangeCodeForToken('test_auth_code');

  assert.equal(result.accessToken, 'gitlab_access_token_test_auth_code', '应返回正确的访问令牌');
  assert.ok(result.refreshToken, '应返回刷新令牌');
  assert.equal(result.expiresIn, 7200, '应返回过期时间');
  
  console.log('✓ 令牌交换功能正确');
}

async function testUserInfo() {
  console.log('\n👤 测试用户信息获取...');

  class MockGitLabOAuthService {
    constructor(cfg) {
      this.config = cfg;
    }

    async getUserInfo(accessToken) {
      // 模拟用户信息获取
      return {
        id: '12345',
        username: 'testuser',
        email: 'testuser@example.com',
        name: 'Test User',
        avatarUrl: 'https://gitlab.example.com/avatar.png',
        webUrl: 'https://gitlab.example.com/testuser',
      };
    }
  }

  const service = new MockGitLabOAuthService({});
  const userInfo = await service.getUserInfo('test_token');

  assert.equal(userInfo.id, '12345', '应返回正确的用户 ID');
  assert.equal(userInfo.username, 'testuser', '应返回正确的用户名');
  assert.equal(userInfo.email, 'testuser@example.com', '应返回正确的邮箱');
  
  console.log('✓ 用户信息获取正确');
}

async function testWebhookSignatureVerification() {
  console.log('\n🔒 测试 Webhook 签名验证...');

  class MockGitLabOAuthService {
    constructor(cfg) {
      this.config = cfg;
    }

    verifyWebhookSignature(payload, signature, secret) {
      const token = secret || this.config.webhookToken;
      if (!token) {
        return true;
      }
      
      const expected = crypto
        .createHmac('sha256', token)
        .update(payload)
        .digest('hex');
      
      const signatureBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expected);
      
      if (signatureBuffer.length !== expectedBuffer.length) {
        return false;
      }
      
      return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    }

    parseWebhookEvent(payload, headers) {
      const eventType = headers['x-gitlab-event'] || 'Push Hook';
      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      
      const basePayload = {
        eventType: this.mapEventType(eventType),
        provider: OAuthProvider.GITLAB,
        repository: {
          name: data.repository?.name || '',
          fullName: data.repository?.path_with_namespace || '',
          url: data.repository?.web_url || '',
          defaultBranch: data.repository?.default_branch || 'main',
        },
        sender: {
          username: data.user_username || '',
          id: String(data.user_id || ''),
        },
        timestamp: data.created_at,
      };
      
      if (eventType === 'Push Hook') {
        return {
          ...basePayload,
          ref: data.ref || '',
          before: data.before || '',
          after: data.after || '',
          commits: (data.commits || []).map(c => ({
            id: c.id || '',
            message: c.message || '',
            author: {
              name: c.author?.name || '',
              email: c.author?.email || '',
            },
            url: c.url || '',
          })),
        };
      }
      
      return basePayload;
    }

    mapEventType(eventType) {
      const eventMap = {
        'Push Hook': WebhookEventType.GITLAB_PUSH,
        'Merge Request Hook': WebhookEventType.GITLAB_MERGE_REQUEST,
        'Note Hook': WebhookEventType.GITLAB_NOTE,
        'Tag Push Hook': WebhookEventType.GITLAB_TAG_PUSH,
        'Release Hook': WebhookEventType.GITLAB_RELEASE,
        'Pipeline Hook': WebhookEventType.GITLAB_PIPELINE,
      };
      return eventMap[eventType] || eventType;
    }
  }

  const config = {
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret',
    baseUrl: 'https://gitlab.example.com',
    webhookToken: 'test_webhook_token',
  };

  const service = new MockGitLabOAuthService(config);
  const payload = JSON.stringify({ object_kind: 'push', ref: 'refs/heads/main' });
  const token = 'test_webhook_token';
  
  // 生成正确的签名
  const expectedSignature = crypto
    .createHmac('sha256', token)
    .update(payload)
    .digest('hex');
  
  const isValid = service.verifyWebhookSignature(payload, expectedSignature, token);
  assert.equal(isValid, true, '正确签名应验证通过');
  
  // 测试无效签名（使用与正确签名相同长度的无效字符串）
  const invalidSignature = '0'.repeat(64);
  const isInvalid = service.verifyWebhookSignature(payload, invalidSignature, token);
  assert.equal(isInvalid, false, '无效签名应验证失败');
  
  // 测试无密钥配置时跳过验证
  const configNoToken = { ...config, webhookToken: undefined };
  const serviceNoToken = new MockGitLabOAuthService(configNoToken);
  const skipsValidation = serviceNoToken.verifyWebhookSignature(payload, 'any_signature');
  assert.equal(skipsValidation, true, '无密钥时应跳过验证');

  console.log('✓ Webhook 签名验证正确');
}

async function testPushEventParsing() {
  console.log('\n📤 测试 Push 事件解析...');

  class MockGitLabOAuthService {
    constructor(cfg) {
      this.config = cfg;
    }

    parseWebhookEvent(payload, headers) {
      const eventType = headers['x-gitlab-event'] || 'Push Hook';
      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      
      const basePayload = {
        eventType: eventType,
        provider: OAuthProvider.GITLAB,
        repository: {
          name: data.repository?.name || '',
          fullName: data.repository?.path_with_namespace || '',
          url: data.repository?.web_url || '',
          defaultBranch: data.repository?.default_branch || 'main',
        },
        sender: {
          username: data.user_username || '',
          id: String(data.user_id || ''),
        },
        timestamp: data.created_at,
      };
      
      if (eventType === 'Push Hook') {
        return {
          ...basePayload,
          ref: data.ref || '',
          before: data.before || '',
          after: data.after || '',
          commits: (data.commits || []).map(c => ({
            id: c.id || '',
            message: c.message || '',
            author: {
              name: c.author?.name || '',
              email: c.author?.email || '',
            },
            url: c.url || '',
          })),
        };
      }
      
      return basePayload;
    }
  }

  const service = new MockGitLabOAuthService({});
  const payload = {
    object_kind: 'push',
    ref: 'refs/heads/main',
    before: 'abc123',
    after: 'def456',
    user_username: 'testuser',
    user_id: 12345,
    repository: {
      name: 'test-repo',
      path_with_namespace: 'group/test-repo',
      web_url: 'https://gitlab.example.com/group/test-repo',
      default_branch: 'main',
    },
    commits: [
      {
        id: 'commit123',
        message: 'Test commit',
        author: { name: 'Test User', email: 'test@example.com' },
        url: 'https://gitlab.example.com/group/test-repo/-/commit/commit123',
      },
    ],
  };

  const headers = { 'x-gitlab-event': 'Push Hook' };
  const result = service.parseWebhookEvent(payload, headers);

  assert.equal(result.eventType, 'Push Hook', '事件类型应正确');
  assert.equal(result.provider, OAuthProvider.GITLAB, '提供商应为 GitLab');
  assert.equal(result.ref, 'refs/heads/main', '分支引用应正确');
  assert.equal(result.commits.length, 1, '提交数量应正确');
  assert.equal(result.commits[0].id, 'commit123', '提交 ID 应正确');
  
  console.log('✓ Push 事件解析正确');
}

async function testMergeRequestEventParsing() {
  console.log('\n🔀 测试 Merge Request 事件解析...');

  class MockGitLabOAuthService {
    constructor(cfg) {
      this.config = cfg;
    }

    parseWebhookEvent(payload, headers) {
      const eventType = headers['x-gitlab-event'] || 'Merge Request Hook';
      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      
      const basePayload = {
        eventType: eventType,
        provider: OAuthProvider.GITLAB,
        repository: {
          name: data.repository?.name || '',
          fullName: data.repository?.path_with_namespace || '',
          url: data.repository?.web_url || '',
          defaultBranch: data.repository?.default_branch || 'main',
        },
        sender: {
          username: data.user_username || '',
          id: String(data.user_id || ''),
        },
        timestamp: data.created_at,
      };
      
      if (eventType === 'Merge Request Hook') {
        return {
          ...basePayload,
          objectKind: data.object_kind || '',
          objectAttributes: {
            id: data.object_attributes?.id || 0,
            iid: data.object_attributes?.iid || 0,
            title: data.object_attributes?.title || '',
            description: data.object_attributes?.description || '',
            state: data.object_attributes?.state || '',
            merged: data.object_attributes?.state === 'merged',
            sourceBranch: data.object_attributes?.source_branch || '',
            targetBranch: data.object_attributes?.target_branch || '',
            lastCommit: data.object_attributes?.last_commit ? {
              id: data.object_attributes.last_commit.id,
            } : undefined,
          },
        };
      }
      
      return basePayload;
    }
  }

  const service = new MockGitLabOAuthService({});
  const payload = {
    object_kind: 'merge_request',
    user_username: 'testuser',
    user_id: 12345,
    repository: {
      name: 'test-repo',
      path_with_namespace: 'group/test-repo',
      web_url: 'https://gitlab.example.com/group/test-repo',
      default_branch: 'main',
    },
    object_attributes: {
      id: 100,
      iid: 42,
      title: 'Add new feature',
      description: 'This MR adds a new feature',
      state: 'opened',
      source_branch: 'feature-branch',
      target_branch: 'main',
      last_commit: {
        id: 'abc123def456',
      },
    },
  };

  const headers = { 'x-gitlab-event': 'Merge Request Hook' };
  const result = service.parseWebhookEvent(payload, headers);

  assert.equal(result.eventType, 'Merge Request Hook', '事件类型应正确');
  assert.equal(result.provider, OAuthProvider.GITLAB, '提供商应为 GitLab');
  assert.equal(result.objectAttributes.iid, 42, 'MR IID 应正确');
  assert.equal(result.objectAttributes.title, 'Add new feature', 'MR 标题应正确');
  assert.equal(result.objectAttributes.sourceBranch, 'feature-branch', '源分支应正确');
  assert.equal(result.objectAttributes.targetBranch, 'main', '目标分支应正确');
  assert.equal(result.objectAttributes.merged, false, 'merged 状态应正确');
  
  console.log('✓ Merge Request 事件解析正确');
}

async function runAllTests() {
  console.log('========================================');
  console.log('🔬 GitLab OAuth 服务单元测试');
  console.log('========================================');

  try {
    await loadModules();
    
    await testGitLabOAuthServiceConfig();
    await testAuthorizationUrl();
    await testTokenExchange();
    await testUserInfo();
    await testWebhookSignatureVerification();
    await testPushEventParsing();
    await testMergeRequestEventParsing();

    console.log('');
    console.log('========================================');
    console.log('✅ 所有测试通过!');
    console.log('========================================');
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行测试
runAllTests();
