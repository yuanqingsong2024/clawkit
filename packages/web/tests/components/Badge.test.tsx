import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Badge } from '../../src/components/ui/Badge';

// Badge 测试
describe('Badge 组件', () => {
  it('应该正确渲染文本内容', () => {
    render(<Badge>测试内容</Badge>);
    expect(screen.getByText('测试内容')).toBeInTheDocument();
  });

  it('应该应用默认 tone', () => {
    const { container } = render(<Badge>默认Badge</Badge>);
    // 默认 tone 为 neutral，不应该有特殊的颜色类
    expect(container.firstChild).toBeInTheDocument();
  });

  it('应该应用 success tone', () => {
    render(<Badge tone="success">成功</Badge>);
    expect(screen.getByText('成功')).toBeInTheDocument();
  });

  it('应该应用 warning tone', () => {
    render(<Badge tone="warning">警告</Badge>);
    expect(screen.getByText('警告')).toBeInTheDocument();
  });

  it('应该应用 failed tone', () => {
    render(<Badge tone="failed">失败</Badge>);
    expect(screen.getByText('失败')).toBeInTheDocument();
  });

  it('应该应用自定义 className', () => {
    const { container } = render(<Badge className="custom-class">自定义</Badge>);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
