/**
 * Jest 测试设置
 */

// 设置测试超时时间
jest.setTimeout(10000);

// 模拟环境变量
process.env.CLAWKIT_API_KEY = 'test-api-key';
process.env.CLAWKIT_BASE_URL = 'http://localhost:8787';

// 全局测试清理
afterAll(() => {
  // 清理任何打开的连接
});

// 抑制控制台输出（在需要时）
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
