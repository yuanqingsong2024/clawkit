import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorNotice, InfoNotice, SuccessNotice, WarningNotice } from '../../src/components/ui/Notice';

describe('Notice 组件', () => {
  describe('ErrorNotice', () => {
    it('应该显示默认标题和消息', () => {
      render(<ErrorNotice message="错误消息" />);
      expect(screen.getByText('错误消息')).toBeInTheDocument();
      expect(screen.getByText('请求失败')).toBeInTheDocument();
    });

    it('应该显示自定义标题', () => {
      render(<ErrorNotice title="自定义错误" message="消息内容" />);
      expect(screen.getByText('自定义错误')).toBeInTheDocument();
      expect(screen.getByText('消息内容')).toBeInTheDocument();
    });
  });

  describe('InfoNotice', () => {
    it('应该显示默认标题和消息', () => {
      render(<InfoNotice message="提示消息" />);
      expect(screen.getByText('提示消息')).toBeInTheDocument();
      expect(screen.getByText('提示')).toBeInTheDocument();
    });

    it('应该显示自定义标题', () => {
      render(<InfoNotice title="信息标题" message="消息内容" />);
      expect(screen.getByText('信息标题')).toBeInTheDocument();
    });
  });

  describe('SuccessNotice', () => {
    it('应该显示默认标题和消息', () => {
      render(<SuccessNotice message="成功消息" />);
      expect(screen.getByText('成功消息')).toBeInTheDocument();
      expect(screen.getByText('成功')).toBeInTheDocument();
    });
  });

  describe('WarningNotice', () => {
    it('应该显示默认标题和消息', () => {
      render(<WarningNotice message="警告消息" />);
      expect(screen.getByText('警告消息')).toBeInTheDocument();
      expect(screen.getByText('警告')).toBeInTheDocument();
    });
  });
});
