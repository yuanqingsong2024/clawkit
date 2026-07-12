import { describe, it, expect } from 'vitest';
import { formatDateTime, isNonEmptyString } from '../../src/lib/format';

describe('format 工具函数', () => {
  describe('formatDateTime', () => {
    it('空值应该返回 -', () => {
      expect(formatDateTime(null)).toBe('-');
      expect(formatDateTime(undefined)).toBe('-');
      expect(formatDateTime('')).toBe('-');
    });

    it('应该格式化 Date 对象', () => {
      const date = new Date('2024-06-15T10:30:00');
      const result = formatDateTime(date);
      expect(result).toContain('2024');
      expect(result).toContain('10:30');
    });

    it('应该格式化 ISO 字符串', () => {
      const result = formatDateTime('2024-06-15T10:30:00');
      expect(result).toContain('2024');
      expect(result).toContain('10:30');
    });

    it('无效日期应该返回原始值', () => {
      const result = formatDateTime('not-a-date');
      expect(result).toBe('not-a-date');
    });
  });

  describe('isNonEmptyString', () => {
    it('应该正确识别非空字符串', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString('  ')).toBe(false);
      expect(isNonEmptyString('')).toBe(false);
    });

    it('应该正确识别非字符串', () => {
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString({})).toBe(false);
      expect(isNonEmptyString([])).toBe(false);
    });
  });
});
