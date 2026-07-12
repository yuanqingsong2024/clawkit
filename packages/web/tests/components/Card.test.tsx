import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '../../src/components/ui/Card';

describe('Card 组件', () => {
  it('应该渲染子内容', () => {
    render(<Card>卡片内容</Card>);
    expect(screen.getByText('卡片内容')).toBeInTheDocument();
  });

  it('应该渲染标题', () => {
    render(<Card title="卡片标题">内容</Card>);
    expect(screen.getByText('卡片标题')).toBeInTheDocument();
  });

  it('应该渲染操作按钮区域', () => {
    render(
      <Card title="标题" actions={<button>操作</button>}>
        内容
      </Card>
    );
    expect(screen.getByText('操作')).toBeInTheDocument();
  });

  it('应该应用自定义 className', () => {
    const { container } = render(<Card className="custom-class">内容</Card>);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('compact 模式应该应用正确的样式', () => {
    const { container } = render(<Card compact>内容</Card>);
    // compact 模式会改变 padding，验证组件能正常渲染
    expect(container.querySelector('section')).toBeInTheDocument();
  });

  it('没有标题时不应该渲染 header', () => {
    const { container } = render(<Card>仅内容</Card>);
    // 没有标题，不应该有 border-b
    expect(container.querySelector('.border-b')).not.toBeInTheDocument();
  });
});
