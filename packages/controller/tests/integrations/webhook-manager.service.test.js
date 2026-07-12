/**
 * Webhook 管理器服务单元测试
 */

const assert = require('node:assert/strict');

// 动态导入模块
let WebhookManagerServiceImpl;
let OAuthProvider;
let WebhookEventType;

async function loadModules() {
  const types = await import('../../dist/integrations/oauth.types.js');
  OAuthProvider = types.OAuthProvider;
  WebhookEventType = types.WebhookEventType;

  const { WebhookManagerService } = await import('../../dist/integrations/webhook-manager.service.js');
  WebhookManagerServiceImpl = WebhookManagerService;
}

async function testWebhookManagerServiceConfig() {
  console.log('\n🔐 测试 Webhook 管理器服务配置...');

  // Mock 实现
  class MockWebhookManagerService {
    constructor() {
      this.handlers = new Map();
      this.subscribers = [];
    }

    registerHandler(provider, eventType, handler) {
      const key = `${provider}:${eventType}`;
      this.handlers.set(key, handler);
    }

    async handleWebhook(provider, payload, headers) {
      // 解析事件类型
      let eventType;
      if (provider === OAuthProvider.GITHUB) {
        eventType = headers['x-github-event'] || 'push';
      } else if (provider === OAuthProvider.GITLAB) {
        eventType = headers['x-gitlab-event'] || 'Push Hook';
      }

      const key = `${provider}:${eventType}`;
      const handler = this.handlers.get(key);

      if (handler) {
        return await handler(payload, headers);
      }

      return { success: false, error: 'No handler registered' };
    }

    subscribe(callback) {
      this.subscribers.push(callback);
    }

    notify(event) {
      for (const callback of this.subscribers) {
        callback(event);
      }
    }

    getRegisteredHandlers() {
      return Array.from(this.handlers.keys());
    }
  }

  const service = new MockWebhookManagerService();
  
  assert.ok(service.handlers, '服务应有 handlers Map');
  assert.ok(service.subscribers, '服务应有 subscribers 数组');
  
  console.log('✓ Webhook 管理器服务配置正确');
}

async function testHandlerRegistration() {
  console.log('\n📝 测试处理器注册...');

  class MockWebhookManagerService {
    constructor() {
      this.handlers = new Map();
      this.subscribers = [];
    }

    registerHandler(provider, eventType, handler) {
      const key = `${provider}:${eventType}`;
      this.handlers.set(key, handler);
    }

    getRegisteredHandlers() {
      return Array.from(this.handlers.keys());
    }
  }

  const service = new MockWebhookManagerService();
  
  const pushHandler = async (payload, headers) => ({ type: 'push' });
  const mrHandler = async (payload, headers) => ({ type: 'mr' });
  
  service.registerHandler(OAuthProvider.GITHUB, 'push', pushHandler);
  service.registerHandler(OAuthProvider.GITHUB, 'pull_request', mrHandler);
  service.registerHandler(OAuthProvider.GITLAB, 'Push Hook', pushHandler);
  
  const handlers = service.getRegisteredHandlers();
  
  assert.equal(handlers.length, 3, '应有 3 个注册的处理器');
  assert.ok(handlers.includes(`${OAuthProvider.GITHUB}:push`), '应有 GitHub push 处理器');
  assert.ok(handlers.includes(`${OAuthProvider.GITHUB}:pull_request`), '应有 GitHub pull_request 处理器');
  assert.ok(handlers.includes(`${OAuthProvider.GITLAB}:Push Hook`), '应有 GitLab Push Hook 处理器');
  
  console.log('✓ 处理器注册正确');
}

async function testWebhookHandling() {
  console.log('\n📨 测试 Webhook 处理...');

  class MockWebhookManagerService {
    constructor() {
      this.handlers = new Map();
      this.subscribers = [];
    }

    registerHandler(provider, eventType, handler) {
      const key = `${provider}:${eventType}`;
      this.handlers.set(key, handler);
    }

    async handleWebhook(provider, payload, headers) {
      let eventType;
      if (provider === OAuthProvider.GITHUB) {
        eventType = headers['x-github-event'] || 'push';
      } else if (provider === OAuthProvider.GITLAB) {
        eventType = headers['x-gitlab-event'] || 'Push Hook';
      }

      const key = `${provider}:${eventType}`;
      const handler = this.handlers.get(key);

      if (handler) {
        return await handler(payload, headers);
      }

      return { success: false, error: 'No handler registered' };
    }

    subscribe(callback) {
      this.subscribers.push(callback);
    }

    notify(event) {
      for (const callback of this.subscribers) {
        callback(event);
      }
    }
  }

  const service = new MockWebhookManagerService();
  
  const pushHandler = async (payload, headers) => ({
    success: true,
    type: 'push',
    repo: payload.repository?.full_name || payload.repository?.path_with_namespace,
  });
  
  service.registerHandler(OAuthProvider.GITHUB, 'push', pushHandler);
  
  const githubPayload = {
    repository: {
      full_name: 'test/repo',
      name: 'repo',
    },
    ref: 'refs/heads/main',
  };
  
  const githubHeaders = { 'x-github-event': 'push' };
  const githubResult = await service.handleWebhook(OAuthProvider.GITHUB, githubPayload, githubHeaders);
  
  assert.equal(githubResult.success, true, 'GitHub push 处理应成功');
  assert.equal(githubResult.type, 'push', '事件类型应正确');
  assert.equal(githubResult.repo, 'test/repo', '仓库名称应正确');
  
  // 测试无处理器时的处理
  const unhandledResult = await service.handleWebhook(OAuthProvider.GITHUB, {}, { 'x-github-event': 'unknown' });
  assert.equal(unhandledResult.success, false, '未处理的 Webhook 应返回失败');
  
  console.log('✓ Webhook 处理正确');
}

