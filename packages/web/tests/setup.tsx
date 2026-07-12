// 测试环境设置文件
import '@testing-library/jest-dom';
import '@testing-library/dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// 每个测试后清理
afterEach(() => {
  cleanup();
});

// Mock fetch
global.fetch = vi.fn();

// Mock URL.createObjectURL
URL.createObjectURL = vi.fn(() => 'blob:test-url');
URL.revokeObjectURL = vi.fn();

// Mock crypto.randomUUID
if (!global.crypto?.randomUUID) {
  global.crypto = {
    ...global.crypto,
    randomUUID: () => Math.random().toString(36).substring(2, 15),
  };
}
