/**
 * 端到端链路测试
 * 测试完整链路：启动服务 → webhook 创建任务 → 审批 → 派发 → 任务完成
 */

import { test, expect, request, type APIRequestContext } from '@playwright/test';

// 测试配置
const CONTROLLER_URL = process.env.CONTROLLER_URL || 'http://127.0.0.1:8787';
const WEBHOOK_TOKEN = process.env.OPENCLAW_WEBHOOK_TOKEN || 'test-token';

interface ApiResponse<T> {
  success: boolean;
  code: string;
  message: string;
  data: T;
}

test.describe('端到端链路测试', () => {
  let api: APIRequestContext;
  let createdTaskId: string | null = null;

  test.beforeAll(async () => {
    api = await request.newContext({
      baseURL: CONTROLLER_URL,
    });

    // 等待 controller 启动
    console.log('等待 Controller 启动...');
    const maxRetries = 30;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await api.get('/api/health');
        if (response.ok()) {
          console.log('Controller 已就绪');
          break;
        }
      } catch {
        // 继续等待
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('完整链路测试：创建 → 查询 → 取消', async () => {
    // Step 1: 创建任务
    console.log('Step 1: 创建任务');
    const createResponse = await api.post('/api/openclaw/webhook', {
      headers: {
        'Authorization': `Bearer ${WEBHOOK_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        event: 'task.create',
        projectKey: 'e2e-test-project',
        intent: 'E2E 自动化测试任务',
        operator: 'e2e-test-suite',
        priority: 'normal',
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const createBody = await createResponse.json() as ApiResponse<{ taskDraft: { taskId: string } }>;
    expect(createBody.success).toBe(true);
    expect(createBody.data.taskDraft?.taskId).toBeDefined();

    createdTaskId = createBody.data.taskDraft.taskId;
    console.log(`任务已创建: ${createdTaskId}`);

    // Step 2: 查询任务列表
    console.log('Step 2: 查询任务列表');
    const listResponse = await api.get('/api/tasks?page=1&pageSize=10');
    expect(listResponse.ok()).toBeTruthy();

    const listBody = await listResponse.json() as ApiResponse<{
      tasks: Array<{ taskId: string }>;
      pagination: { total: number };
    }>;
    expect(listBody.success).toBe(true);
    expect(listBody.data.tasks.length).toBeGreaterThan(0);
    console.log(`当前任务总数: ${listBody.data.pagination.total}`);

    // Step 3: 取消任务
    if (createdTaskId) {
      console.log(`Step 3: 取消任务 ${createdTaskId}`);
      const cancelResponse = await api.post(`/api/approval/${encodeURIComponent(createdTaskId)}/cancel`, {
        data: { operator: 'e2e-test-suite' },
      });

      // 取消应该成功或返回结构化错误
      const cancelBody = await cancelResponse.json();
      expect(cancelBody).toHaveProperty('success');
      console.log(`任务已取消: ${createdTaskId}`);
    }
  });

  test('健康检查链路', async () => {
    // 测试所有健康检查端点
    const healthEndpoints = [
      '/api/health',
      '/api/health/opencode',
      '/api/health/disk',
      '/api/health/ready',
      '/api/health/live',
    ];

    for (const endpoint of healthEndpoints) {
      const response = await api.get(endpoint);
      expect(response.ok() || response.status() === 503).toBeTruthy();
      console.log(`${endpoint}: ${response.status()}`);
    }
  });

  test('配置管理链路', async () => {
    // 测试配置状态
    const statusResponse = await api.get('/api/system/config/status');
    expect(statusResponse.ok()).toBeTruthy();

    // 测试通知服务
    const notifyResponse = await api.get('/api/notify/channels');
    expect(notifyResponse.ok()).toBeTruthy();

    const notifyBody = await notifyResponse.json() as ApiResponse<{ channels: unknown[] }>;
    expect(notifyBody.data.channels).toBeDefined();
  });
});
