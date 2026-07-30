/**
 * format.ts 工具函数测试
 */
import { describe, it, expect } from 'vitest';
import { formatDateTime, isNonEmptyString } from '../../src/lib/format';

describe('format.ts 工具函数', () => {
  describe('formatDateTime', () => {
    it('应正确格式化 ISO 字符串', () => {
      const result = formatDateTime('2026-07-29T10:30:00.000Z');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('应正确格式化 Date 对象', () => {
      const date = new Date('2026-07-29T10:30:00.000Z');
      const result = formatDateTime(date);
      expect(result).toBeTruthy();
    });

    it('应处理空值', () => {
      const result = formatDateTime('');
      expect(result).toBe('-');
    });

    it('应处理 null 值', () => {
      const result = formatDateTime(null);
      expect(result).toBe('-');
    });

    it('应处理 undefined 值', () => {
      const result = formatDateTime(undefined);
      expect(result).toBe('-');
    });

    it('应处理无效日期', () => {
      const result = formatDateTime('invalid-date');
      expect(result).toBe('invalid-date');
    });
  });

  describe('isNonEmptyString', () => {
    it('应正确判断非空字符串', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString('  ')).toBe(false);
      expect(isNonEmptyString('')).toBe(false);
    });

    it('应正确判断非字符串类型', () => {
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString({})).toBe(false);
    });
  });
});
