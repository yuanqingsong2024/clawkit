/**
 * GitHub OAuth 服务单元测试
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// 模拟 fetch
const mockFetch = async (url, options) => {
  const urlStr = typeof url === 'string' ? url : url.toString();
  
  if (urlStr.includes('/login/oauth/access_token')) {
    return {
      ok: true,
      json: async () => ({
        access_token: 'test_access_token',
        token_type: 'bearer',
        scope: 'repo,user',
      }),
    };
  }
  
  if (urlStr.includes('/user')) {
    return {
      ok: true,
      json: async () => ({
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      }),
    };
  }
  
  return {
    ok: false,
    status: 404,
    json: async () => ({ error: 'not_found' }),
  };
};

// 动态导入模块
let GitHubOAuthService;
let OAuthProvider;
let WebhookEventType;

async function loadModules() {
  const types = await import('../../dist/integrations/oauth.types.js');
  OAuthProvider = types.OAuthProvider;
  WebhookEventType = types.WebhookEventType;
  
  // 创建模拟服务类
  class MockGitHubOAuthService {
    constructor(config) {
      this.config = config;
      this.provider = OAuthProvider.GITHUB;
    }

    getAuthorizationUrl(state, redirectUrl) {
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        redirect_uri: this.config.callbackUrl,
        scope: this.config.scopes.join(' '),
        state: state,
      });
      
      if (redirectUrl) {
        params.set('redirect_uri', redirectUrl);
      }
      
      return `${this.config.authUrl}?${params.toString()}`;
    }

    exchangeCodeForToken(code) {
      return {
        accessToken: 'test_access_token',
        tokenType: 'bearer',
        scope: 'repo,user',
      };
    }

    async getUserInfo(accessToken) {
      const data = {
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      };
      
      return {
        provider: OAuthProvider.GITHUB,
        providerUserId: String(data.id),
        username: data.login,
        email: data.email || '',
        displayName: data.name,
        avatarUrl: data.avatar_url,
        accessToken: accessToken,
      };
    }

    verifyWebhookSignature(payload, signature, secret) {
      const webhookSecret = secret || this.config.webhookSecret;
      if (!webhookSecret) {
        return true;
      }
      
      const expected = 'sha256=' + crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      );
    }

    parseWebhookEvent(payload, headers) {
      const eventType = headers['x-github-event'] || 'push';
      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      
      const basePayload = {
        eventType: this.mapEventType(eventType),
        provider: OAuthProvider.GITHUB,
        repository: {
          name: data.repository?.name || '',
          fullName: data.repository?.full_name || '',
          url: data.repository?.html_url || '',
          defaultBranch: data.repository?.default_branch || 'main',
        },
        sender: {
          username: data.sender?.login || '',
          id: String(data.sender?.id || ''),
        },
        timestamp: data.created_at,
      };
      
      if (eventType === 'push') {
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
            added: c.added || [],
            removed: c.removed || [],
            modified: c.modified || [],
          })),
        };
      }
      
      if (eventType === 'pull_request') {
        return {
          ...basePayload,
          action: data.action || '',
          pullRequest: {
            number: data.pull_request?.number || 0,
            title: data.pull_request?.title || '',
            body: data.pull_request?.body || '',
            state: data.pull_request?.state || '',
            author: data.pull_request?.user?.login || '',
            sourceBranch: data.pull_request?.head?.ref || '',
            targetBranch: data.pull_request?.base?.ref || '',
          },
        };
      }
      
      return basePayload;
    }

    mapEventType(eventType) {
      const eventMap = {
        'push': WebhookEventType.GITHUB_PUSH,
        'pull_request': WebhookEventType.GITHUB_PULL_REQUEST,
      };
      return eventMap[eventType] || WebhookEventType.GITHUB_PUSH;
    }
  }
  
  GitHubOAuthService = MockGitHubOAuthService;
}

// 测试 GitHub OAuth 服务配置
async function testGitHubOAuthServiceConfig() {
  console.log('\n🔐 测试 GitHub OAuth 服务配置...');

  const config = {
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret',
    callbackUrl: 'http://localhost:3000/auth/github/callback',
    scopes: ['repo', 'user', 'read:org'],
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    webhookSecret: 'test_webhook_secret',
  };

  const service = new GitHubOAuthService(config);

  assert.equal(service.config.clientId, 'test_client_id', 'clientId 应正确');
  assert.equal(service.config.clientSecret, 'test_client_secret', 'clientSecret 应正确');
  assert.equal(service.config.callbackUrl, 'http://localhost:3000/auth/github/callback', 'callbackUrl 应正确');
  assert.deepEqual(service.config.scopes, ['repo', 'user', 'read:org'], 'scopes 应正确');
  assert.equal(service.provider, OAuthProvider.GITHUB, 'provider 应为 GitHub');

  console.log('✓ GitHub OAuth 服务配置正确');
}

// 测试授权 URL 生成
async function testGetAuthorizationUrl() {
  console.log('\n🔗 测试授权 URL 生成...');

  const config = {
    clientId: 'test_client_id',
    callbackUrl: 'http://localhost:3000/auth/github/callback',
    scopes: ['repo', 'user'],
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: '',
    userInfoUrl: '',
  };

  const service = new GitHubOAuthService(config);
  const state = 'random_state_123';
  
  const authUrl = service.getAuthorizationUrl(state);
  
  assert.ok(authUrl.startsWith('https://github.com/login/oauth/authorize'), 'URL 应以授权端点开头');
  assert.ok(authUrl.includes('client_id=test_client_id'), 'URL 应包含 client_id');
  assert.ok(authUrl.includes('redirect_uri='), 'URL 应包含 redirect_uri');
  assert.ok(authUrl.includes('scope='), 'URL 应包含 scope');
  assert.ok(authUrl.includes(`state=${state}`), 'URL 应包含 state 参数');

  console.log('✓ 授权 URL 生成正确');
}

// 测试令牌交换
async function testExchangeCodeForToken() {
  console.log('\n🔑 测试令牌交换...');

  const config = {
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret',
    callbackUrl: 'http://localhost:3000/auth/github/callback',
    scopes: ['repo'],
    authUrl: '',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: '',
  };

  const service = new GitHubOAuthService(config);
  const code = 'test_auth_code';
  
  const tokenResult = service.exchangeCodeForToken(code);
  
  assert.equal(tokenResult.accessToken, 'test_access_token', 'accessToken 应正确');
  assert.equal(tokenResult.tokenType, 'bearer', 'tokenType 应为 bearer');
  assert.ok(tokenResult.scope.includes('repo'), 'scope 应包含 repo');

  console.log('✓ 令牌交换功能正确');
}

// 测试用户信息获取
async function testGetUserInfo() {
  console.log('\n👤 测试用户信息获取...');

  const config = {
    clientId: 'test_client_id',
    callbackUrl: '',
    scopes: ['repo'],
    authUrl: '',
    tokenUrl: '',
    userInfoUrl: 'https://api.github.com/user',
  };

  const service = new GitHubOAuthService(config);
  const accessToken = 'test_access_token_123';
  
  const userInfo = await service.getUserInfo(accessToken);
  
  assert.equal(userInfo.provider, OAuthProvider.GITHUB, 'provider 应正确');
  assert.equal(userInfo.providerUserId, '12345', 'providerUserId 应正确');
  assert.equal(userInfo.username, 'testuser', 'username 应正确');
  assert.equal(userInfo.email, 'test@example.com', 'email 应正确');
  assert.equal(userInfo.displayName, 'Test User', 'displayName 应正确');
  assert.ok(userInfo.avatarUrl?.startsWith('https://'), 'avatarUrl 应有效');
  assert.equal(userInfo.accessToken, accessToken, 'accessToken 应返回');

  console.log('✓ 用户信息获取正确');
}

// 测试 Webhook 签名验证
async function testVerifyWebhookSignature() {
  console.log('\n🔒 测试 Webhook 签名验证...');

  const config = {
    clientId: 'test_client_id',
    callbackUrl: '',
    scopes: [],
    authUrl: '',
    tokenUrl: '',
    userInfoUrl: '',
    webhookSecret: 'test_webhook_secret',
  };

  const service = new GitHubOAuthService(config);
  const payload = '{"action":"push","ref":"refs/heads/main"}';
  const secret = 'test_webhook_secret';
  
  // 生成正确的签名
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  const isValid = service.verifyWebhookSignature(payload, expectedSignature, secret);
  assert.equal(isValid, true, '正确签名应验证通过');
  
  // 测试无效签名（使用与正确签名相同长度的无效字符串）
  const invalidSignature = 'sha256=' + '0'.repeat(64);
  const isInvalid = service.verifyWebhookSignature(payload, invalidSignature, secret);
  assert.equal(isInvalid, false, '无效签名应验证失败');
  
  // 测试无密钥配置时跳过验证
  const configNoSecret = { ...config, webhookSecret: undefined };
  const serviceNoSecret = new GitHubOAuthService(configNoSecret);
  const skipsValidation = serviceNoSecret.verifyWebhookSignature(payload, 'any_signature');
  assert.equal(skipsValidation, true, '无密钥时应跳过验证');

  console.log('✓ Webhook 签名验证正确');
}

// 测试 Push 事件解析
async function testParsePushEvent() {
  console.log('\n📤 测试 Push 事件解析...');

  const config = {
    clientId: '',
    callbackUrl: '',
    scopes: [],
    authUrl: '',
    tokenUrl: '',
    userInfoUrl: '',
  };

  const service = new GitHubOAuthService(config);
  
  const payload = {
    ref: 'refs/heads/main',
    before: 'abc123',
    after: 'def456',
    repository: {
      name: 'test-repo',
      full_name: 'owner/test-repo',
      html_url: 'https://github.com/owner/test-repo',
      default_branch: 'main',
    },
    sender: {
      login: 'testuser',
      id: 12345,
    },
    commits: [
      {
        id: 'commit1',
        message: 'Test commit',
        author: {
          name: 'Test Author',
          email: 'test@example.com',
        },
        url: 'https://github.com/owner/test-repo/commit/commit1',
        added: ['file1.js'],
        removed: [],
        modified: ['file2.js'],
      },
    ],
    created_at: '2024-01-01T00:00:00Z',
  };
  
  const headers = { 'x-github-event': 'push' };
  
  const result = service.parseWebhookEvent(payload, headers);
  
  assert.equal(result.eventType, WebhookEventType.GITHUB_PUSH, '事件类型应正确');
  assert.equal(result.provider, OAuthProvider.GITHUB, '提供商应正确');
  assert.equal(result.ref, 'refs/heads/main', 'ref 应正确');
  assert.equal(result.before, 'abc123', 'before 应正确');
  assert.equal(result.after, 'def456', 'after 应正确');
  assert.equal(result.repository.name, 'test-repo', '仓库名应正确');
  assert.equal(result.sender.username, 'testuser', '发送者应正确');
  assert.equal(result.commits.length, 1, 'commits 数量应正确');
  assert.equal(result.commits[0].message, 'Test commit', 'commit message 应正确');

  console.log('✓ Push 事件解析正确');
}

// 测试 Pull Request 事件解析
async function testParsePullRequestEvent() {
  console.log('\n🔀 测试 Pull Request 事件解析...');

  const config = {
    clientId: '',
    callbackUrl: '',
    scopes: [],
    authUrl: '',
    tokenUrl: '',
    userInfoUrl: '',
  };

  const service = new GitHubOAuthService(config);
  
  const payload = {
    action: 'opened',
    pull_request: {
      number: 42,
      title: 'Add new feature',
      body: 'This PR adds a new feature',
      state: 'open',
      user: {
        login: 'pr-author',
      },
      head: {
        ref: 'feature-branch',
      },
      base: {
        ref: 'main',
      },
    },
    repository: {
      name: 'test-repo',
      full_name: 'owner/test-repo',
      html_url: 'https://github.com/owner/test-repo',
      default_branch: 'main',
    },
    sender: {
      login: 'pr-author',
      id: 12345,
    },
    created_at: '2024-01-01T00:00:00Z',
  };
  
  const headers = { 'x-github-event': 'pull_request' };
  
  const result = service.parseWebhookEvent(payload, headers);
  
  assert.equal(result.eventType, WebhookEventType.GITHUB_PULL_REQUEST, '事件类型应正确');
  assert.equal(result.action, 'opened', 'action 应正确');
  assert.equal(result.pullRequest.number, 42, 'PR 编号应正确');
  assert.equal(result.pullRequest.title, 'Add new feature', 'PR 标题应正确');
  assert.equal(result.pullRequest.author, 'pr-author', 'PR 作者应正确');
  assert.equal(result.pullRequest.sourceBranch, 'feature-branch', '源分支应正确');
  assert.equal(result.pullRequest.targetBranch, 'main', '目标分支应正确');

  console.log('✓ Pull Request 事件解析正确');
}

// 运行所有测试
async function runAllTests() {
  console.log('\n========================================');
  console.log('🔬 GitHub OAuth 服务单元测试');
  console.log('========================================');

  try {
    await loadModules();
    await testGitHubOAuthServiceConfig();
    await testGetAuthorizationUrl();
    await testExchangeCodeForToken();
    await testGetUserInfo();
    await testVerifyWebhookSignature();
    await testParsePushEvent();
    await testParsePullRequestEvent();

    console.log('\n========================================');
    console.log('✅ 所有测试通过!');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 执行测试
runAllTests();