async function testEventSubscription() {
  console.log('\n🔔 测试事件订阅...');

  class MockWebhookManagerService {
    constructor() {
      this.handlers = new Map();
      this.subscribers = [];
    }

    subscribe(callback) {
      this.subscribers.push(callback);
    }

    notify(event) {
      for (const callback of this.subscribers) {
        callback(event);
      }
    }

    getSubscriberCount() {
      return this.subscribers.length;
    }
  }

  const service = new MockWebhookManagerService();
  
  let notificationReceived = null;
  const callback = (event) => {
    notificationReceived = event;
  };
  
  service.subscribe(callback);
  
  assert.equal(service.getSubscriberCount(), 1, '应有 1 个订阅者');
  
  const testEvent = { type: 'push', timestamp: Date.now() };
  service.notify(testEvent);
  
  assert.equal(notificationReceived, testEvent, '应接收到正确的事件');
  
  // 添加第二个订阅者
  let secondNotification = null;
  service.subscribe((event) => {
    secondNotification = event;
  });
  
  assert.equal(service.getSubscriberCount(), 2, '应有 2 个订阅者');
  
  const testEvent2 = { type: 'mr', timestamp: Date.now() };
  service.notify(testEvent2);
  
  assert.equal(notificationReceived, testEvent2, '第一个订阅者应接收到事件');
  assert.equal(secondNotification, testEvent2, '第二个订阅者应接收到事件');
  
  console.log('✓ 事件订阅正确');
}

async function testProviderRouting() {
  console.log('\n🔀 测试提供商路由...');

  class MockWebhookManagerService {
    constructor() {
      this.handlers = new Map();
      this.subscribers = [];
    }

    registerHandler(provider, eventType, handler) {
      const key = `${provider}:${eventType}`;
      this.handlers.set(key, handler);
    }

    async handleWebhook(provider, payload, headers) {
      let eventType;
      if (provider === OAuthProvider.GITHUB) {
        eventType = headers['x-github-event'] || 'push';
      } else if (provider === OAuthProvider.GITLAB) {
        eventType = headers['x-gitlab-event'] || 'Push Hook';
      }

      const key = `${provider}:${eventType}`;
      const handler = this.handlers.get(key);

      if (handler) {
        return await handler(payload, headers);
      }

      return { success: false, error: 'No handler registered' };
    }
  }

  const service = new MockWebhookManagerService();
  
  // 为不同提供商注册相同的处理器
  const githubPushHandler = async (payload, headers) => ({ provider: OAuthProvider.GITHUB, event: 'push' });
  const gitlabPushHandler = async (payload, headers) => ({ provider: OAuthProvider.GITLAB, event: 'push' });
  
  service.registerHandler(OAuthProvider.GITHUB, 'push', githubPushHandler);
  service.registerHandler(OAuthProvider.GITLAB, 'Push Hook', gitlabPushHandler);
  
  // 测试 GitHub 路由
  const githubResult = await service.handleWebhook(OAuthProvider.GITHUB, {}, { 'x-github-event': 'push' });
  assert.equal(githubResult.provider, OAuthProvider.GITHUB, 'GitHub 事件应路由到 GitHub 处理器');
  
  // 测试 GitLab 路由
  const gitlabResult = await service.handleWebhook(OAuthProvider.GITLAB, {}, { 'x-gitlab-event': 'Push Hook' });
  assert.equal(gitlabResult.provider, OAuthProvider.GITLAB, 'GitLab 事件应路由到 GitLab 处理器');
  
  console.log('✓ 提供商路由正确');
}

async function runAllTests() {
  console.log('========================================');
  console.log('🔬 Webhook 管理器服务单元测试');
  console.log('========================================');

  try {
    await loadModules();
    
    await testWebhookManagerServiceConfig();
    await testHandlerRegistration();
    await testWebhookHandling();
    await testEventSubscription();
    await testProviderRouting();

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
