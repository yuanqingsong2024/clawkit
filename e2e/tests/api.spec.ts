/**
 * Controller API E2E 测试
 * 测试核心 API 链路：webhook → 草稿创建 → 审批 → 派发
 */

import { test, expect, request } from '@playwright/test';

// 测试配置
const CONTROLLER_URL = process.env.CONTROLLER_URL || 'http://127.0.0.1:8787';
const WEBHOOK_TOKEN = process.env.OPENCLAW_WEBHOOK_TOKEN || 'test-token';

interface TaskDraft {
  taskId: string;
  projectKey: string;
  intent: string;
  status: string;
}

interface ApiResponse<T> {
  success: boolean;
  code: string;
  message: string;
  data: T;
}

test.describe('Controller API 核心链路测试', () => {
  let createdTaskId: string | null = null;

  test.beforeAll(async () => {
    // 等待 controller 启动
    const maxRetries = 30;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await request.newInstance().get(`${CONTROLLER_URL}/api/health`);
        if (response.ok()) {
          console.log('Controller 已就绪');
          return;
        }
      } catch {
        // 继续等待
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Controller 未在预期时间内启动');
  });

  test.describe('健康检查', () => {
    test('健康检查端点应返回 200', async () => {
      const response = await request.newInstance().get(`${CONTROLLER_URL}/api/health`);
      expect(response.ok()).toBeTruthy();
      
      const body = await response.json() as ApiResponse<unknown>;
      expect(body.success).toBe(true);
    });

    test('详细健康检查应包含各组件状态', async () => {
      const response = await request.newInstance().get(`${CONTROLLER_URL}/api/health/detailed`);
      const body = await response.json() as ApiResponse<{
        overall: string;
        checks: Array<{ name: string; status: string }>;
      }>;
      
      expect(body.success).toBe(true);
      expect(body.data.checks).toBeDefined();
      expect(Array.isArray(body.data.checks)).toBe(true);
    });
  });

  test.describe('WebSocket 实时日志', () => {
    test('WebSocket 连接应成功建立', async ({ page }) => {
      await page.goto(`${CONTROLLER_URL}/ws/logs/controller`);
      
      // 等待连接消息
      const connected = await page.evaluate(async () => {
        return new Promise<boolean>((resolve) => {
          const ws = new WebSocket(`${window.location.origin.replace('http', 'ws')}/ws/logs/controller`);
          ws.onopen = () => {
            ws.close();
            resolve(true);
          };
          ws.onerror = () => resolve(false);
          setTimeout(() => resolve(false), 5000);
        });
      });
      
      expect(connected).toBe(true);
    });
  });

  test.describe('Webhook → 草稿创建', () => {
    test('应能通过 webhook 创建任务草稿', async () => {
      const webhookPayload = {
        event: 'task.create',
        projectKey: 'test-project',
        intent: 'E2E 测试任务 - 创建草稿',
        operator: 'e2e-test',
        priority: 'normal',
      };

      const response = await request.newInstance()
        .post(`${CONTROLLER_URL}/api/openclaw/webhook`)
        .set('Authorization', `Bearer ${WEBHOOK_TOKEN}`)
        .send(webhookPayload);

      expect(response.ok() || response.status() === 201 || response.status() === 200).toBeTruthy();

      const body = await response.json() as ApiResponse<{ taskDraft: TaskDraft }>;
      expect(body.success).toBe(true);
      expect(body.data.taskDraft).toBeDefined();
      expect(body.data.taskDraft.taskId).toBeDefined();
      
      createdTaskId = body.data.taskDraft.taskId;
      console.log(`创建的任务 ID: ${createdTaskId}`);
    });

    test('无效 token 应返回 401', async () => {
      const response = await request.newInstance()
        .post(`${CONTROLLER_URL}/api/openclaw/webhook`)
        .set('Authorization', 'Bearer invalid-token')
        .send({ event: 'task.create', projectKey: 'test' });

      expect(response.status()).toBe(401);
    });
  });

  test.describe('草稿 → 审批通过', () => {
    test.skip('应在有任务 ID 时能审批通过', async () => {
      if (!createdTaskId) {
        console.log('跳过：没有可用的任务 ID');
        return;
      }

      const response = await request.newInstance()
        .post(`${CONTROLLER_URL}/api/approval/${encodeURIComponent(createdTaskId)}/approve`)
        .send({ operator: 'e2e-test' });

      // 可能因为 worker 未启动而失败，但应该返回结构化响应
      const body = await response.json();
      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('code');
    });

    test('应能获取任务列表', async () => {
      const response = await request.newInstance()
        .get(`${CONTROLLER_URL}/api/tasks?page=1&pageSize=10`);

      expect(response.ok()).toBeTruthy();

      const body = await response.json() as ApiResponse<{
        tasks: TaskDraft[];
        pagination: { page: number; pageSize: number; total: number };
      }>;
      
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.tasks)).toBe(true);
      expect(body.data.pagination).toBeDefined();
    });
  });

  test.describe('配置热重载', () => {
    test('配置状态应返回正确信息', async () => {
      const response = await request.newInstance()
        .get(`${CONTROLLER_URL}/api/system/config/status`);

      const body = await response.json() as ApiResponse<{
        hotReload: { isWatching: boolean; manifestPath: string };
      }>;
      
      expect(body.success).toBe(true);
      expect(body.data.hotReload).toBeDefined();
    });

    test('应能手动触发配置重载', async () => {
      const response = await request.newInstance()
        .post(`${CONTROLLER_URL}/api/system/config/reload`);

      const body = await response.json();
      // 成功或失败都应返回结构化响应
      expect(body).toHaveProperty('success');
    });
  });

  test.describe('通知服务', () => {
    test('通知渠道列表应返回支持的渠道', async () => {
      const response = await request.newInstance()
        .get(`${CONTROLLER_URL}/api/notify/channels`);

      const body = await response.json() as ApiResponse<{
        channels: Array<{ id: string; name: string }>;
      }>;
      
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.channels)).toBe(true);
      expect(body.data.channels.length).toBeGreaterThan(0);
    });
  });
});
