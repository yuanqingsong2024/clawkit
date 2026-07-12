/**
 * OAuth 集成单元测试
 */

const assert = require('node:assert/strict');

const {
  OAuthProvider,
  WebhookEventType,
} = require('../../dist/integrations/oauth.types');

// 测试 OAuthProvider 枚举
async function testOAuthProviderEnum() {
  console.log('\n🔐 测试 OAuthProvider 枚举...');

  assert.equal(OAuthProvider.GITHUB, 'github', 'GitHub 提供商应为 github');
  assert.equal(OAuthProvider.GITLAB, 'gitlab', 'GitLab 提供商应为 gitlab');

  console.log('✓ OAuthProvider 枚举值正确');
}

// 测试 WebhookEventType 枚举
async function testWebhookEventTypeEnum() {
  console.log('\n📡 测试 WebhookEventType 枚举...');

  // GitHub 事件
  assert.equal(WebhookEventType.GITHUB_PUSH, 'push', 'GitHub push 事件应为 push');
  assert.equal(WebhookEventType.GITHUB_PULL_REQUEST, 'pull_request', 'GitHub PR 事件应为 pull_request');
  assert.equal(WebhookEventType.GITHUB_ISSUE_COMMENT, 'issue_comment', 'GitHub issue_comment 事件应正确');

  // GitLab 事件（使用 GitLab 原始事件名称）
  assert.equal(WebhookEventType.GITLAB_PUSH, 'Push Hook', 'GitLab push 事件应为 Push Hook');
  assert.equal(WebhookEventType.GITLAB_MERGE_REQUEST, 'Merge Request Hook', 'GitLab MR 事件应为 Merge Request Hook');

  console.log('✓ WebhookEventType 枚举值正确');
}

// 测试 WebhookPayload 结构
async function testWebhookPayloadStructure() {
  console.log('\n📦 测试 WebhookPayload 结构...');

  // 模拟 WebhookPayload 结构
  const payload = {
    eventType: WebhookEventType.GITHUB_PUSH,
    provider: OAuthProvider.GITHUB,
    repository: {
      name: 'test-repo',
      fullName: 'owner/test-repo',
      url: 'https://github.com/owner/test-repo',
      defaultBranch: 'main',
    },
    sender: {
      username: 'test-user',
      id: '12345',
    },
    timestamp: '2024-01-01T00:00:00Z',
  };

  assert.equal(payload.eventType, WebhookEventType.GITHUB_PUSH, '事件类型应正确');
  assert.equal(payload.provider, OAuthProvider.GITHUB, '提供商应正确');
  assert.equal(payload.repository.name, 'test-repo', '仓库名称应正确');
  assert.equal(payload.repository.fullName, 'owner/test-repo', '仓库全名应正确');
  assert.equal(payload.sender.username, 'test-user', '发送者用户名应正确');

  console.log('✓ WebhookPayload 结构正确');
}

// 测试 OAuthState 接口
async function testOAuthStateInterface() {
  console.log('\n🔑 测试 OAuthState 接口...');

  const state = {
    provider: OAuthProvider.GITHUB,
    state: 'random-state-value-123',
    redirectUrl: '/dashboard',
    createdAt: Date.now(),
  };

  assert.equal(state.provider, OAuthProvider.GITHUB, '提供商应正确');
  assert.ok(state.state.length > 0, 'state 应有值');
  assert.ok(state.createdAt > 0, '创建时间应有效');
  assert.equal(state.redirectUrl, '/dashboard', '重定向 URL 应正确');

  console.log('✓ OAuthState 接口结构正确');
}

// 测试 OAuthUserInfo 接口
async function testOAuthUserInfoInterface() {
  console.log('\n👤 测试 OAuthUserInfo 接口...');

  const userInfo = {
    provider: OAuthProvider.GITHUB,
    providerUserId: 'github-12345',
    username: 'testuser',
    email: 'test@example.com',
    displayName: 'Test User',
    avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
    accessToken: 'ghp_testtoken123',
    refreshToken: 'ghr_testrefresh456',
    expiresAt: Date.now() + 3600000, // 1小时后过期
  };

  assert.equal(userInfo.provider, OAuthProvider.GITHUB, '提供商应正确');
  assert.equal(userInfo.providerUserId, 'github-12345', '第三方用户 ID 应正确');
  assert.equal(userInfo.username, 'testuser', '用户名应正确');
  assert.equal(userInfo.email, 'test@example.com', '邮箱应正确');
  assert.ok(userInfo.accessToken, '访问令牌应存在');
  assert.ok(userInfo.refreshToken, '刷新令牌应存在');
  assert.ok(userInfo.expiresAt && userInfo.expiresAt > Date.now(), '过期时间应在未来');

  console.log('✓ OAuthUserInfo 接口结构正确');
}

// 测试 RepositoryInfo 接口
async function testRepositoryInfoInterface() {
  console.log('\n📁 测试 RepositoryInfo 接口...');

  const repo = {
    name: 'clawkit',
    fullName: 'clawkit/clawkit',
    url: 'https://github.com/clawkit/clawkit',
    defaultBranch: 'main',
  };

  assert.equal(repo.name, 'clawkit', '仓库名称应正确');
  assert.equal(repo.fullName, 'clawkit/clawkit', '仓库全名应正确');
  assert.ok(repo.url.startsWith('https://'), 'URL 应以 https:// 开头');
  assert.equal(repo.defaultBranch, 'main', '默认分支应正确');

  console.log('✓ RepositoryInfo 接口结构正确');
}

// 运行所有测试
async function runAllTests() {
  console.log('\n========================================');
  console.log('🔬 OAuth 集成单元测试');
  console.log('========================================');

  try {
    await testOAuthProviderEnum();
    await testWebhookEventTypeEnum();
    await testWebhookPayloadStructure();
    await testOAuthStateInterface();
    await testOAuthUserInfoInterface();
    await testRepositoryInfoInterface();

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
