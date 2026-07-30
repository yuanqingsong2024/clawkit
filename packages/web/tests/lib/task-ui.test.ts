/**
 * task-ui.ts 工具函数测试
 */
import { describe, it, expect } from 'vitest';
import {
  getAvailableTaskActions,
  labelForTaskStatus,
  labelForTaskAction,
  toneForTaskStatus,
  getTaskActionHint,
  labelForExecutionStatus,
  toneForExecutionStatus,
} from '../../src/lib/task-ui';

describe('task-ui.ts 工具函数', () => {
  describe('getAvailableTaskActions', () => {
    it('草稿状态应返回 cancel', () => {
      const actions = getAvailableTaskActions('DRAFT');
      expect(actions).toContain('cancel');
      expect(actions).toHaveLength(1);
    });

    it('等待审批状态应返回所有操作', () => {
      const actions = getAvailableTaskActions('WAITING_APPROVAL');
      expect(actions).toContain('approve');
      expect(actions).toContain('revise');
      expect(actions).toContain('cancel');
    });

    it('运行中状态应只返回 cancel', () => {
      const actions = getAvailableTaskActions('RUNNING');
      expect(actions).toContain('cancel');
      expect(actions).toHaveLength(1);
    });

    it('完成状态应返回空数组', () => {
      const actions = getAvailableTaskActions('DONE');
      expect(actions).toEqual([]);
    });

    it('已取消状态应返回空数组', () => {
      const actions = getAvailableTaskActions('CANCELLED');
      expect(actions).toEqual([]);
    });
  });

  describe('labelForTaskStatus', () => {
    it('应返回正确的状态标签', () => {
      expect(labelForTaskStatus('DRAFT')).toBe('草稿');
      expect(labelForTaskStatus('WAITING_APPROVAL')).toBe('等待审批');
      expect(labelForTaskStatus('APPROVED')).toBe('已确认');
      expect(labelForTaskStatus('RUNNING')).toBe('运行中');
      expect(labelForTaskStatus('DONE')).toBe('完成');
      expect(labelForTaskStatus('FAILED')).toBe('失败');
      expect(labelForTaskStatus('CANCELLED')).toBe('已取消');
    });

    it('应处理未知状态', () => {
      expect(labelForTaskStatus('UNKNOWN')).toBe('UNKNOWN');
    });

    it('应处理大小写不敏感', () => {
      expect(labelForTaskStatus('draft')).toBe('草稿');
      expect(labelForTaskStatus('Draft')).toBe('草稿');
    });
  });

  describe('labelForTaskAction', () => {
    it('应返回正确的操作标签', () => {
      expect(labelForTaskAction('approve')).toBe('确认');
      expect(labelForTaskAction('revise')).toBe('修改');
      expect(labelForTaskAction('cancel')).toBe('取消');
    });
  });

  describe('toneForTaskStatus', () => {
    it('应返回正确的色调', () => {
      expect(toneForTaskStatus('DONE')).toBe('success');
      expect(toneForTaskStatus('RUNNING')).toBe('info');
      expect(toneForTaskStatus('DISPATCHED')).toBe('info');
      expect(toneForTaskStatus('WAITING_APPROVAL')).toBe('warning');
      expect(toneForTaskStatus('FAILED')).toBe('failed');
      expect(toneForTaskStatus('CANCELLED')).toBe('failed');
      expect(toneForTaskStatus('DRAFT')).toBe('neutral');
    });
  });

  describe('getTaskActionHint', () => {
    it('应返回正确的操作提示', () => {
      expect(getTaskActionHint('DRAFT')).toBe('草稿阶段仅支持取消。');
      expect(getTaskActionHint('WAITING_APPROVAL')).toBe('可修改草案、确认派发或取消。');
      expect(getTaskActionHint('DONE')).toBe('任务已完成，当前无可执行操作。');
    });
  });

  describe('labelForExecutionStatus', () => {
    it('应返回正确的执行状态标签', () => {
      expect(labelForExecutionStatus('not_started')).toBe('未开始');
      expect(labelForExecutionStatus('running')).toBe('运行中');
      expect(labelForExecutionStatus('done')).toBe('完成');
      expect(labelForExecutionStatus('failed')).toBe('失败');
    });

    it('应处理未知状态', () => {
      expect(labelForExecutionStatus('unknown')).toBe('unknown');
    });
  });

  describe('toneForExecutionStatus', () => {
    it('应返回正确的色调', () => {
      expect(toneForExecutionStatus('done')).toBe('success');
      expect(toneForExecutionStatus('running')).toBe('info');
      expect(toneForExecutionStatus('failed')).toBe('failed');
      expect(toneForExecutionStatus('not_started')).toBe('neutral');
    });
  });
});
