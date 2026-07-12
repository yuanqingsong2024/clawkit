import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/services/**/*.ts'],
      exclude: [],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@clawkit/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
